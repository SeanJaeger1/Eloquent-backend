import admin from "firebase-admin"
import { db } from "./firebaseAdmin.js"
import { onCall } from "firebase-functions/v2/https"
import config from "./utils/config.js"

const getLearningWords = onCall(
  {
    region: config.region,
    cors: config.cors,
  },
  async (request) => {
    if (!request.auth) {
      throw new Error("unauthenticated", "User must be authenticated to fetch learning words.")
    }

    const wordLimit = config.wordLimits.default
    const userID = request.auth.uid
    const FIFTEEN_MINUTES = config.timeoutSettings.FIFTEEN_MINUTES

    try {
      // Use a transaction to safely update user state
      return await db.runTransaction(async (transaction) => {
        // Get user data in transaction
        const userRef = db.collection("users").doc(userID)
        const userDoc = await transaction.get(userRef)
        if (!userDoc.exists) {
          throw new Error("not-found", "User not found")
        }
        const user = userDoc.data()

        // Get previously seen words
        const previouslySeenWordsSnapshot = await db
          .collection("userWords")
          .where("userId", "==", userID)
          .where("difficulty", "==", user.skillLevel)
          .where("alreadyKnown", "==", false)
          .where("learned", "==", false)
          .where(
            "lastSeenAt",
            "<",
            admin.firestore.Timestamp.fromDate(new Date(Date.now() - FIFTEEN_MINUTES))
          )
          .limit(wordLimit)
          .get()

        const previouslySeenWords = await Promise.all(
          previouslySeenWordsSnapshot.docs.map(async (doc) => {
            const wordRef = doc.data().word
            const wordSnapshot = await wordRef.get()
            const wordData = wordSnapshot.data()

            return {
              id: doc.id,
              ...doc.data(),
              word: wordData,
              lastSeenAt: doc.data().lastSeenAt?.toDate() || null,
            }
          })
        )

        if (previouslySeenWords.length === wordLimit) {
          return previouslySeenWords
        }

        const remainingWordLimit = wordLimit - previouslySeenWords.length
        const skillToIdx = {
          beginner: 0,
          intermediate: 1,
          advanced: 2,
          expert: 3,
        }

        const currentIndex = user.nextWords[skillToIdx[user.skillLevel]]
        const targetIndex = currentIndex + remainingWordLimit

        // Get new words in a single query
        const wordsSnapshot = await db
          .collection("words")
          .where("difficulty", "==", user.skillLevel)
          .where("index", ">=", currentIndex)
          .where("index", "<", targetIndex)
          .limit(remainingWordLimit)
          .get()

        const words = wordsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // If we found new words, update the user's nextWords index in the transaction
        if (words.length > 0) {
          const nextWords = [...user.nextWords]
          nextWords[skillToIdx[user.skillLevel]] = targetIndex
          transaction.update(userRef, { nextWords })
        }

        // Create new userWords
        const newUserWordsData = []
        for (const word of words) {
          const userWordRef = db.collection("userWords").doc()
          const wordRef = db.collection("words").doc(word.id)

          const newUserWord = {
            word: wordRef,
            progress: 1,
            userId: userID,
            lastSeenAt: null,
            learned: false,
            difficulty: user.skillLevel,
            alreadyKnown: false,
          }

          transaction.set(userWordRef, newUserWord)

          newUserWordsData.push({
            id: userWordRef.id,
            ...newUserWord,
            word: word,
          })
        }

        return [...previouslySeenWords, ...newUserWordsData]
      })
    } catch (error) {
      console.error("Error in getLearningWords:", error)
      throw new Error(
        "internal",
        `Failed to fetch learning words: ${error.message || "Unknown error"}`
      )
    }
  }
)

export default getLearningWords
