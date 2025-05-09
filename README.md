# Eloquent Backend

Backend services for the Eloquent language learning application.

## Environment Setup

This project is configured with multiple environments (development and production) to support different stages of the development lifecycle.

### Key Features

- **Multiple Firebase Projects**: Development and production environments are mapped to separate Firebase projects
- **Environment-Specific Configuration**: Different CORS, logging, and other settings based on environment
- **Service Account Key Management**: Separate service account keys for development and production

### Prerequisites

- Node.js 18 or higher
- Firebase CLI
- Service account keys (see below)

### Service Account Keys

For deployment to Firebase, you'll need environment-specific service account keys:

1. **Development**: `functions/serviceAccountKey.dev.json`
2. **Production**: `functions/serviceAccountKey.prod.json`

You can get these files from the Firebase console:

1. Go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the file as appropriate (dev/prod) in the functions directory

Example files are provided:
- `functions/serviceAccountKey.dev.json.example`
- `functions/serviceAccountKey.prod.json.example`

Simply copy these files, remove the `.example` suffix, and replace the placeholder values with your actual service account information.

**Note**: When running with the Firebase emulator, the service account keys are not required. The application will automatically fall back to using the emulator connection.

### Running the Application

#### Development Environment

```bash
# Run emulators with development configuration
npm run serve:dev

# Deploy to development environment
npm run deploy:dev
```

#### Production Environment

```bash
# Run emulators with production configuration
npm run serve:prod

# Deploy to production environment
npm run deploy:prod
```

## Project Structure

- `/functions` - Firebase Cloud Functions
  - `/src` - Source code for cloud functions
    - `/utils` - Shared utilities
    - `config.js` - Environment-specific configuration
    - `firebaseAdmin.js` - Firebase initialization with environment support

## Configuration

Environment-specific configuration is managed in `functions/src/utils/config.js`.