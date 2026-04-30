import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
} = import.meta.env;

const isConfigured =
  VITE_FIREBASE_API_KEY &&
  VITE_FIREBASE_AUTH_DOMAIN &&
  VITE_FIREBASE_PROJECT_ID &&
  VITE_FIREBASE_APP_ID;

let _app: FirebaseApp | null = null;

if (isConfigured) {
  _app = initializeApp({
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  });
}

export const auth: Auth | null = _app ? getAuth(_app) : null;
export const db: Firestore | null = _app
  ? initializeFirestore(_app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;
export const functions: Functions | null = _app ? getFunctions(_app, 'us-central1') : null;
export const storage: FirebaseStorage | null = _app ? getStorage(_app) : null;
