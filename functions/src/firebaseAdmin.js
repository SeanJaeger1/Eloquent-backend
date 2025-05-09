import admin from "firebase-admin"
import { createRequire } from "module"
const require = createRequire(import.meta.url)

// Determine environment
const environment = process.env.NODE_ENV === "production" ? "production" : "development"
const keyEnv = process.env.NODE_ENV === "production" ? "prod" : "dev"

// Initialize Firebase Admin
let db

try {
  // Try to load service account if available
  try {
    console.info(`Loading service account for environment: ${keyEnv}`)
    const serviceAccount = require(`../../serviceAccountKey.${keyEnv}.json`)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } catch (error) {
    console.warn(
      `Service account key not found. Using default credentials or emulator: ${error.message}`
    )

    // If running in development mode without service account keys, initialize without credentials
    // This will use emulator if available
    admin.initializeApp()
  }

  db = admin.firestore()
} catch (error) {
  console.error(`Failed to initialize Firebase: ${error.message}`)
  throw error
}

export { db, admin, environment }
