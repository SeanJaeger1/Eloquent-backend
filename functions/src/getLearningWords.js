const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = require('./firebaseAdmin');

async function fetchUser(userID) {
  const userSnapshot = await db.collection('users').where('uid', '==', userID).get();
  const userDoc = userSnapshot.docs[0];
  if (!userDoc.exists) {
    throw new Error(`User ${userID} not found.`);
  }
  const userData = userDoc.data();
  return userData;
}

const getLearningWords = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to fetch learning words.',
    );
  }

  const wordLimit = 10;

  const userID = context.auth.uid;

  const user = await fetchUser(userID);

  try {
    // get user words needed

    // if extra space, add more words
    const wordsSnapshot = await db
      .collection('words')
      .where('difficulty', '==', user.skillLevel)
      .where('index', '>=', user.nextWords[2])
      .where('index', '<=', user.nextWords[2] + wordLimit)
      .limit(wordLimit)
      .get();

    const words = wordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const userWords = await Promise.all(words.map(async (word) => {
      const wordRef = db.collection('words').doc(word.id);
      const userWordRef = db.collection('userWords').doc();
      const wordData = await wordRef.get();
      const newUserWord = {
        word: wordRef,
        progress: 1,
        userId: userID,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await userWordRef.set(newUserWord);
      return {
        ...newUserWord,
        word: wordData.data(),  // Return the actual word data
      };
    }));

    return {
      userWords: await Promise.all(userWords),
    };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while fetching learning words.',
    );
  }
});

module.exports = getLearningWords;
