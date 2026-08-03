import { initFirebaseAdmin } from './firebaseAdmin.js';
import dotenv from 'dotenv';

dotenv.config();

const adminEmails = ['ayushfun01@gmail.com', 'hacksejeet@gmail.com', 'ayush.singh.something@klh.edu.in'];

async function makeAdmins() {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    console.error("Firebase Admin SDK not initialized.");
    process.exit(1);
  }

  const db = adminInstance.firestore();
  
  for (const email of adminEmails) {
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).get();
      
      if (snapshot.empty) {
        console.log(`User with email ${email} not found.`);
        continue;
      }
      
      for (const doc of snapshot.docs) {
        await doc.ref.update({ role: 'admin' });
        console.log(`Successfully set role: 'admin' for ${email} (ID: ${doc.id})`);
      }
    } catch (e) {
      console.error(`Failed to update ${email}:`, e);
    }
  }
  
  console.log("Done.");
  process.exit(0);
}

makeAdmins();
