import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

let adminInstance = null;
const isProduction = process.env.NODE_ENV === 'production';

function decodeJwtPayload(idToken) {
  const payloadSegment = idToken.split('.')[1];
  if (!payloadSegment) return null;

  const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

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
  const authHeader = req.headers.authorization;
  const idToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : req.query.token;
  const adminInstance = initFirebaseAdmin();

  if (!adminInstance) {
    if (isProduction) {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }

    console.warn('Bypassing verifyToken - no Firebase Admin SDK');
    if (idToken) {
      const payload = decodeJwtPayload(idToken);
      if (payload) {
        req.user = { ...payload, uid: payload.user_id || payload.uid || 'local-dev-user' };
      } else {
        req.user = { uid: 'local-dev-user', email: 'ayushfun01@gmail.com', name: 'Local Admin' };
      }
    } else {
      req.user = { uid: 'local-dev-user', email: 'ayushfun01@gmail.com', name: 'Local Admin' };
    }
    return next();
  }

  if (!idToken) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const decodedToken = await adminInstance.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

export const verifyAdmin = async (req, res, next) => {
  const ADMIN_EMAILS = [
    'ayushfun01@gmail.com',
    'hacksejeet@gmail.com',
    'ayush.singh.something@klh.edu.in',
    'ayushsinghe07@gmail.com'
  ];

  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  // Check by email
  if (ADMIN_EMAILS.includes(req.user.email)) return next();

  // Check by Firestore role
  try {
    const adminInstance = initFirebaseAdmin();
    if (adminInstance) {
      const db = adminInstance.firestore();
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') return next();
    }
  } catch (e) {
    console.error('Admin check error:', e);
  }

  return res.status(403).json({ error: 'Forbidden: Admin access required' });
};
