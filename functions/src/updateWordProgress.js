const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = require('./firebaseAdmin');

const updateWordProgress = functions.region('europe-west1').https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User is not authenticated.',
    );
  }

  try {
    const { userWordId, increment } = data;
    const userWordRef = db.collection('userWords').doc(userWordId);
    const userWordSnapshot = await userWordRef.get();
    const userWordData = userWordSnapshot.data();
    const updatedProgress = (increment === 1) ? Math.min(5, userWordData.progress + increment) : Math.max(1, userWordData.progress + increment)
    await userWordRef.update({
      progress: updatedProgress,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while updating/creating user word.',
    );
  }
});

module.exports = updateWordProgress;
