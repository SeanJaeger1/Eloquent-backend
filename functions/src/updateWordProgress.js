const admin = require("firebase-admin")
const { db } = require("./firebaseAdmin")
const { onCall } = require("firebase-functions/v2/https")

const updateWordProgress = onCall(
  {
    region: "europe-west1",
    cors: ["https://learn-eloquent.com", "http://localhost:8081"],
  },
  async (request) => {
    if (!request.auth) {
      throw new Error("unauthenticated", "User is not authenticated.")
    }

    const data = request.data
    const { userWordId, increment } = data

    // Input validation
    if (!userWordId || typeof userWordId !== "string") {
      throw new Error("invalid-argument", "Invalid userWordId provided")
    }

    if (increment !== 1 && increment !== -1) {
      throw new Error("invalid-argument", "Increment must be 1 or -1")
    }

    try {
      // Use a transaction for atomic operations
      return await db.runTransaction(async (transaction) => {
        const userWordRef = db.collection("userWords").doc(userWordId)
        const userWordDoc = await transaction.get(userWordRef)

        if (!userWordDoc.exists) {
          throw new Error("not-found", "User word not found")
        }

        const userWordData = userWordDoc.data()

        // Validate the user owns this word
        if (userWordData.userId !== request.auth.uid) {
          throw new Error("permission-denied", "You don't have permission to update this word")
        }

        const updatedProgress =
          increment === 1
            ? Math.min(5, userWordData.progress + 1)
            : Math.max(1, userWordData.progress - 1)

        const updates = {
          progress: updatedProgress,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        }

        // Handle special cases
        if (userWordData.lastSeenAt === null && increment === 1) {
          updates.alreadyKnown = true
        }

        if (updatedProgress === 5) {
          updates.learned = true
        }

        transaction.update(userWordRef, updates)

        return { success: true, newProgress: updatedProgress }
      })
    } catch (error) {
      console.error("Error in updateWordProgress:", error)
      throw new Error(
        "internal",
        `Failed to update word progress: ${error.message || "Unknown error"}`
      )
    }
  }
)

module.exports = updateWordProgress
