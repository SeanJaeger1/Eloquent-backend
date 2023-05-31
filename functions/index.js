const functions = require("firebase-functions")
const admin = require("firebase-admin")

const serviceAccount = require("./serviceAccountKey.json")

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

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
      const data = doc.data()

      // Recursively replace NaN with '' in the document data
      ;(function replaceNaN(obj) {
        Object.keys(obj).forEach((key) => {
          if (typeof obj[key] === "object" && obj[key] !== null) {
            return replaceNaN(obj[key])
          }
          if (typeof obj[key] === "number" && isNaN(obj[key])) {
            obj[key] = ""
          }
        })
      })(data)

      return data
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

  console.log("here", data)

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

      await userWordRef.update({ progress: updatedProgress })

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
