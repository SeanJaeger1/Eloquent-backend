// Environment configuration for the Firebase Cloud Functions

// Import the environment from firebaseAdmin
import { environment } from "../firebaseAdmin.js"

// Common configuration for all environments
const commonConfig = {
  region: "europe-west1",
  timeoutSettings: {
    FIFTEEN_MINUTES: 15 * 60 * 1000,
  },
  wordLimits: {
    default: 5,
  },
}

// Environment-specific configurations
const envConfig = {
  development: {
    cors: ["http://localhost:8081", "http://localhost:3000"],
    logging: {
      level: "debug",
      verbose: true,
    },
  },
  production: {
    cors: ["https://learn-eloquent.com"],
    logging: {
      level: "error",
      verbose: false,
    },
  },
}

// Combine configurations
const config = {
  ...commonConfig,
  ...envConfig[environment],
}

export default config
