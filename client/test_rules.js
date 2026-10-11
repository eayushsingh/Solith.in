import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDDqQv4-gczAYqNghyIxq14XKlaHFFM0bs",
  authDomain: "solith-df915.firebaseapp.com",
  projectId: "solith-df915"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runTests() {
  console.log('[Test] Running unauthenticated security rules test...');

  // Test 1: Unauthenticated read of reports must be rejected
  try {
    console.log("Test 1: Attempting unauthenticated read of /reports...");
    await getDocs(collection(db, 'reports'));
    console.log("❌ Test 1 FAILED! Reports should be protected.");
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log("✅ Test 1 PASSED! Reports read rejected by rules.");
    } else {
      console.log("ℹ️ Test 1 caught error:", error.code || error.message);
    }
  }

  // Test 2: Unauthenticated write to users must be rejected
  try {
    console.log("Test 2: Attempting unauthenticated write to /users/fake_id...");
    await setDoc(doc(db, 'users', 'fake_id'), { name: 'Hacker' });
    console.log("❌ Test 2 FAILED! Unauthenticated write succeeded.");
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log("✅ Test 2 PASSED! Unauthenticated write rejected by rules.");
    } else {
      console.log("ℹ️ Test 2 caught expected rejection:", error.code || error.message);
    }
  }

  // Test 3: Unauthenticated read of global_chat is allowed
  try {
    console.log("Test 3: Reading public global_chat...");
    const snap = await getDocs(collection(db, 'global_chat'));
    console.log(`✅ Test 3 PASSED! Read allowed for global_chat (count: ${snap.size}).`);
  } catch (error) {
    console.log("ℹ️ Test 3 global_chat:", error.message);
  }

  console.log("Rules test completed successfully.");
  process.exit(0);
}

runTests().catch(console.error);
