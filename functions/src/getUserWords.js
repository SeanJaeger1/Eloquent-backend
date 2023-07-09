const functions = require('firebase-functions');
const db = require('./firebaseAdmin');

const getUserWords = functions.region('europe-west1').https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to fetch user words.',
    );
  }

  const userID = context.auth.uid;

  try {
    const userWordsSnapshot = await db
      .collection('userWords')
      .where('userId', '==', userID)
      .get();

    const userWords = await Promise.all(userWordsSnapshot.docs.map(async (doc) => {
      const wordRef = doc.data().word;
      const wordSnapshot = await wordRef.get();
      const wordData = wordSnapshot.data();
      return {
        id: doc.id,
        word: wordData,
        progress: doc.data().progress,
        lastSeenAt: doc.data().lastSeenAt,
      };
    }));

    return userWords;
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'Error fetching user words',
    );
  }
});

module.exports = getUserWords;
