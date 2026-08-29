import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';

// Read and validate Firebase configuration from client environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
};

// Initialize Firebase client app singleton
let firebaseApp: FirebaseApp | null = null;
let firebaseAnalytics: Analytics | null = null;

if (isFirebaseConfigured()) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    if (typeof window !== 'undefined') {
      isAnalyticsSupported().then(supported => {
        if (supported && firebaseApp) {
          firebaseAnalytics = getAnalytics(firebaseApp);
        }
      }).catch(err => {
        console.warn('[Firebase] Analytics support check notice:', err);
      });
    }
  } catch (err) {
    console.error('[Firebase] Failed to initialize client app:', err);
  }
} else {
  console.warn('[Firebase] Missing required Firebase configuration in environment variables.');
}

export { firebaseApp, firebaseAnalytics, firebaseConfig };
