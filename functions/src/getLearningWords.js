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
    const previouslySeenWordsSnapshot = await db
      .collection('userWords')
      .where('userId', '==', userID)
      .where('progress', '!=', 5)
      .where('difficulty', '==', user.skillLevel)
      .limit(wordLimit)
      .get();

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const previouslySeenWords = previouslySeenWordsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => doc.lastSeenAt.toDate() < fifteenMinutesAgo);

    if (previouslySeenWords.length === wordLimit) {
      return previouslySeenWords;
    }

    const remainingWordLimit = wordLimit - previouslySeenWords.length;

    const skillToIdx = {
      beginner: 0,
      intermediate: 1,
      advanced: 2,
      expert: 3,
    };

    const wordsSnapshot = await db
      .collection('words')
      .where('difficulty', '==', user.skillLevel)
      .where('index', '>=', user.nextWords[skillToIdx[user.skillLevel]])
      .where('index', '<=', user.nextWords[skillToIdx[user.skillLevel]] + remainingWordLimit)
      .limit(remainingWordLimit)
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

    if (remainingWordLimit > 0) {
      // Make a fresh fetch of user data
      const freshUser = await fetchUser(userID);
      // Copy nextWords array
      const nextWords = [...freshUser.nextWords];
      // Increment the value at the specific index
      nextWords[skillToIdx[user.skillLevel]] += remainingWordLimit;
      // Update the user document with the new nextWords array
      await db.collection('users').doc(userID).update({ nextWords });
    }

    const userWordSnapshots = await Promise.all(userWordRefs.map(ref => ref.get()));

    const newUserWordsWithIds = userWordSnapshots.map((snapshot, i) => ({
      id: snapshot.id,
      ...newUserWords[i],
      word: wordDatas[i].data(), // Return the actual word data
    }));

    return [...previouslySeenWords, ...newUserWordsWithIds];
  } catch (error) {
    console.log(error)
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while fetching learning words.',
    );
  }
});

module.exports = getLearningWords;
