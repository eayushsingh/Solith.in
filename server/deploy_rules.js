import fs from 'fs';
import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function deployRules() {
  try {
    const rulesSource = fs.readFileSync('../firestore.rules', 'utf8');
    
    await admin.securityRules().releaseFirestoreRulesetFromSource(rulesSource);
    console.log('Successfully released Firestore rules!');
    process.exit(0);
  } catch (error) {
    console.error('Error deploying rules:', error);
    process.exit(1);
  }
}

deployRules();
