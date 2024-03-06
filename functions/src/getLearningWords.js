const functions = require("firebase-functions")
const admin = require("firebase-admin")
const db = require("./firebaseAdmin")
const { fetchUser } = require("./utils/userUtils")

const getLearningWords = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to fetch learning words."
      )
    }

    const wordLimit = 5
    const userID = context.auth.uid

    const user = await fetchUser(userID)

    try {
      const previouslySeenWordsSnapshot = await db
        .collection("userWords")
        .where("userId", "==", userID)
        .where("difficulty", "==", user.skillLevel)
        .where("learned", "==", false)
        .where(
          "lastSeenAt",
          "<",
          admin.firestore.Timestamp.fromDate(
            new Date(Date.now() - 15 * 60 * 1000)
          )
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
            lastSeenAt: doc.data().lastSeenAt.toDate(),
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

      const wordsSnapshot = await db
        .collection("words")
        .where("difficulty", "==", user.skillLevel)
        .where("index", ">=", user.nextWords[skillToIdx[user.skillLevel]])
        .where(
          "index",
          "<",
          user.nextWords[skillToIdx[user.skillLevel]] + remainingWordLimit
        )
        .limit(remainingWordLimit)
        .get()

      const words = wordsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      const batch = db.batch()
      const userWordRefs = words.map(() => db.collection("userWords").doc())
      const wordRefs = words.map((word) => db.collection("words").doc(word.id))
      const wordDatas = await Promise.all(wordRefs.map((ref) => ref.get()))

      const newUserWords = words.map((word, i) => ({
        word: wordRefs[i],
        progress: 1,
        userId: userID,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        learned: false,
        difficulty: user.skillLevel,
      }))

      newUserWords.forEach((newUserWord, i) => {
        batch.set(userWordRefs[i], newUserWord)
      })

      await batch.commit()

      if (remainingWordLimit > 0) {
        const freshUser = await fetchUser(userID)
        const nextWords = [...freshUser.nextWords]
        nextWords[skillToIdx[user.skillLevel]] += remainingWordLimit
        await db.collection("users").doc(userID).update({ nextWords })
      }

      const userWordSnapshots = await Promise.all(
        userWordRefs.map((ref) => ref.get())
      )

      const newUserWordsWithIds = userWordSnapshots.map((snapshot, i) => ({
        id: snapshot.id,
        ...newUserWords[i],
        word: wordDatas[i].data(),
      }))

      return [...previouslySeenWords, ...newUserWordsWithIds]
    } catch (error) {
      console.log(error)
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while fetching learning words."
      )
    }
  })

module.exports = getLearningWords
