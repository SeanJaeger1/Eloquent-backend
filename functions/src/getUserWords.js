const admin = require("firebase-admin")
const { db } = require("./firebaseAdmin")
const { fetchUser } = require("./utils/userUtils")
const { onCall } = require("firebase-functions/v2/https")

const getUserWords = onCall(
  {
    region: "europe-west1",
    cors: ["https://learn-eloquent.com", "http://localhost:8081"],
  },
  async (request) => {
    if (!request.auth) {
      throw new Error("unauthenticated", "User must be authenticated to fetch user words.")
    }

    const userID = request.auth.uid
    const data = request.data
    const user = await fetchUser(userID)
    const limit = data.limit || 10

    // Better date validation
    let lastSeenAtTimestamp = null
    if (data.lastSeenAt) {
      try {
        const tempDate = new Date(data.lastSeenAt)
        if (!isNaN(tempDate.getTime())) {
          lastSeenAtTimestamp = admin.firestore.Timestamp.fromDate(tempDate)
        } else {
          throw new Error("Invalid date format")
        }
      } catch (error) {
        throw new Error("invalid-argument", `Invalid lastSeenAt timestamp: ${data.lastSeenAt}`)
      }
    }

    try {
      let userWordsQuery = db
        .collection("userWords")
        .where("userId", "==", userID)
        .where("difficulty", "==", user.skillLevel)
        .where("alreadyKnown", "==", false)
        .orderBy("lastSeenAt")
        .limit(limit)

      if (lastSeenAtTimestamp) {
        userWordsQuery = userWordsQuery.startAfter(lastSeenAtTimestamp)
      }

      const userWordsSnapshot = await userWordsQuery.get()
      const userWordsToUpdate = []

      // First, collect data and identify what needs updates
      const userWords = await Promise.all(
        userWordsSnapshot.docs.map(async (doc) => {
          const docData = doc.data()
          const wordRef = docData.word
          const wordSnapshot = await wordRef.get()
          const wordData = wordSnapshot.data()

          // Track which documents need lastSeenAt updates
          if (docData.lastSeenAt === null) {
            userWordsToUpdate.push(doc.ref)
          }

          return {
            id: doc.id,
            word: wordData,
            progress: docData.progress,
            lastSeenAt: docData.lastSeenAt?.toDate()?.toISOString() || null,
          }
        })
      )

      // Now update lastSeenAt fields if needed
      if (userWordsToUpdate.length > 0) {
        const batch = db.batch()
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp()

        userWordsToUpdate.forEach((ref) => {
          batch.update(ref, { lastSeenAt: serverTimestamp })
        })

        await batch.commit()
      }

      // Calculate next page token from the returned data
      const nextPageToken = userWords.length > 0 ? userWords[userWords.length - 1].lastSeenAt : null

      return { userWords, nextPageToken }
    } catch (error) {
      console.error("Error in getUserWords:", error)
      throw new Error("internal", `Error fetching user words: ${error.message || "Unknown error"}`)
    }
  }
)

module.exports = getUserWords
