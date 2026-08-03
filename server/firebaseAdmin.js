import admin from 'firebase-admin';

let isInitialized = false;

// We initialize using default application credentials or env variables
// In production, Render can use GOOGLE_APPLICATION_CREDENTIALS or we parse a JSON string from the environment.
export function initFirebaseAdmin() {
  if (isInitialized) return admin;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not set in environment variables. Firebase Admin will not run.");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isInitialized = true;
    console.log("Firebase Admin SDK initialized successfully.");
    return admin;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

export async function verifyToken(req, res, next) {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    // If Admin isn't configured, bypass auth (e.g., Demo mode)
    // Or we could strict reject. Let's strict reject to enforce Auth gating.
    return res.status(401).json({ error: 'Server authentication is not configured.' });
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
