import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDDqQv4-gczAYqNghyIxq14XKlaHFFM0bs",
  authDomain: "solith-df915.firebaseapp.com",
  projectId: "solith-df915"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function runTests() {
  console.log("Signing in anonymously...");
  const userCredential = await signInAnonymously(auth);
  const uid = userCredential.user.uid;
  console.log(`Signed in as: ${uid}\n`);

  // Test 1: Try to grant ourselves admin role
  try {
    console.log("Test 1: Attempting to write { role: 'admin' } to own user document...");
    await setDoc(doc(db, 'users', uid), { role: 'admin' }, { merge: true });
    console.log("❌ Test 1 FAILED! The write succeeded (Rules are NOT protecting the role field).");
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log("✅ Test 1 PASSED! Write was rejected by security rules.");
    } else {
      console.log("❓ Test 1 errored for another reason:", error.message);
    }
  }

  // Test 2: Try to read reports
  try {
    console.log("\nTest 2: Attempting to read the /reports collection...");
    await getDocs(collection(db, 'reports'));
    console.log("❌ Test 2 FAILED! The read succeeded (Rules are NOT protecting reports).");
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log("✅ Test 2 PASSED! Read was rejected by security rules.");
    } else {
      console.log("❓ Test 2 errored for another reason:", error.message);
    }
  }

  // Test 3: Try to read public profile
  try {
    console.log("\nTest 3: Attempting to read own profile...");
    await getDoc(doc(db, 'users', uid));
    console.log("✅ Test 3 PASSED! Read was allowed by security rules.");
  } catch (error) {
    console.log("❌ Test 3 FAILED! Read was denied:", error.message);
  }

  console.log("\nTests complete. Exiting...");
  process.exit(0);
}

runTests().catch(console.error);
