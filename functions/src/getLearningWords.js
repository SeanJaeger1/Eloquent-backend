const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = require('./firebaseAdmin');

// Fetches user words based on specific conditions
async function fetchUserWords(userID, timestamp) {
  return db
    .collection('UserWord')
    .where('userId', '==', userID)
    .where('lastSeenAt', '<', timestamp)
    .orderBy('lastSeenAt', 'desc')
    .limit(15)
    .get();
}

// Fetches total user words
async function fetchTotalUserWords(userID) {
  return db
    .collection('UserWord')
    .where('userId', '==', userID)
    .get();
}

// Fetches all word documents
async function fetchAllWords() {
  return db.collection('Word').get();
}

const getLearningWords = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to fetch learning words.',
    );
  }

  const userID = context.auth.uid;

  try {
    const fifteenMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 1000 * 60 * 15),
    );

    const userWordsSnapshot = await fetchUserWords(userID, fifteenMinutesAgo);
    const totalUserWordsSnapshot = await fetchTotalUserWords(userID);
    const allWordsSnapshot = await fetchAllWords();

    const userWords = userWordsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const userWordIds = new Set(
      totalUserWordsSnapshot.docs.map((doc) => doc.id),
    );

    const unseenWords = allWordsSnapshot.docs
      .filter((doc) => !userWordIds.has(doc.id))
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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
