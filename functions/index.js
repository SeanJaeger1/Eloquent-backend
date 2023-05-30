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

// get a mix of old and new words for the user to learn
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
    // Get old words
    const oneHourAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 1000 * 60 * 60)
    ) // 1 hour ago
    const oldWordsQuery = db
      .collection("UserWord")
      .where("userId", "==", userID)
      .where("lastSeenAt", "<", oneHourAgo)
      .orderBy("lastSeenAt", "desc")
      .limit(15)
    const oldWordsSnapshot = await oldWordsQuery.get()
    const oldWords = oldWordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    let newWords = []
    if (oldWords.length < 15) {
      const newWordsNeeded = 15 - oldWords.length

      // const userSkillLevel = userDocSnapshot.data().skillLevel
      const newWordsQuery = db
        .collection("Word")
        .where("difficulty", "==", "intermediate")
        .limit(newWordsNeeded)
      const newWordsSnapshot = await newWordsQuery.get()
      newWords = newWordsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    }

    // Combine old and new words
    const wordsToShow = [...oldWords, ...newWords].slice(0, 15).map((word) => {
      // Handle NaN values in word properties
      for (const key in word) {
        if (typeof word[key] === "number" && isNaN(word[key])) {
          word[key] = null
        }
      }
      return word
    })

    return wordsToShow
  } catch (error) {
    console.error(error)
    throw new functions.https.HttpsError(
      "internal",
      "Error fetching learning words"
    )
  }
})

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

exports.getUserWordsWithOriginalWords = functions.https.onCall(
  async (data, context) => {
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
      const wordIds = []

      userWordsSnapshot.forEach((doc) => {
        const userWord = doc.data()
        userWords.push({ id: doc.id, ...userWord })
        wordIds.push(userWord.wordId)
      })

      const wordSnapshots = await db
        .collection("Word")
        .where(admin.firestore.FieldPath.documentId(), "in", wordIds)
        .get()

      const wordsMap = {}
      wordSnapshots.forEach((doc) => {
        wordsMap[doc.id] = { id: doc.id, ...doc.data() }
      })

      const userWordsWithOriginalWords = userWords.map((userWord) => {
        const word = wordsMap[userWord.wordId]
        return { ...userWord, word }
      })

      return userWordsWithOriginalWords
    } catch (error) {
      console.error(error)
      throw new functions.https.HttpsError(
        "internal",
        "Error fetching user words"
      )
    }
  }
)
