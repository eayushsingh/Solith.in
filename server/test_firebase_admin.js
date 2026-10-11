import { initFirebaseAdmin } from './firebaseAdmin.js';

async function verify() {
  console.log('[Test] Running Firebase Admin diagnostic test...');
  const admin = initFirebaseAdmin();
  if (!admin) {
    console.error('❌ Diagnostic test failed: Firebase Admin returned null');
    process.exit(1);
  }

  try {
    const db = admin.firestore();
    const snap = await db.collection('users').limit(5).get();
    console.log(`✅ Diagnostic test passed: Connected to Firestore! Sample users count: ${snap.size}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Diagnostic test failed on Firestore query:', err.message);
    process.exit(1);
  }
}

verify();
