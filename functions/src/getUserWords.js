const functions = require("firebase-functions")
const admin = require("firebase-admin")
const db = require("./firebaseAdmin")
const { fetchUser } = require("./utils/userUtils")

const getUserWords = functions.region("europe-west1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to fetch user words."
    )
  }

  const userID = context.auth.uid
  const user = await fetchUser(userID)

  let lastSeenAt = null
  if (data.lastSeenAt) {
    const tempDate = new Date(data.lastSeenAt)
    if (!isNaN(tempDate)) {
      lastSeenAt = tempDate
    } else {
      console.error("Invalid lastSeenAt timestamp:", data.lastSeenAt)
      // handle error here
    }
  }
  const limit = data.limit || 10

  try {
    let userWordsQuery = db
      .collection("userWords")
      .where("userId", "==", userID)
      .where("difficulty", "==", user.skillLevel)
      .where("alreadyKnown", "==", false)
      .orderBy("lastSeenAt")
      .limit(limit)

    if (lastSeenAt) {
      userWordsQuery = userWordsQuery.startAfter(lastSeenAt)
    }

    const userWordsSnapshot = await userWordsQuery.get()

    // Create a batch for updating lastSeenAt values
    const batch = db.batch()

    const userWords = await Promise.all(
      userWordsSnapshot.docs.map(async (doc) => {
        const wordRef = doc.data().word
        const wordSnapshot = await wordRef.get()
        const wordData = wordSnapshot.data()

        // If word has never been seen, update its lastSeenAt
        if (doc.data().lastSeenAt === null) {
          const timestamp = admin.firestore.FieldValue.serverTimestamp()
          batch.update(doc.ref, { lastSeenAt: timestamp })
        }

        return {
          id: doc.id,
          word: wordData,
          progress: doc.data().progress,
          lastSeenAt:
            doc.data().lastSeenAt === null
              ? new Date().toISOString()
              : doc.data().lastSeenAt.toDate().toISOString(),
        }
      })
    )

    // Commit all lastSeenAt updates
    await batch.commit()

    const nextPageToken = userWords.length > 0 ? userWords[userWords.length - 1].lastSeenAt : null

    return { userWords, nextPageToken }
  } catch (error) {
    console.log(error)
    throw new functions.https.HttpsError("internal", "Error fetching user words")
  }
})

module.exports = getUserWords
