import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';

// Your web app's Firebase configuration
// Replace these with your actual Firebase project config in .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if config is present (prevents crash on first load without env vars)
let app, auth, db, googleProvider;

if (firebaseConfig.apiKey) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  
  // Attempt local persistence, fallback to memory if blocked (e.g. Incognito / Extensions)
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Local persistence failed, falling back to in-memory:", error);
    setPersistence(auth, inMemoryPersistence).catch(console.error);
  });

  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} else {
  console.warn("Firebase configuration is missing! Please add VITE_FIREBASE_* variables to your client/.env file.");
}

export { auth, db, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove };
