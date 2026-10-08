import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase Client Configuration
 *
 * Reads configuration from EXPO_PUBLIC_FIREBASE_* environment variables.
 * In Expo SDK, variables prefixed with EXPO_PUBLIC_ are automatically embedded
 * at build time.
 */

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

/**
 * Checks whether Firebase credentials have been configured in .env
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID'
  );
}

// ─── Firebase Singletons ───────────────────────────────────────────────────────

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('[Firebase] Initialized successfully for project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('[Firebase] Initialization warning:', error);
  }
} else {
  console.log('[Firebase] Not configured yet. Running in offline/local storage mode.');
}

export { app as firebaseApp, db as firestoreDb, auth as firebaseAuth };

