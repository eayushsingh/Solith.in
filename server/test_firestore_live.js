import { initFirebaseAdmin } from './firebaseAdmin.js';

async function testLiveFirestore() {
  console.log('[Test] Validating live Firestore users connection...');
  const admin = initFirebaseAdmin();
  if (!admin) {
    console.error('❌ Failed: Firebase Admin cannot be initialized.');
    process.exit(1);
  }

  const db = admin.firestore();
  const snapshot = await db.collection('users').get();
  console.log(`[Test] Total Firestore users in live database: ${snapshot.size}`);

  if (snapshot.empty) {
    console.error('❌ Failed: Users collection is unexpectedly empty.');
    process.exit(1);
  }

  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Verify real user properties
  const hasRealUsers = users.some(u => u.name && u.name.length > 0 && !u.id.startsWith('mock_'));
  if (!hasRealUsers) {
    console.error('❌ Failed: No real user records detected.');
    process.exit(1);
  }

  console.log(`✅ Success: Verified ${users.length} live users from Firestore.`);
  process.exit(0);
}

testLiveFirestore().catch(err => {
  console.error('❌ Test failed with exception:', err);
  process.exit(1);
});
