/**
 * Firebase Firestore Error Classifier and Formatter
 */

export function parseFirebaseError(err) {
  if (!err) return { title: 'Unknown Error', message: 'An unexpected connection error occurred.', retryable: true };

  const code = err.code || '';
  const msg = err.message || String(err);

  if (code === 'permission-denied' || msg.includes('permission')) {
    return {
      title: 'Access Restricted',
      message: 'Firestore security rules restricted read access. Using backend fallback.',
      retryable: false
    };
  }

  if (code === 'unavailable' || msg.includes('offline') || msg.includes('network')) {
    return {
      title: 'Network Offline',
      message: 'Unable to reach Firebase servers. Displaying cached data.',
      retryable: true
    };
  }

  if (code === 'resource-exhausted' || msg.includes('quota')) {
    return {
      title: 'Quota Exceeded',
      message: 'Firebase project quota reached. Backend server fallback activated.',
      retryable: false
    };
  }

  if (msg.includes('Firebase connection failed') || msg.includes('config')) {
    return {
      title: 'Firebase Connection Issue',
      message: 'Could not connect directly to Firestore. Serving leaderboard via backend API.',
      retryable: true
    };
  }

  return {
    title: 'Connection Error',
    message: msg || 'Firebase data stream failed.',
    retryable: true
  };
}

export function logLeaderboardEvent(eventName, payload = {}) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Telemetry][Leaderboard] ${eventName}:`, payload);
    }
  } catch (e) {
    // Ignore telemetry errors
  }
}
