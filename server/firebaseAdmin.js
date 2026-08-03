import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

let adminInstance = null;

export const initFirebaseAdmin = () => {
  if (adminInstance) return adminInstance;

  try {
    let serviceAccount;
    const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      console.log(chalk.blue('Found firebase-service-account.json file. Using it for Firebase Admin...'));
      const fileContent = fs.readFileSync(serviceAccountPath, 'utf-8');
      serviceAccount = JSON.parse(fileContent);
    } else {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!serviceAccountJson) {
        console.warn(chalk.yellow("⚠ FIREBASE_SERVICE_ACCOUNT_JSON is not set and firebase-service-account.json file not found. Firebase Admin will not run. Using mock data."));
        return null;
      }
      serviceAccount = JSON.parse(serviceAccountJson);
    }

    adminInstance = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log(chalk.green.bold("✓ Firebase Admin initialized successfully."));
    return adminInstance;
  } catch (error) {
    console.error(chalk.red.bold("✗ Failed to initialize Firebase Admin:"), error.message);
    return null;
  }
};

export async function verifyToken(req, res, next) {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Internal Server Error: Firebase Admin SDK not initialized in production.' });
    }
    // Local dev bypass when no service account is provided
    console.warn("Bypassing verifyToken - no Firebase Admin SDK");
    req.user = { uid: 'local-dev-user', email: 'ayushfun01@gmail.com', name: 'Local Admin' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminInstance.auth().verifyIdToken(idToken);
    req.user = decodedToken; // attach user payload to request
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export async function verifyAdmin(req, res, next) {
  // First, run standard token verification
  verifyToken(req, res, async () => {
    // If verifyToken succeeded, req.user will be populated
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Internal Server Error: Firebase Admin SDK not initialized in production.' });
      }
      console.warn("Bypassing verifyAdmin - no Firebase Admin SDK");
      req.adminData = { role: 'admin', email: 'ayushfun01@gmail.com', id: 'local-dev-user' };
      return next();
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const db = adminInstance.firestore();
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      
      if (!userDoc.exists) {
        return res.status(403).json({ error: 'Forbidden: User not found in database' });
      }

      const userData = userDoc.data();
      if (userData.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // User is verified as admin
      req.adminData = userData; 
      next();
    } catch (error) {
      console.error('Error verifying admin role:', error);
      res.status(500).json({ error: 'Internal server error during role verification' });
    }
  });
}
