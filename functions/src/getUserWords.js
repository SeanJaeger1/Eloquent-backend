const functions = require('firebase-functions');
const db = require('./firebaseAdmin');

const getUserWords = functions.https.onCall(async (data, context) => {
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
      .collection('UserWord')
      .where('userId', '==', userID)
      .get();

    const userWords = userWordsSnapshot.docs.map((doc) => doc.data());

    return userWords;
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'Error fetching user words',
    );
  }
});

    module.exports = getUserWords;
