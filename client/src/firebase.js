import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, onSnapshot, limit, getCountFromServer, deleteDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
// Replace these with your actual Firebase project config in .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDDqQv4-gczAYqNghyIxq14XKlaHFFM0bs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "solith-df915.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "solith-df915",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "solith-df915.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "476235922953",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:476235922953:web:7888a2ba62ac6cb72982d8"
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

export { auth, db, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, onSnapshot, limit, getCountFromServer, deleteDoc };
