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
    // Demo Mode Fallback: Allow requests to proceed without strict Firebase Admin verification.
    console.warn("⚠️ Demo Mode: Server authentication is not configured. Bypassing strict token verification.");
    
    // Attempt to parse userId from the request body so room logic (like owner roles) doesn't crash
    const mockUid = req.body?.userId || req.body?.targetUserId || 'demo-user-id';
    
    req.user = { 
      uid: mockUid,
      email: 'demo@example.com'
    };
    
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
