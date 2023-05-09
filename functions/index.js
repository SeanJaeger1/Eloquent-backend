const functions = require("firebase-functions")
const admin = require("firebase-admin")

const serviceAccount = require("./serviceAccountKey.json")

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

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

    const userWords = []
    userWordsSnapshot.forEach((doc) => {
      userWords.push({ id: doc.id, ...doc.data() })
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

// get a new word for the user to learn
// exports.getNewWords = functions.https.onCall(async (data, context) => {
//   // Check if the user is authenticated
//   if (!context.auth) {
//     throw new functions.https.HttpsError(
//       "unauthenticated",
//       "User must be authenticated to fetch new words."
//     )
//   }

//   const userID = context.auth.uid

//   try {
//     const userWordsSnapshot = await db
//       .collection("UserWord")
//       .where("userId", "==", userID)
//       .get()

//     const userWordIds = userWordsSnapshot.docs.map((doc) => doc.data().wordID)

//     let wordsQuery = db.collection("Word").limit(10)
//     if (userWordIds.length > 0) {
//       wordsQuery = wordsQuery.where(
//         admin.firestore.FieldPath.documentId(),
//         "not-in",
//         userWordIds
//       )
//     }
//     const wordsSnapshot = await wordsQuery.get()

//     const newWords = []
//     wordsSnapshot.forEach((doc) => {
//       newWords.push({ id: doc.id, ...doc.data() })
//     })

//     return newWords
//   } catch (error) {
//     console.error(error)
//     throw new functions.https.HttpsError("internal", "Error fetching new words")
//   }
// })

// Get word details via a word's ID
exports.getWordDetails = functions.https.onCall(async (data, context) => {
  const { wordID } = data

  if (!wordID) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Word ID is required."
    )
  }

  try {
    const wordDoc = await db.collection("Words").doc(wordID).get()

    if (!wordDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "The requested word was not found."
      )
    }

    return { id: wordDoc.id, ...wordDoc.data() }
  } catch (error) {
    console.error(error)
    throw new functions.https.HttpsError(
      "internal",
      "Error fetching word details"
    )
  }
})
