const db = require("../firebaseAdmin.js")

async function fetchUser(userID) {
  const userSnapshot = await db
    .collection("users")
    .where("uid", "==", userID)
    .get()
  const userDoc = userSnapshot.docs[0]
  if (!userDoc.exists) {
    throw new Error(`User ${userID} not found.`)
  }
  const userData = userDoc.data()
  return userData
}

module.exports = { fetchUser }
