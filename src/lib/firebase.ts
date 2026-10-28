import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || (process.env as any) || {};

// Firebase configuration provided for helix-41861 with fallback to env
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCJ-r4RxGHIQklYGQU7Yf4DS_3tPbK9SgA",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "helix-41861.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "helix-41861",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "helix-41861.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "225247638207",
  appId: env.VITE_FIREBASE_APP_ID || "1:225247638207:web:de6294ff62562e30a14c0a",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-Z3VRKNVZ3J",
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
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let googleAuthProvider: GoogleAuthProvider;
let firebaseAnalytics: Analytics | null = null;

if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

firebaseAuth = getAuth(firebaseApp);
googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

if (typeof window !== 'undefined') {
  isAnalyticsSupported().then(supported => {
    if (supported && firebaseApp) {
      firebaseAnalytics = getAnalytics(firebaseApp);
    }
  }).catch(err => {
    console.warn('[Firebase] Analytics support check notice:', err);
  });
}

export { firebaseApp, firebaseAuth as auth, googleAuthProvider as googleProvider, firebaseAnalytics };

