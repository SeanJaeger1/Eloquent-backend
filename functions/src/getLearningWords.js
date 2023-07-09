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

const getLearningWords = functions.region('europe-west1').https.onCall(async (data, context) => {
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

    const batch = db.batch();
    const userWordRefs = words.map(() => db.collection('userWords').doc());
    const wordRefs = words.map(word => db.collection('words').doc(word.id));
    const wordDatas = await Promise.all(wordRefs.map(ref => ref.get()));

    const newUserWords = words.map((word, i) => ({
      word: wordRefs[i],
      progress: 1,
      userId: userID,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    }));

    newUserWords.forEach((newUserWord, i) => {
      batch.set(userWordRefs[i], newUserWord);
    });

    await batch.commit();

    return newUserWords.map((newUserWord, i) => ({
      ...newUserWord,
      word: wordDatas[i].data(), // Return the actual word data
    }));
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while fetching learning words.',
    );
  }
});

module.exports = getLearningWords;
