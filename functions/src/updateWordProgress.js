const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = require('./firebaseAdmin');

const updateWordProgress = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User is not authenticated.',
    );
  }

  const { userWordId, increment } = data;
  const userId = context.auth.uid;

  try {
    const userWordRef = db.collection('UserWord').doc(userWordId);

    // Check if the user word exists
    const userWordSnapshot = await userWordRef.get();

    if (userWordSnapshot.exists) {
      // User word exists, update the progress
      const userWordData = userWordSnapshot.data();
      const progress = userWordData.progress || 0;
      const updatedProgress = Math.max(1, Math.min(progress + increment, 5));

      await userWordRef.update({
        progress: updatedProgress,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: 'User word progress updated successfully.',
      };
    }
    // User word doesn't exist, create a new user word
    const wordRef = db.collection('Word').doc(userWordId);
    const wordSnapshot = await wordRef.get();

    if (!wordSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Word not found.');
    }

    const wordData = wordSnapshot.data();
    const newUserWord = {
      word: wordData,
      progress: Math.max(1, increment),
      userId,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await userWordRef.set(newUserWord);

    return { success: true, message: 'User word created successfully.' };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while updating/creating user word.',
    );
  }
});

module.exports = updateWordProgress;
