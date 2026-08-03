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

export async function verifyAdmin(req, res, next) {
  // First, run standard token verification
  verifyToken(req, res, async () => {
    // If verifyToken succeeded, req.user will be populated
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance || !req.user) {
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
