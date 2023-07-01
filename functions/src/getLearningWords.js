const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = require('./firebaseAdmin');

const getLearningWords = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to fetch learning words.',
    );
  }

  const userID = context.auth.uid;

  try {
    // Define the timestamp for 15 minutes ago
    const fifteenMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 1000 * 60 * 15),
    );

    // Fetch the UserWords for the current user that were last seen more than 15 minutes ago
    const userWordsSnapshot = await db
      .collection('UserWord')
      .where('userId', '==', userID)
      .where('lastSeenAt', '<', fifteenMinutesAgo)
      .orderBy('lastSeenAt', 'desc')
      .limit(15)
      .get();

    const totalUserWordsSnapshot = await db
      .collection('UserWord')
      .where('userId', '==', userID)
      .get();

    const userWords = userWordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Create a Set of the ids of the Word documents corresponding to the UserWord documents
    const userWordIds = new Set(
      totalUserWordsSnapshot.docs.map((doc) => doc.id),
    );

    // Fetch all Word documents
    const allWordsSnapshot = await db.collection('Word').get();

    // Filter out the Word documents that have corresponding UserWord documents for the current user
    const unseenWords = allWordsSnapshot.docs
      .filter((doc) => !userWordIds.has(doc.id))
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    // Combine old and new words, excluding UserWords seen in the last 15 minutes
    const wordsToShow = [...userWords, ...unseenWords].slice(0, 15);

    return wordsToShow;
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'Error fetching learning words',
    );
  }
});

module.exports = getLearningWords;
