const functions = require("firebase-functions")
const admin = require("firebase-admin")

const serviceAccount = require("./serviceAccountKey.json")

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

exports.getLearningWords = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to fetch learning words."
    )
  }

  const userID = context.auth.uid

  try {
    // Define the timestamp for 1 hour ago and 15 minutes ago
    const oneHourAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 1000 * 60 * 60)
    )
    const fifteenMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 1000 * 60 * 15)
    )

    // Fetch the UserWords for the current user that were last seen more than an hour ago
    const oldUserWordsSnapshot = await db
      .collection("UserWord")
      .where("userId", "==", userID)
      .where("lastSeenAt", "<", oneHourAgo)
      .orderBy("lastSeenAt", "desc")
      .limit(15)
      .get()

    // Fetch all UserWords for the current user
    const allUserWordsSnapshot = await db
      .collection("UserWord")
      .where("userId", "==", userID)
      .get()

    // Create an array of the ids of the Word documents corresponding to the UserWord documents
    const userWordIds = allUserWordsSnapshot.docs.map((doc) => doc.id)

    let oldUserWords = oldUserWordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    let newWords = []
    if (oldUserWords.length < 15) {
      const newWordsNeeded = 15 - oldUserWords.length

      // Fetch the Word documents that do not have corresponding UserWord documents for the current user
      const newWordsSnapshot = await db
        .collection("Word")
        .where(admin.firestore.FieldPath.documentId(), "not-in", userWordIds)
        .where("difficulty", "==", "intermediate")
        .limit(newWordsNeeded)
        .get()

      newWords = newWordsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    }

    // Combine old and new words, excluding UserWords seen in the last 15 minutes
    const wordsToShow = [...oldUserWords, ...newWords]
      .filter(
        (word) => !(word.lastSeenAt && word.lastSeenAt >= fifteenMinutesAgo)
      )
      .slice(0, 15)

    return wordsToShow
  } catch (error) {
    console.error(error)
    throw new functions.https.HttpsError(
      "internal",
      "Error fetching learning words"
    )
  }
})

exports.getUserWords = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to fetch user words."
    )
  }

  const userID = context.auth.uid

  try {
    const userWordsSnapshot = await db
      .collection("UserWord")
      .where("userId", "==", userID)
      .get()

    const userWords = userWordsSnapshot.docs.map((doc) => {
      return doc.data()
    })

    return userWords
  } catch (error) {
    console.error(error)
    throw new functions.https.HttpsError(
      "internal",
      "Error fetching user words"
    )
  }
})

exports.updateWordProgress = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User is not authenticated."
    )
  }

  const { userWordId, increment } = data
  const userId = context.auth.uid

  try {
    const userWordRef = db.collection("UserWord").doc(userWordId)

    // Check if the user word exists
    const userWordSnapshot = await userWordRef.get()

    if (userWordSnapshot.exists) {
      // User word exists, update the progress
      const userWordData = userWordSnapshot.data()
      const progress = userWordData.progress || 0
      const updatedProgress = Math.max(1, Math.min(progress + increment, 5))

      await userWordRef.update({
        progress: updatedProgress,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(), // update lastSeenAt to current server time
      })

      return {
        success: true,
        message: "User word progress updated successfully.",
      }
    } else {
      // User word doesn't exist, create a new user word
      const wordRef = db.collection("Word").doc(userWordId)
      const wordSnapshot = await wordRef.get()

      if (!wordSnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "Word not found.")
      }

      const wordData = wordSnapshot.data()
      const newUserWord = {
        word: wordData,
        progress: Math.max(1, increment),
        userId,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(), // set lastSeenAt to current server time when the user word is created
      }

      await userWordRef.set(newUserWord)

      return { success: true, message: "User word created successfully." }
    }
  } catch (error) {
    console.error("Error updating/creating user word:", error)
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while updating/creating user word."
    )
  }
})
