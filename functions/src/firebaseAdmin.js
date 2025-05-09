import admin from "firebase-admin"
import serviceAccountDev from "../serviceAccountKey.dev.json"
import serviceAccountProd from "../serviceAccountKey.prod.json"

// Determine environment
const environment = process.env.NODE_ENV === "production" ? "production" : "development"
const serviceAccount = environment === "production" ? serviceAccountProd : serviceAccountDev

// Initialize Firebase Admin
let db

try {
  try {
    console.info(`Loading service account for environment: ${environment}`)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } catch (error) {
    console.warn(
      `Service account key not found. Using default credentials or emulator: ${error.message}`
    )
    // Fallback to default initialization (uses emulator if available)
    admin.initializeApp()
  }

  db = admin.firestore()
} catch (error) {
  console.error(`Failed to initialize Firebase: ${error.message}`)
  throw error
}

export { db, admin, environment }
