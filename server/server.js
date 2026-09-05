import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { AccessToken, RoomServiceClient, WebhookReceiver, AgentDispatchClient } from 'livekit-server-sdk';
import { createServer } from 'http';
import { Server } from 'socket.io';
import admin from 'firebase-admin';
import { initFirebaseAdmin, verifyToken, verifyAdmin } from './firebaseAdmin.js';
import chalk from 'chalk';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
app.set('trust proxy', 1); // Trust only the first proxy hop (Render) to prevent express-rate-limit from crashing with ERR_ERL_PERMISSIVE_TRUST_PROXY
const server = createServer(app);

// CORS configuration - allow only explicit origins in production
let corsOptions;
if (process.env.NODE_ENV === 'production') {
  const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (!allowedOrigins.includes('https://www.solith.in')) allowedOrigins.push('https://www.solith.in');
  if (!allowedOrigins.includes('https://solith.in')) allowedOrigins.push('https://solith.in');

  corsOptions = { origin: allowedOrigins };
} else {
  corsOptions = { origin: '*' };
}

const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,        // 60s — tolerates background tab throttling
  pingInterval: 25000,       // 25s heartbeat
  transports: ['polling', 'websocket'], // Match client: start with polling, upgrade to websocket
  allowUpgrades: true,
});

app.use(helmet()); // Set basic HTTP security headers
app.use(cors(corsOptions));

// Apply global rate limiting (100 reqs / 15 mins per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000, // Massively increased to prevent false positive blocks
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// In-Memory Configuration (fallback/runtime update)
let runtimeConfig = {
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  livekitUrl: process.env.LIVEKIT_URL || ''
};

console.log('[config] LIVEKIT_URL:', runtimeConfig.livekitUrl);
console.log('[config] LIVEKIT_API_KEY set:', !!runtimeConfig.livekitApiKey);
console.log('[config] LIVEKIT_API_SECRET set:', !!runtimeConfig.livekitApiSecret);

// Rooms Database State
let rooms = [];

// In-memory cache to reduce Firestore reads (Bug 2 fix)
let cachedSettings = null;
let cachedSettingsTime = 0;
let cachedUserCount = 0;
let cachedUserCountTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const socketToIdentity = new Map();
const authenticatedOnline = new Set();
const disconnectTimers = new Map(); // identity -> timeout (grace period before removing participant)

const ROOM_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes

const purgeEmptyRooms = () => {
  const now = Date.now();
  const before = rooms.length;

  rooms = rooms.filter(room => {
    if (room.participants && room.participants.length > 0) {
      // Room has people — keep it, reset emptySince
      room.emptySince = null;
      return true;
    }
    // Room is empty
    if (!room.emptySince) {
      // First time we notice it's empty — start the timer
      room.emptySince = now;
      return true; // keep for now
    }
    // Check if grace period has passed
    const emptyDuration = now - room.emptySince;
    if (emptyDuration < ROOM_GRACE_PERIOD_MS) {
      return true; // still within grace period, keep it
    }
    // Grace period expired — delete
    console.log(`[purge] Room ${room.id} empty for ${Math.round(emptyDuration/60000)} mins — deleting`);
    return false;
  });

  const after = rooms.length;
  if (before !== after) {
    console.log(`[purge] Removed ${before - after} room(s). ${after} remain.`);
    saveDB();
  }
};

// Load rooms from Firestore or fallback to db.json if exists
const setAdminRoles = async () => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return;
  const db = adminInstance.firestore();
  const adminEmails = [
    'ayushfun01@gmail.com',
    'ayushsinghe07@gmail.com'
  ];
  try {
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (adminEmails.includes(data.email) && data.role !== 'admin') {
        await db.collection('users').doc(userDoc.id).update({ role: 'admin', isPremium: true });
        console.log(`✓ Set admin role for ${data.email}`);
      }
    }
  } catch (e) {
    console.warn(`[Firestore] setAdminRoles skipped: ${e.message}`);
  }
};

const fixStoredRoomUrls = async () => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return;
  try {
    const db = adminInstance.firestore();
    const snapshot = await db.collection('rooms').get();
    const batch = db.batch();
    let fixed = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.livekitUrl && data.livekitUrl !== runtimeConfig.livekitUrl) {
        batch.update(doc.ref, { livekitUrl: runtimeConfig.livekitUrl });
        fixed++;
      }
    });
    if (fixed > 0) {
      await batch.commit();
      console.log(`[fix] Updated livekitUrl in ${fixed} stored rooms`);
    }
    // Also fix in-memory rooms
    rooms.forEach(r => { r.livekitUrl = runtimeConfig.livekitUrl; });
  } catch (e) {
    console.error('[fix] fixStoredRoomUrls error:', e.message);
  }
};

const loadDB = async () => {
  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const db = adminInstance.firestore();
      const snapshot = await db.collection('rooms').get();
      rooms = snapshot.docs.map(doc => doc.data());
      console.log(`✓ Loaded ${rooms.length} rooms from Firestore.`);
      
      // Load LiveKit config
      const livekitSnap = await db.collection('settings').doc('livekit').get();
      if (livekitSnap.exists) {
        const data = livekitSnap.data();
        if (data.livekitApiKey) runtimeConfig.livekitApiKey = data.livekitApiKey;
        if (data.livekitApiSecret) runtimeConfig.livekitApiSecret = data.livekitApiSecret;
        if (data.livekitUrl) runtimeConfig.livekitUrl = data.livekitUrl;
        console.log(`✓ Loaded LiveKit configuration from Firestore.`);
      }
      
      await setAdminRoles();
      await fixStoredRoomUrls();
      
      // Fix any rooms with wrong LiveKit URL
      const correctUrl = runtimeConfig.livekitUrl;
      if (correctUrl) {
        let fixed = 0;
        rooms.forEach(room => {
          if (room.livekitUrl && room.livekitUrl !== correctUrl) {
            room.livekitUrl = correctUrl;
            fixed++;
          }
        });
        if (fixed > 0) {
          console.log(`[startup] Fixed livekitUrl in ${fixed} in-memory rooms`);
          saveDB();
        }
      }
      
      return;
    } catch (err) {
      console.warn(`[Firestore] Error loading rooms (fallback to local DB): ${err.message}`);
    }
  }
  loadLocalDB();
};

const loadLocalDB = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      rooms = JSON.parse(data);
    } else {
      rooms = [];
    }
  } catch (err) {
    console.error('Error loading DB, initializing empty rooms list:', err);
    rooms = [];
  }
};

const broadcastRoomsUpdated = () => {
  if (io) {
    io.emit('rooms-updated', { rooms: rooms.filter(r => r.accessType !== 'invite') });
  }
};

const saveDB = async () => {
  broadcastRoomsUpdated();
  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const db = adminInstance.firestore();
      const roomsCol = db.collection('rooms');
      const currentIds = rooms.map(r => r.id);
      
      const snapshot = await roomsCol.get();
      const deletePromises = [];
      snapshot.docs.forEach(doc => {
        if (!currentIds.includes(doc.id)) {
          deletePromises.push(roomsCol.doc(doc.id).delete());
        }
      });

      const savePromises = rooms.map(room => roomsCol.doc(room.id).set(room));
      await Promise.all([...deletePromises, ...savePromises]);
    } catch (err) {
      console.error('Error syncing rooms to Firestore:', err);
    }
  } else {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(rooms, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing to DB:', err);
    }
  }
  broadcastRoomsUpdated();
};

const evictStalePingParticipants = () => {
  const now = Date.now();
  let changed = false;
  rooms.forEach(room => {
    if (!room.participants) return;
    const before = room.participants.length;
    room.participants = room.participants.filter(p => {
      if (p == null || p.id == null) return false;
      // Evict participants whose last ping is older than 30 seconds
      return !(p.lastPing && (now - p.lastPing > 30000));
    });
    if (room.participants.length !== before) changed = true;
  });
  if (changed) {
    console.log('[evictStalePing] Evicted stale participants.');
    purgeEmptyRooms();
  }
};
setInterval(evictStalePingParticipants, 15000);

const processMonthlyAwards = async () => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return;

  try {
    const db = adminInstance.firestore();
    const awardsRef = db.collection('settings').doc('awards');
    const awardsDoc = await awardsRef.get();
    const lastAwardedMonth = awardsDoc.exists ? awardsDoc.data().lastAwardedMonth : null;

    const now = new Date();
    
    // Calculate what the previous month was
    let prevYear = now.getUTCFullYear();
    let prevMonth = now.getUTCMonth(); // 0-indexed (Jan=0, Feb=1)
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const previousMonthId = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;

    if (lastAwardedMonth !== previousMonthId) {
      // Use where clause to avoid fetching the entire collection!
      const snapshot = await db.collection('users')
        .where('monthlyXpId', '==', previousMonthId)
        .where('monthlyXp', '>', 0)
        .get();
      
      const usersList = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        usersList.push({ id: doc.id, monthlyXp: data.monthlyXp });
      });

      if (usersList.length > 0) {
        usersList.sort((a, b) => b.monthlyXp - a.monthlyXp);
        const top3 = usersList.slice(0, 3);
        
        const batch = db.batch();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        for (const winner of top3) {
          const userRef = db.collection('users').doc(winner.id);
          batch.update(userRef, {
            isPremium: true,
            premiumPlan: 'MONTHLY_WINNER',
            premiumExpiresAt: expiresAt
          });
        }
        
        batch.set(awardsRef, { lastAwardedMonth: previousMonthId }, { merge: true });
        await batch.commit();
        console.log(`[Awards] Granted premium to top ${top3.length} users for month ${previousMonthId}`);
      } else {
        // No users had XP last month, still mark it as awarded
        await awardsRef.set({ lastAwardedMonth: previousMonthId }, { merge: true });
        console.log(`[Awards] Marked month ${previousMonthId} as awarded (no eligible users).`);
      }
    }
  } catch (err) {
    console.error('[Awards] Failed to process monthly awards:', err);
  }
};
setInterval(processMonthlyAwards, 1000 * 60 * 60 * 12); // run every 12 hours

// --- Webhooks & Raw Routes (Must be before express.json) ---

app.post('/livekit/webhook', express.raw({ type: 'application/webhook+json' }), async (req, res) => {
  try {
    const receiver = new WebhookReceiver(
      runtimeConfig.livekitApiKey,
      runtimeConfig.livekitApiSecret
    );
    const event = await receiver.receive(req.body.toString('utf8'), req.get('Authorization'));

    if (event.event === 'participant_joined') {
      const roomName = event.room ? event.room.name : null;
      const participant = event.participant;
      const room = rooms.find(r => r.id === roomName);
      if (room && participant && participant.identity) {
        let meta = {};
        try {
          meta = JSON.parse(participant.metadata || '{}');
        } catch (e) {}
        const existingIdx = room.participants.findIndex(p => p && p.id === participant.identity);
        const pObj = {
          id: participant.identity,
          name: participant.name || 'User',
          color: meta.color || '#1877f2',
          emoji: meta.emoji || '😊',
          photoUrl: meta.photoUrl || '',
          profileAnimation: meta.profileAnimation || 'none',
          followersCount: meta.followersCount || 0,
          joinedAt: Date.now(),
          lastPing: Date.now()
        };
        if (existingIdx >= 0) {
          room.participants[existingIdx] = { ...room.participants[existingIdx], ...pObj };
        } else {
          room.participants.push(pObj);
        }
        room.emptySince = null;
        saveDB();
      }
    }

    if (event.event === 'participant_left' || event.event === 'participant_disconnected') {
      const roomName = event.room ? event.room.name : null;
      const participant = event.participant;
      const room = rooms.find(r => r.id === roomName);
      if (room && participant) {
        room.participants = (room.participants || []).filter(p => p && p.id !== participant.identity);
        purgeEmptyRooms(); // instant cleanup + socket emit
      }
    }

    if (event.event === 'room_finished') {
      const before = rooms.length;
      rooms = rooms.filter(r => r.id !== event.room.name);
      if (rooms.length !== before) saveDB();
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[webhook] Invalid LiveKit webhook:', err.message);
    res.sendStatus(400);
  }
});

app.post('/api/rooms/:id/leave-beacon', express.text(), async (req, res) => {
  const { id } = req.params;
  const token = req.body;
  if (!token) return res.sendStatus(400);

  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const decoded = await adminInstance.auth().verifyIdToken(token);
      const userId = decoded.uid;
      const room = rooms.find(r => r.id === id);
      if (room) {
        room.participants = room.participants.filter(p => p.id !== userId);
        purgeEmptyRooms();
      }
      res.sendStatus(200);
    } catch (err) {
      console.warn('Beacon auth failed:', err.message);
      res.sendStatus(401);
    }
  } else {
    // For local dev without Firebase
    const room = rooms.find(r => r.id === id);
    if (room) {
      room.participants = room.participants.filter(p => p.id !== token);
      purgeEmptyRooms();
    }
    res.sendStatus(200);
  }
});

app.use(express.json({ limit: '10mb' }));

// E2E Test Bot Backdoor (Only available if secret matches)
app.post('/api/bot-token', async (req, res) => {
  const { secret } = req.body;
  if (secret !== 'e2e-test-secret') return res.status(403).json({ error: 'Forbidden' });
  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const token = await adminInstance.auth().createCustomToken('test-bot-123', {
        name: 'Automated Bot',
        isBot: true
      });
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.json({ token: 'mock-bot-token' });
  }
});

const awardUserXP = async (userId, xpEarned, secondsElapsed = 0) => {
  if (!userId || xpEarned <= 0) return;

  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    console.warn(`Mock: Awarded ${xpEarned} XP to user ${userId}`);
    return;
  }

  try {
    const db = adminInstance.firestore();
    const userRef = db.collection('users').doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) return;

      const data = doc.data();
      const now = new Date();
      
      // Get current week and month strings (e.g. "2023-W41", "2023-10")
      // Simple ISO week calculation
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
      const currentWeekId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
      const currentMonthId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;

      let newWeeklyXp = xpEarned;
      if (data.weeklyXpId === currentWeekId && typeof data.weeklyXp === 'number') {
        newWeeklyXp = data.weeklyXp + xpEarned;
      }

      let newMonthlyXp = xpEarned;
      if (data.monthlyXpId === currentMonthId && typeof data.monthlyXp === 'number') {
        newMonthlyXp = data.monthlyXp + xpEarned;
      }

      const currentDayId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;
      let newDailyXp = xpEarned;
      if (data.dailyXpId === currentDayId && typeof data.dailyXp === 'number') {
        newDailyXp = data.dailyXp + xpEarned;
      }

      let newWeeklyTalkTime = secondsElapsed;
      if (data.weeklyXpId === currentWeekId && typeof data.weeklyTalkTimeSeconds === 'number') {
        newWeeklyTalkTime = data.weeklyTalkTimeSeconds + secondsElapsed;
      }

      let newMonthlyTalkTime = secondsElapsed;
      if (data.monthlyXpId === currentMonthId && typeof data.monthlyTalkTimeSeconds === 'number') {
        newMonthlyTalkTime = data.monthlyTalkTimeSeconds + secondsElapsed;
      }

      let newDailyTalkTime = secondsElapsed;
      if (data.dailyXpId === currentDayId && typeof data.dailyTalkTimeSeconds === 'number') {
        newDailyTalkTime = data.dailyTalkTimeSeconds + secondsElapsed;
      }

      transaction.update(userRef, {
        xp: admin.firestore.FieldValue.increment(xpEarned),
        weeklyXp: newWeeklyXp,
        weeklyXpId: currentWeekId,
        monthlyXp: newMonthlyXp,
        monthlyXpId: currentMonthId,
        dailyXp: newDailyXp,
        dailyXpId: currentDayId,
        talkTimeSeconds: admin.firestore.FieldValue.increment(secondsElapsed),
        weeklyTalkTimeSeconds: newWeeklyTalkTime,
        monthlyTalkTimeSeconds: newMonthlyTalkTime,
        dailyTalkTimeSeconds: newDailyTalkTime
      });
    });

    console.log(`Successfully awarded ${xpEarned} XP to user ${userId}.`);
  } catch (error) {
    console.error('Failed to award XP:', error);
  }
};

async function syncWithLiveKit() {
  if (!runtimeConfig.livekitApiKey || !runtimeConfig.livekitApiSecret) return;

  try {
    const roomService = new RoomServiceClient(runtimeConfig.livekitUrl, runtimeConfig.livekitApiKey, runtimeConfig.livekitApiSecret);
    const liveRooms = await roomService.listRooms();
    const liveRoomNames = new Set(liveRooms.map(r => r.name));

    let changed = false;

    for (const room of rooms) {
      if (!liveRoomNames.has(room.id)) {
        if (room.participants.length > 0) {
          room.participants = [];
          changed = true;
        }
        continue;
      }

      const liveParticipants = await roomService.listParticipants(room.id);
      const liveIds = new Set(liveParticipants.map(p => p.identity));

      const before = room.participants.length;
      room.participants = room.participants.filter(p => p != null && p.id != null && liveIds.has(p.id));
      if (room.participants.length !== before) changed = true;
    }

    if (changed) purgeEmptyRooms();
  } catch (err) {
    console.error('[syncWithLiveKit] Error:', err.message);
  }
}

setInterval(syncWithLiveKit, 15000); // every 15s as a safety net

// GET /api/health - Health check endpoint for Render
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// GET /api/config - Returns configuration to the frontend
app.get('/api/config', (req, res) => {
  if (!runtimeConfig.livekitApiKey || !runtimeConfig.livekitApiSecret) {
    console.warn('⚠️ WARNING: LiveKit credentials are not configured.');
  }
  let url = runtimeConfig.livekitUrl || 'wss://livekit.solith.in';
  if (url.includes('freetalk')) {
    url = url.replace(/freetalk/g, 'solith');
  }
  res.json({
    hasApiKey: !!runtimeConfig.livekitApiKey,
    livekitUrl: url
  });
});

// API Endpoint: Update Config dynamically
app.post('/api/config', verifyToken, verifyAdmin, async (req, res) => {
  const { apiKey, apiSecret, url } = req.body;
  
  if (apiKey !== undefined) runtimeConfig.livekitApiKey = apiKey.trim();
  if (apiSecret !== undefined) runtimeConfig.livekitApiSecret = apiSecret.trim();
  if (url !== undefined) runtimeConfig.livekitUrl = url.trim();

  // Save to Firestore so it persists across backend restarts
  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const db = adminInstance.firestore();
      await db.collection('settings').doc('livekit').set({
        livekitApiKey: runtimeConfig.livekitApiKey,
        livekitApiSecret: runtimeConfig.livekitApiSecret,
        livekitUrl: runtimeConfig.livekitUrl,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save LiveKit config to DB:', err);
    }
  }

  res.json({
    success: true,
    hasApiKey: !!runtimeConfig.livekitApiKey,
    livekitUrl: runtimeConfig.livekitUrl
  });
});



// API Endpoint: List Rooms
app.get('/api/rooms', async (req, res) => {
  const publicAndFriendsRooms = rooms.filter(r => r.accessType !== 'invite');
  res.json(publicAndFriendsRooms);
});

const SUPPORTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Japanese',
  'Chinese', 'Portuguese', 'Korean', 'Hindi', 'Arabic', 'Russian',
  'Bengali', 'Indonesian', 'Vietnamese', 'Urdu', 'Tamil',
  'Telugu', 'Marathi', 'Uzbek', 'Turkish'
];

function isJunkText(str) {
  if (!str) return true;
  const trimmed = str.trim();
  if (trimmed.length < 2) return true;
  
  // Rule 2: Check for 4+ identical consecutive characters (e.g. "hiiii99")
  if (/(.)\1{7,}/.test(trimmed)) return true;
  
  return false;
}

// Strict rate limiting for Room Creation (15 reqs / 15 mins)
const roomCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many rooms created from this IP, please try again after 15 minutes.' }
});

// API Endpoint: Create Room
app.post('/api/rooms', verifyToken, roomCreationLimiter, async (req, res) => {
  const { name, language, topic, tags, accessType = 'public', isOpenMic = false } = req.body;

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: 'Invalid language selection' });
  }

  if (isJunkText(name)) {
    return res.status(400).json({ error: 'Room name must be a valid, descriptive phrase.' });
  }

  // We no longer strictly validate topic to make it fully optional and flexible
  // The client can send whatever they want in the topic.

  // Filter out any garbage tags (must be strings, at least 3 chars)
  const validTags = Array.isArray(tags) 
    ? tags.filter(t => typeof t === 'string' && t.trim().length >= 3).slice(0, 5) // max 5 tags
    : [];

  const roomId = 'room-' + Math.random().toString(36).substring(2, 9);
  let livekitUrl = '';

  if (runtimeConfig.livekitApiKey && runtimeConfig.livekitApiSecret) {
    livekitUrl = runtimeConfig.livekitUrl;
    console.log(`Real LiveKit Room Created Implicitly: ${roomId}`);
    

  } else {
    return res.status(500).json({ error: 'LiveKit configuration is missing. Cannot create real rooms.' });
  }

  const ownerIsPremium = !!req.body.ownerIsPremium;
  const groupAnimation = typeof req.body.groupAnimation === 'string' ? req.body.groupAnimation : 'none';

  let creatorFollowersCount = typeof req.body.creatorFollowersCount === 'number' ? req.body.creatorFollowersCount : 0;
  if (req.user && !creatorFollowersCount) {
    const adminInstance = initFirebaseAdmin();
    if (adminInstance) {
      try {
        const db = adminInstance.firestore();
        const userSnap = await db.collection('users').doc(req.user.uid).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          creatorFollowersCount = userData.followers ? userData.followers.length : 0;
        }
      } catch (err) {
        console.error('Error fetching follower count for creator:', err);
      }
    }
  }

  const creatorParticipant = req.user ? [{
    id: req.user.uid,
    name: req.body.creatorName || req.user.name || 'Host',
    color: req.body.creatorColor || '#1877f2',
    emoji: req.body.creatorEmoji || '😊',
    photoUrl: req.body.creatorPhotoUrl || req.user.picture || '',
    profileAnimation: req.body.creatorProfileAnimation || (ownerIsPremium ? (req.body.profileAnimation || 'none') : 'none'),
    followersCount: creatorFollowersCount,
    joinedAt: Date.now(),
    lastPing: Date.now()
  }] : [];

  // Remove creator from other rooms
  if (req.user) {
    rooms.forEach(r => {
      r.participants = (r.participants || []).filter(p => p && p.id !== req.user.uid);
    });
  }

  const newRoom = {
    id: roomId,
    name,
    language,
    topic: topic ? topic.trim() : '',
    tags: validTags,
    accessType,
    isOpenMic: !!isOpenMic,
    speakingQueue: [],
    allowedSpeakers: [],
    participants: creatorParticipant,
    roles: req.user ? { [req.user.uid]: 'owner' } : {},
    ownerIsPremium,
    groupAnimation,
    messages: [],
    emptySince: creatorParticipant.length > 0 ? null : Date.now(),
    createdAt: Date.now()
  };

  rooms.push(newRoom);
  saveDB();

  // Dispatch Ananya
  if (runtimeConfig.livekitApiKey && runtimeConfig.livekitApiSecret) {
    try {
      const dispatchClient = new AgentDispatchClient(
        runtimeConfig.livekitUrl,
        runtimeConfig.livekitApiKey,
        runtimeConfig.livekitApiSecret
      );
      await dispatchClient.createDispatch(roomId, 'agent-ananya');
      console.log(`[dispatch] ✓ Ananya dispatched to room ${roomId}`);
    } catch (e) {
      console.error('[dispatch] ✗ Failed:', e.message);
    }
  }

  broadcastRoomsUpdated();
  res.status(201).json(newRoom);
});

// API Endpoint: Get Single Room
app.get('/api/rooms/:id', (req, res) => {
  const { id } = req.params;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// API Endpoint: Join Room
app.post('/api/rooms/:id/join', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userId, name, color, emoji, photoUrl, profileAnimation } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'userId and name are required' });
  }

  // Ensure the authenticated user matches the requested userId
  if (req.user && req.user.uid !== userId) {
    return res.status(403).json({ error: 'Forbidden: User ID mismatch' });
  }

  const room = rooms.find(r => r.id === id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Enforce Room Privacy
  if (room.accessType === 'friends') {
    const ownerId = Object.keys(room.roles || {}).find(uid => room.roles[uid] === 'owner');
    if (ownerId && ownerId !== userId) {
      const adminInstance = initFirebaseAdmin();
      if (!adminInstance) return res.status(503).json({ error: 'Firestore Admin not initialized.' });
      
      try {
        const db = adminInstance.firestore();
        const followsSnapshot = await db.collection('follows')
          .where('followerId', '==', userId)
          .where('followingId', '==', ownerId)
          .get();
          
        if (followsSnapshot.empty) {
          return res.status(403).json({ error: 'This is a friends-only room. You must follow the host to join.' });
        }
      } catch (err) {
        console.error('Error checking friends access:', err);
        return res.status(500).json({ error: 'Failed to verify room access' });
      }
    }
  }

  // Remove user from any other rooms they might be in
  rooms.forEach(r => {
    r.participants = r.participants.filter(p => p.id !== userId);
  });

  // Add user to the target room
  const adminInstance = initFirebaseAdmin();
  let followersCount = 0;
  if (adminInstance) {
    try {
      const db = adminInstance.firestore();
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        followersCount = userData.followers ? userData.followers.length : 0;
      }
    } catch (err) {
      console.error('Error fetching follower count on join:', err);
    }
  }

  const participant = {
    id: userId,
    name: name || 'Anonymous',
    color: color || '#1877f2',
    emoji: emoji || '😊',
    photoUrl: photoUrl || '',  // empty string not undefined
    profileAnimation: profileAnimation || 'none',
    followersCount: followersCount || 0,
    joinedAt: Date.now(),
    lastPing: Date.now()
  };
  if (!participant || !participant.id) {
    return res.status(400).json({ error: 'Invalid participant data' });
  }
  room.participants = room.participants.filter(p => p.id !== userId);
  room.participants.push(participant);
  broadcastRoomsUpdated();
  if (io) {
    io.in(room.id).emit('room-participants', room.participants);
    io.in(room.id).emit('user-joined', participant);
  }
  saveDB();

  let token = '';
  const isRealConnection = !!(runtimeConfig.livekitApiKey && runtimeConfig.livekitApiSecret);

  // Generate LiveKit token if credentials exist
  if (isRealConnection) {
    try {
      const at = new AccessToken(runtimeConfig.livekitApiKey, runtimeConfig.livekitApiSecret, {
        identity: userId,
        name: name,
        metadata: JSON.stringify({ photoUrl: photoUrl || '', color: color || '#ff4d4d', emoji: emoji || '😊', profileAnimation: profileAnimation || 'none' }),
        ttl: 24 * 60 * 60, // 24 hours
      });
      at.addGrant({ roomJoin: true, room: room.id, canPublish: true, canSubscribe: true });
      token = await at.toJwt();
    } catch (err) {
      console.error('Failed to create LiveKit meeting token:', err.message);
      return res.status(500).json({ error: 'Failed to generate LiveKit token. Please check backend configuration.' });
    }
  }

  // Ensure Ananya is dispatched to room if LiveKit is configured
  if (isRealConnection) {
    try {
      const dispatchClient = new AgentDispatchClient(
        runtimeConfig.livekitUrl,
        runtimeConfig.livekitApiKey,
        runtimeConfig.livekitApiSecret
      );
      await dispatchClient.createDispatch(id, 'agent-ananya');
      console.log(`[dispatch] ✓ Ananya dispatched on join to room ${id}`);
    } catch (e) {
      // Ignore if dispatch already exists or duplicate
    }
  }

  res.json({
    room,
    livekitUrl: runtimeConfig.livekitUrl,  // always use current config, not stored room value
    token,
    isRealConnection
  });
});

// API Endpoint: Keep-Alive Ping
app.post('/api/rooms/:id/ping', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const participant = room.participants.find(p => p.id === userId);
  if (participant) {
    const now = Date.now();
    if (participant.lastPing) {
      const deltaSec = (now - participant.lastPing) / 1000;
      // Cap max single ping jump to 10 seconds to avoid giant spikes
      const validDelta = Math.min(Math.max(deltaSec, 0), 10);
      if (validDelta > 0) {
        participant.accumulatedTalkTime = (participant.accumulatedTalkTime || 0) + validDelta;
        participant.lastFlush = participant.lastFlush || now;

        // Flush talk time to Firestore every 300 seconds (5 minutes)
        if (now - participant.lastFlush >= 300000 || participant.accumulatedTalkTime >= 300) {
          const secondsToFlush = Math.floor(participant.accumulatedTalkTime);
          if (secondsToFlush > 0) {
            awardUserXP(userId, Math.floor(secondsToFlush * 1.25), secondsToFlush);
            participant.accumulatedTalkTime -= secondsToFlush;
            participant.lastFlush = now;
          }
        }
      }
    }
    participant.lastPing = now;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Not in room' });
  }
});

// API Endpoint: Leave Room
app.post('/api/rooms/:id/leave', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  const room = rooms.find(r => r.id === id);
  if (room) {
    const participant = room.participants.find(p => p.id === userId);
    if (participant) {
      const remainingSeconds = Math.floor(participant.accumulatedTalkTime || 0);
      if (remainingSeconds > 0) {
        awardUserXP(userId, Math.floor(remainingSeconds * 1.25), remainingSeconds);
      }
    }
    room.participants = room.participants.filter(p => p.id !== userId);
    broadcastRoomsUpdated();
    if (io) {
      io.in(room.id).emit('room-participants', room.participants);
      io.in(room.id).emit('user-left', userId);
    }
    saveDB();
  }

  res.json({ success: true });
});

// Speaking Queue Endpoints
app.post('/api/rooms/:id/raise-hand', verifyToken, (req, res) => {
  const { id } = req.params;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  if (!room.speakingQueue) room.speakingQueue = [];
  if (!room.speakingQueue.includes(req.user.uid)) {
    room.speakingQueue.push(req.user.uid);
    saveDB();
    io.to(id).emit('queue-updated', room.speakingQueue);
  }
  res.json({ success: true, speakingQueue: room.speakingQueue });
});

app.post('/api/rooms/:id/lower-hand', verifyToken, (req, res) => {
  const { id } = req.params;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  if (room.speakingQueue) {
    room.speakingQueue = room.speakingQueue.filter(uid => uid !== req.user.uid);
    saveDB();
    io.to(id).emit('queue-updated', room.speakingQueue);
  }
  res.json({ success: true, speakingQueue: room.speakingQueue });
});

app.post('/api/rooms/:id/allow-speak', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  const requesterRole = room.roles ? room.roles[req.user.uid] : 'guest';
  if (requesterRole !== 'owner' && requesterRole !== 'co-host') {
    return res.status(403).json({ error: 'Not authorized to allow speaking' });
  }

  if (room.speakingQueue) {
    room.speakingQueue = room.speakingQueue.filter(uid => uid !== targetUserId);
  }
  if (!room.allowedSpeakers) room.allowedSpeakers = [];
  if (!room.allowedSpeakers.includes(targetUserId)) {
    room.allowedSpeakers.push(targetUserId);
  }
  
  saveDB();
  io.to(id).emit('queue-updated', room.speakingQueue || []);
  io.to(id).emit('speaker-allowed', { userId: targetUserId });
  res.json({ success: true });
});

// Moderation Endpoints
app.post('/api/rooms/:id/promote', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId, role } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  if (!room.roles) room.roles = {};
  if (room.roles[req.user.uid] !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can promote or demote' });
  }
  if (room.roles[targetUserId] === 'owner') {
    return res.status(400).json({ error: 'Cannot change owner role' });
  }

  const validRoles = ['co-owner', 'elder', 'member'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (role === 'member') {
    delete room.roles[targetUserId];
  } else {
    room.roles[targetUserId] = role;
  }
  
  saveDB();
  io.to(id).emit('role-changed', { userId: targetUserId, role: role === 'member' ? 'guest' : role });
  res.json({ success: true, roles: room.roles });
});

app.post('/api/rooms/:id/kick', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.roles) room.roles = {};

  const requesterRole = room.roles[req.user.uid] || 'member';
  const targetRole = room.roles[targetUserId] || 'member';

  if (requesterRole === 'member' || requesterRole === 'elder' || requesterRole === 'guest') {
    return res.status(403).json({ error: 'Not authorized to kick' });
  }
  if (targetRole === 'owner') {
    return res.status(403).json({ error: 'Cannot kick owner' });
  }
  if (requesterRole === 'co-owner' && targetRole === 'co-owner') {
    return res.status(403).json({ error: 'Co-owners cannot kick other co-owners' });
  }

  const targetParticipant = room.participants.find(p => p.id === targetUserId);
  if (targetParticipant && targetParticipant.lastPing) {
    const secondsSinceLastPing = (Date.now() - targetParticipant.lastPing) / 1000;
    const validSeconds = Math.min(secondsSinceLastPing, 120);
    if (validSeconds > 3) {
      awardUserXP(targetUserId, Math.floor(validSeconds * 1.25), validSeconds);
    }
  }

  room.participants = room.participants.filter(p => p.id !== targetUserId);
  saveDB();
  io.to(id).emit('participant-kicked', { userId: targetUserId, by: req.user.name || 'Moderator' });
  res.json({ success: true });
});

app.post('/api/rooms/:id/mute', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.roles) room.roles = {};

  const requesterRole = room.roles[req.user.uid] || 'member';
  const targetRole = room.roles[targetUserId] || 'member';

  if (requesterRole === 'member' || requesterRole === 'elder' || requesterRole === 'guest') {
    return res.status(403).json({ error: 'Not authorized to mute' });
  }
  if (targetRole === 'owner') {
    return res.status(403).json({ error: 'Cannot mute owner' });
  }
  if (requesterRole === 'co-owner' && targetRole === 'co-owner') {
    return res.status(403).json({ error: 'Co-owners cannot mute other co-owners' });
  }

  io.to(id).emit('participant-muted', { userId: targetUserId });
  res.json({ success: true });
});

app.post('/api/rooms/:id/transfer-owner', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.roles) room.roles = {};

  if (room.roles[req.user.uid] !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can transfer room ownership' });
  }

  // Swap roles
  room.roles[req.user.uid] = 'co-owner';
  room.roles[targetUserId] = 'owner';
  
  saveDB();
  io.to(id).emit('owner-transferred', { from: req.user.uid, to: targetUserId });
  res.json({ success: true, roles: room.roles });
});

app.post('/api/rooms/:id/lower-hand-mod', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const requesterRole = room.roles ? room.roles[req.user.uid] : 'guest';
  if (requesterRole !== 'owner' && requesterRole !== 'co-owner') {
    return res.status(403).json({ error: 'Not authorized to lower other participant hands' });
  }

  if (room.speakingQueue) {
    room.speakingQueue = room.speakingQueue.filter(uid => uid !== targetUserId);
  }
  
  saveDB();
  io.to(id).emit('queue-updated', room.speakingQueue || []);
  res.json({ success: true });
});

app.delete('/api/rooms/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const roomIndex = rooms.findIndex(r => r.id === id);
  if (roomIndex === -1) return res.status(404).json({ error: 'Room not found' });
  if (!rooms[roomIndex].roles) rooms[roomIndex].roles = {};

  if (rooms[roomIndex].roles[req.user.uid] !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can delete the room' });
  }

  io.to(id).emit('room-deleted');
  rooms.splice(roomIndex, 1);
  saveDB();
  res.json({ success: true });
});

// --- Follow System Endpoints ---

app.post('/api/users/:targetId/toggle-follow', verifyToken, async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    return res.status(503).json({ error: 'Firestore Admin not initialized.' });
  }

  const { targetId } = req.params;
  const userId = req.user.uid;

  if (userId === targetId) {
    return res.status(400).json({ error: 'Cannot follow yourself.' });
  }

  try {
    const db = adminInstance.firestore();
    const userRef = db.collection('users').doc(userId);
    const targetRef = db.collection('users').doc(targetId);

    let didFollow = false;
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const targetDoc = await transaction.get(targetRef);

      const userFollowing = userDoc.exists ? (userDoc.data().following || []) : [];
      const targetFollowers = targetDoc.exists ? (targetDoc.data().followers || []) : [];

      const isFollowing = userFollowing.includes(targetId);
      const followDocRef = db.collection('follows').doc(`${userId}_${targetId}`);

      if (isFollowing) {
        // Unfollow
        transaction.set(userRef, { following: admin.firestore.FieldValue.arrayRemove(targetId) }, { merge: true });
        transaction.set(targetRef, { followers: admin.firestore.FieldValue.arrayRemove(userId) }, { merge: true });
        transaction.delete(followDocRef);
        didFollow = false;
      } else {
        // Follow
        transaction.set(userRef, { following: admin.firestore.FieldValue.arrayUnion(targetId) }, { merge: true });
        transaction.set(targetRef, { followers: admin.firestore.FieldValue.arrayUnion(userId) }, { merge: true });
        transaction.set(followDocRef, {
          followerId: userId,
          followingId: targetId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        didFollow = true;
      }
    });

    // Update in-memory room participant follower counts
    rooms.forEach(r => {
      r.participants.forEach(p => {
        if (p.id === targetId) {
          p.followersCount = didFollow ? (p.followersCount || 0) + 1 : Math.max(0, (p.followersCount || 0) - 1);
        }
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in toggle-follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow.' });
  }
});

// ─── GET ALL USERS (for Social "All" tab) ────────────────────────────────────
app.get('/api/users/all', async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    return res.status(503).json({ error: 'Firestore Admin not initialized.' });
  }
  try {
    const db = adminInstance.firestore();
    const snapshot = await db.collection('users').orderBy('xp', 'desc').limit(100).get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unknown',
        photoUrl: data.photoUrl || '',
        xp: data.xp || 0
      };
    });
    res.json({ users });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/profiles', async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    return res.status(503).json({ error: 'Firestore Admin not initialized.' });
  }

  const idsStr = req.query.ids;
  if (!idsStr) return res.json({ profiles: [] });
  
  const ids = idsStr.split(',').slice(0, 100); // Limit to 100 at a time
  if (ids.length === 0) return res.json({ profiles: [] });

  try {
    const db = adminInstance.firestore();
    const realIds = ids.filter(id => id !== 'system');
    const refs = realIds.map(id => db.collection('users').doc(id));
    const docs = refs.length > 0 ? await db.getAll(...refs) : [];
    
    const profiles = docs
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          photoUrl: data.photoUrl || '',
          xp: data.xp || 0,
          isPremium: !!data.isPremium,
          role: data.role || 'user',
          profileAnimation: data.profileAnimation || 'none',
          groupAnimation: data.groupAnimation || 'none'
        };
      });

    if (ids.includes('system')) {
      profiles.push({
        id: 'system',
        name: 'Solith System',
        photoUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=SolithSystem',
        xp: 9999,
        isPremium: true,
        role: 'system'
      });
    }

    res.json({ profiles });
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// --- Pro Animation Customization ---
const VALID_PRO_ANIMATIONS = ['none', 'neon-gradient', 'pulsing-glow', 'aurora', 'shimmer', 'electric'];

app.post('/api/users/customization', verifyToken, async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return res.status(503).json({ error: 'Firestore Admin not initialized.' });

  const userId = req.user.uid;
  const { profileAnimation, groupAnimation } = req.body;

  try {
    const db = adminInstance.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userData = userDoc.data();
    const isOwner = req.user.email === 'ayushsinghe07@gmail.com' || userData.role === 'admin';
    const isPro = !!(userData.isPremium || isOwner);

    // Free user protection: non-pro users cannot choose active animations
    if (!isPro) {
      if ((profileAnimation && profileAnimation !== 'none') || (groupAnimation && groupAnimation !== 'none')) {
        return res.status(403).json({ error: 'Pro/VIP membership is required to unlock and use animations.' });
      }
    }

    const updates = {};
    if (profileAnimation !== undefined) {
      if (!VALID_PRO_ANIMATIONS.includes(profileAnimation)) {
        return res.status(400).json({ error: 'Invalid profile animation option.' });
      }
      updates.profileAnimation = profileAnimation;
    }

    if (groupAnimation !== undefined) {
      if (!VALID_PRO_ANIMATIONS.includes(groupAnimation)) {
        return res.status(400).json({ error: 'Invalid group animation option.' });
      }
      updates.groupAnimation = groupAnimation;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(userId).set(updates, { merge: true });
    }

    res.json({
      success: true,
      profileAnimation: updates.profileAnimation !== undefined ? updates.profileAnimation : (userData.profileAnimation || 'none'),
      groupAnimation: updates.groupAnimation !== undefined ? updates.groupAnimation : (userData.groupAnimation || 'none')
    });
  } catch (error) {
    console.error('Error updating customization:', error);
    res.status(500).json({ error: 'Failed to update customization.' });
  }
});

// --- Direct Messages & Blocking ---

app.post('/api/users/:targetId/block', verifyToken, async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return res.status(503).json({ error: 'Firestore Admin not initialized.' });

  const { targetId } = req.params;
  const userId = req.user.uid;

  if (userId === targetId) return res.status(400).json({ error: 'Cannot block yourself.' });

  try {
    const db = adminInstance.firestore();
    const userRef = db.collection('users').doc(userId);
    
    // Add to blockedUsers array
    await userRef.set({
      blockedUsers: admin.firestore.FieldValue.arrayUnion(targetId)
    }, { merge: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

app.post('/api/rooms/:id/agent-chat', express.json(), (req, res) => {
  const { id: roomId } = req.params;
  const { text } = req.body;
  if (!roomId || !text) return res.status(400).send('Missing args');
  
  const newMessage = {
      id: 'msg-' + Date.now(),
      senderId: 'agent-ananya',
      senderName: 'Ananya',
      senderEmoji: '🤖',
      senderColor: '#8B5CF6',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  
  io.to(roomId).emit('chat-message', newMessage);
  res.status(200).send('OK');
});

app.post('/api/messages/send', verifyToken, async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return res.status(503).json({ error: 'Firestore Admin not initialized.' });

  const userId = req.user.uid;
  const { conversationId, receiverId, text, imageUrl } = req.body;

  if (!imageUrl && (!text || typeof text !== 'string' || text.trim().length === 0 || text.trim().length > 2000)) {
    return res.status(400).json({ error: 'Message text or image is required.' });
  }

  if (!receiverId) {
    return res.status(400).json({ error: 'Receiver ID is required.' });
  }

  try {
    const db = adminInstance.firestore();
    
    // Check blocks
    const receiverDoc = await db.collection('users').doc(receiverId).get();
    if (receiverDoc.exists) {
      const blocked = receiverDoc.data().blockedUsers || [];
      if (blocked.includes(userId)) {
        return res.status(403).json({ error: 'You have been blocked by this user.' });
      }
    }

    const senderDoc = await db.collection('users').doc(userId).get();
    if (senderDoc.exists) {
      const blocked = senderDoc.data().blockedUsers || [];
      if (blocked.includes(receiverId)) {
        return res.status(403).json({ error: 'You have blocked this user. Unblock to send messages.' });
      }
    }

    const convoId = conversationId || (userId < receiverId ? `${userId}_${receiverId}` : `${receiverId}_${userId}`);
    const convoRef = db.collection('conversations').doc(convoId);

    await db.runTransaction(async (transaction) => {
      const convoDoc = await transaction.get(convoRef);
      
      if (!convoDoc.exists) {
        transaction.set(convoRef, {
          participants: [userId, receiverId],
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageText: text ? text.trim() : (imageUrl ? '[Image]' : ''),
          lastMessageSenderId: userId
        });
      } else {
        transaction.update(convoRef, {
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastMessageText: text ? text.trim() : (imageUrl ? '[Image]' : ''),
          lastMessageSenderId: userId
        });
      }

      const messageRef = convoRef.collection('messages').doc();
      const msgData = {
        senderId: userId,
        text: text ? text.trim() : '',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        readAt: null
      };
      if (imageUrl) {
        msgData.imageUrl = imageUrl;
      }
      transaction.set(messageRef, msgData);
    });

    res.json({ success: true, conversationId: convoId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

import setupAdminRoutes from './adminRoutes.js';

// Setup admin routes
setupAdminRoutes(app, () => rooms, saveDB, io);



// Socket.IO Logic
const broadcastOnlineStats = async () => {
  // Only query Firestore for user count every 5 minutes
  if (Date.now() - cachedUserCountTime > CACHE_TTL) {
    try {
      const adminInstance = initFirebaseAdmin();
      if (adminInstance) {
        const db = adminInstance.firestore();
        const snapshot = await db.collection('users').count().get();
        cachedUserCount = snapshot.data().count;
        cachedUserCountTime = Date.now();
      }
    } catch (err) {
      console.warn('Failed to get user count:', err.message);
    }
  }

  io.emit('online-stats', {
    online: authenticatedOnline ? authenticatedOnline.size : (io.engine.clientsCount || 1),
    total: Math.max(cachedUserCount, io.engine.clientsCount || 1),
    onlineUserIds: authenticatedOnline ? [...authenticatedOnline] : []
  });
};

// Broadcast stats every 60 seconds instead of 15 to reduce Firestore quota usage
setInterval(async () => {
  await broadcastOnlineStats();
}, 60000);

// Helper functions for multiplayer games
const getSocketByUid = (uid) => {
  for (const [socketId, identityId] of socketToIdentity.entries()) {
    if (identityId === uid) {
      const s = io.sockets.sockets.get(socketId);
      if (s) return s;
    }
  }
  const sockets = Array.from(io.sockets.sockets.values());
  return sockets.find(s => s.data && s.data.uid === uid);
};

const sanitizeGameState = (activeGame) => {
  if (!activeGame) return null;
  const sanitized = { ...activeGame };
  if (activeGame.type === 'uno' && activeGame.hands) {
    sanitized.state = {
      ...activeGame.state,
      players: activeGame.state.players.map(p => ({
        id: p.id,
        name: p.name,
        handSize: activeGame.hands[p.id]?.length || 0
      }))
    };
    // Strip internal backend data
    const output = { ...sanitized };
    delete output.hands;
    delete output.deck;
    return output;
  }
  return sanitized;
};

const broadcastGameState = (roomId, activeGame) => {
  if (!activeGame) {
    io.in(roomId).emit('game-state', null);
    return;
  }
  io.in(roomId).emit('game-state', sanitizeGameState(activeGame));
};

const sendPrivateUnoHand = (roomId, playerId, hand) => {
  const socket = getSocketByUid(playerId);
  if (socket) {
    socket.emit('uno-hand', hand);
  }
};

function generateDeck() {
  const COLORS = ['red', 'yellow', 'green', 'blue'];
  const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2'];
  const deck = [];
  COLORS.forEach(color => {
    deck.push({ color, value: '0', id: Math.random().toString() });
    for (let i = 0; i < 2; i++) {
      VALUES.slice(1).forEach(value => {
        deck.push({ color, value, id: Math.random().toString() });
      });
    }
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild', id: Math.random().toString() });
    deck.push({ color: 'black', value: 'wild+4', id: Math.random().toString() });
  }
  return deck.sort(() => Math.random() - 0.5);
}

function calculateTicTacToeWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

function checkConnect4Winner(board) {
  const ROWS = 6;
  const COLS = 7;
  // Check vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c][r+1] && board[c][r] === board[c][r+2] && board[c][r] === board[c][r+3]) return board[c][r];
    }
  }
  // Check horizontal
  for (let c = 0; c <= COLS - 4; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[c][r] && board[c][r] === board[c+1][r] && board[c][r] === board[c+2][r] && board[c][r] === board[c+3][r]) return board[c][r];
    }
  }
  // Check diagonal right
  for (let c = 0; c <= COLS - 4; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c+1][r+1] && board[c][r] === board[c+2][r+2] && board[c][r] === board[c+3][r+3]) return board[c][r];
    }
  }
  // Check diagonal left
  for (let c = 3; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c-1][r+1] && board[c][r] === board[c-2][r+2] && board[c][r] === board[c-3][r+3]) return board[c][r];
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log(chalk.green(`✓ Socket connected: ${socket.id}`));
  socket.emit('rooms-updated', { rooms: rooms.filter(r => r.accessType !== 'invite') });
  broadcastOnlineStats();

  socket.on('authenticate', (uid) => {
    if (uid) {
      authenticatedOnline.add(uid);
      socket.data.uid = uid;
      broadcastOnlineStats();
    }
  });

  socket.on('join-room', (payload) => {
    let roomId = payload;
    let identity = null;
    if (typeof payload === 'object') {
      roomId = payload.roomName;
      identity = payload.identity;
    }
    
    socket.join(roomId);
    if (identity) {
      socketToIdentity.set(socket.id, identity);
      
      // Cancel any pending disconnect removal for this user (reconnection scenario)
      if (disconnectTimers.has(identity)) {
        clearTimeout(disconnectTimers.get(identity));
        disconnectTimers.delete(identity);
        console.log(chalk.green(`✓ Cancelled disconnect grace timer for ${identity} (reconnected)`));
      }
    }
    
    // Send existing message history and shared YouTube video to the user joining
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      if (room.messages) {
        socket.emit('chat-history', room.messages);
      }
      if (room.ytVideoId) {
        socket.emit('yt-share', { videoId: room.ytVideoId, sharingUser: room.ytSharingUser });
      }
      if (room.activeGame) {
        socket.emit('game-state', sanitizeGameState(room.activeGame));
        if (room.activeGame.type === 'uno' && room.activeGame.hands) {
          const userId = identity || socket.data.uid;
          if (userId && room.activeGame.hands[userId]) {
            socket.emit('uno-hand', room.activeGame.hands[userId]);
          }
        }
      }
    }
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('yt-share', (data) => {
    const { roomId, videoId, sharingUser } = data;
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      room.ytVideoId = videoId;
      room.ytSharingUser = sharingUser;
    }
    io.in(roomId).emit('yt-share', { videoId, sharingUser });
  });

  socket.on('chat-message', (data) => {
    const { roomId, message } = data;
    
    // Broadcast immediately to everyone else in the room
    socket.to(roomId).emit('chat-message', message);

    // Save to memory (ephemeral, not written to disk)
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      if (!room.messages) room.messages = [];
      room.messages.push(message);
      
      // Keep only the last 50 messages
      if (room.messages.length > 50) {
        room.messages = room.messages.slice(-50);
      }
    }
  });

  socket.on('message-reaction', (data) => {
    const { roomId, messageId, emoji, userId } = data;
    
    // Broadcast to everyone in the room (including sender)
    io.in(roomId).emit('message-reaction', data);

    // Save to memory
    const room = rooms.find(r => r.id === roomId);
    if (room && room.messages) {
      const msg = room.messages.find(m => m.id === messageId);
      if (msg) {
        if (!msg.reactions) msg.reactions = {};
        if (msg.reactions[userId] === emoji) {
           delete msg.reactions[userId];
        } else {
           msg.reactions[userId] = emoji;
        }
      }
    }
  });

  socket.on('draw-stroke', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('draw-stroke', data);
  });

  socket.on('clear-canvas', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('clear-canvas', data);
  });

  // UNO deck builder
  function buildUnoInitialState(players) {
    const colors = ['red', 'green', 'blue', 'yellow'];
    const values = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];
    let deck = [];
    colors.forEach(color => {
      values.forEach(value => {
        deck.push({ color, value, id: `${color}-${value}-a` });
        if (value !== '0') deck.push({ color, value, id: `${color}-${value}-b` });
      });
    });
    // Wild cards
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value: 'wild', id: `wild-${i}` });
      deck.push({ color: 'wild', value: 'wild4', id: `wild4-${i}` });
    }
    // Shuffle
    deck = deck.sort(() => Math.random() - 0.5);

    const hands = {};
    players.forEach(p => {
      hands[p.id] = deck.splice(0, 7);
    });

    // First non-wild card becomes top
    let topCard = deck.shift();
    while (topCard.color === 'wild') {
      deck.push(topCard);
      topCard = deck.shift();
    }

    return {
      hands,
      deck,
      topCard,
      discardPile: [topCard],
      direction: 1,
      handCounts: Object.fromEntries(players.map(p => [p.id, 7]))
    };
  }

  // Scrabble initial state
  function buildScrabbleInitialState(players) {
    const letterDistribution = {
      A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,
      N:6,O:8,P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,' ':2
    };
    const letterValues = {
      A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,
      N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,' ':0
    };

    let bag = [];
    Object.entries(letterDistribution).forEach(([letter, count]) => {
      for (let i = 0; i < count; i++) {
        bag.push({ letter, value: letterValues[letter], id: `${letter}-${i}` });
      }
    });
    bag = bag.sort(() => Math.random() - 0.5);

    const racks = {};
    players.forEach(p => {
      racks[p.id] = bag.splice(0, 7);
    });

    // 15x15 board
    const board = Array(15).fill(null).map(() => Array(15).fill(null));

    // Premium squares
    const premiumSquares = {
      tripleWord: [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]],
      doubleWord: [[1,1],[2,2],[3,3],[4,4],[10,10],[11,11],[12,12],[13,13],[1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1],[7,7]],
      tripleLetter: [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]],
      doubleLetter: [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]]
    };

    return {
      board,
      bag,
      racks,
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      premiumSquares,
      rackCounts: Object.fromEntries(players.map(p => [p.id, 7])),
      lastMove: null,
      passCount: 0
    };
  }

  // ─── GAME INVITE ──────────────────────────────────────────────────────────────
  socket.on('game-invite', (data) => {
    const { roomId, gameType, initiator } = data;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    // Cancel any existing game or invite
    room.activeGame = null;
    room.gameLobby = {
      gameType,
      initiator,
      players: [initiator], // initiator is player 1
      status: 'waiting',    // waiting | started | finished
      createdAt: Date.now()
    };
    
    io.in(roomId).emit('game-lobby-updated', room.gameLobby);
  });

  // ─── ACCEPT GAME INVITE ───────────────────────────────────────────────────────
  socket.on('game-accept', (data) => {
    const { roomId, player } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room?.gameLobby || room.gameLobby.status !== 'waiting') return;
    
    const MAX_PLAYERS = { chess: 2, tictactoe: 2, connect4: 2, uno: 6, scrabble: 4 };
    const max = MAX_PLAYERS[room.gameLobby.gameType] || 2;
    
    // Don't add duplicate
    if (room.gameLobby.players.find(p => p.id === player.id)) return;
    
    if (room.gameLobby.players.length >= max) return;
    
    room.gameLobby.players.push(player);
    io.in(roomId).emit('game-lobby-updated', room.gameLobby);
  });

  // ─── DECLINE / CANCEL INVITE ──────────────────────────────────────────────────
  socket.on('game-cancel', (data) => {
    const { roomId, userId } = data;
    const room = rooms.find(r => r.id === roomId);
    if (!room?.gameLobby) return;
    
    // Only initiator can cancel
    if (room.gameLobby.initiator.id !== userId) return;
    
    room.gameLobby = null;
    room.activeGame = null;
    io.in(roomId).emit('game-lobby-updated', null);
    io.in(roomId).emit('game-ended', { reason: 'cancelled' });
  });

  // ─── START GAME ───────────────────────────────────────────────────────────────
  socket.on('game-start', (data) => {
    const { roomId, userId } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room?.gameLobby) return;
    if (room.gameLobby.initiator.id !== userId) return;
    
    const MIN_PLAYERS = { chess: 2, tictactoe: 2, connect4: 2, uno: 2, scrabble: 2 };
    const min = MIN_PLAYERS[room.gameLobby.gameType] || 2;
    
    if (room.gameLobby.players.length < min) {
      socket.emit('game-error', { message: `Need at least ${min} players to start` });
      return;
    }

    const players = room.gameLobby.players;
    const gameType = room.gameLobby.gameType;
    
    // Build initial state per game type
    let initialState = {};
    let currentTurnId = players[0].id;

    if (gameType === 'chess') {
      initialState = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: []
      };
    }
    
    if (gameType === 'tictactoe') {
      initialState = {
        board: Array(9).fill(null),
        winner: null
      };
    }
    
    if (gameType === 'connect4') {
      initialState = {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        winner: null
      };
    }
    
    if (gameType === 'uno') {
      initialState = buildUnoInitialState(players);
      
      // Emit private hands to each player
      players.forEach(player => {
        const playerSocket = [...socketToIdentity.entries()]
          .find(([sid, uid]) => uid === player.id)?.[0];
          
        if (playerSocket) {
          io.to(playerSocket).emit('uno-hand', {
            hand: initialState.hands[player.id],
            topCard: initialState.topCard
          });
        }
      });
      
      // Remove private hands from broadcast state
      const publicState = { ...initialState };
      delete publicState.hands;
      initialState = publicState;
    }
    
    if (gameType === 'scrabble') {
      initialState = buildScrabbleInitialState(players);
      
      // Emit private racks to each player
      players.forEach(player => {
        const playerSocket = [...socketToIdentity.entries()]
          .find(([sid, uid]) => uid === player.id)?.[0];
          
        if (playerSocket) {
          io.to(playerSocket).emit('scrabble-rack', {
            rack: initialState.racks[player.id]
          });
        }
      });
      
      const publicState = { ...initialState };
      delete publicState.racks;
      initialState = publicState;
    }

    room.activeGame = {
      type: gameType,
      players,
      currentTurnId,
      state: initialState,
      status: 'active',
      startedAt: Date.now(),
      winner: null
    };
    
    room.gameLobby = { ...room.gameLobby, status: 'started' };
    
    io.in(roomId).emit('game-state', room.activeGame);
  });

  // ─── GAME ACTION (move) ───────────────────────────────────────────────────────
  socket.on('game-action', (data) => {
    const { roomId, playerId, action, newState } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room?.activeGame || room.activeGame.status !== 'active') return;
    
    // Validate turn
    if (room.activeGame.currentTurnId !== playerId) {
      socket.emit('game-error', { message: 'Not your turn' });
      return;
    }
    
    // Validate player is in this game
    const players = room.activeGame.players || [];
    const playerFound = players.find(p => (p?.id || p) === playerId);
    if (!playerFound) {
      socket.emit('game-error', { message: 'You are not in this game' });
      return;
    }

    // Apply new state
    room.activeGame.state = newState;
    
    // Check for winner
    if (newState.winner) {
      room.activeGame.status = 'finished';
      room.activeGame.winner = newState.winner;
      io.in(roomId).emit('game-state', room.activeGame);
      io.in(roomId).emit('game-ended', { winner: newState.winner, reason: 'winner' });
      return;
    }

    // Advance turn (skip logic handled per game in newState.skipNextPlayer)
    const currentIndex = players.findIndex(p => (p?.id || p) === playerId);
    
    // Handle UNO reverse
    if (newState.direction === -1 && !room.activeGame.direction) {
      room.activeGame.direction = -1;
    }
    const direction = room.activeGame.direction || 1;
    
    // Handle skip
    const skipCount = newState.skipCount || 1;
    let nextIndex = (currentIndex + (direction * skipCount) + players.length) % players.length;
    
    const nextPlayer = players[nextIndex];
    room.activeGame.currentTurnId = nextPlayer?.id || nextPlayer;

    // For UNO: if draw cards were assigned, emit private hand update
    if (data.gameType === 'uno' && newState.drawnCards) {
      Object.entries(newState.drawnCards).forEach(([uid, cards]) => {
        const playerSocket = [...socketToIdentity.entries()]
          .find(([sid, id]) => id === uid)?.[0];
        if (playerSocket) {
          io.to(playerSocket).emit('uno-draw', { cards });
        }
      });
      delete room.activeGame.state.drawnCards;
    }

    io.in(roomId).emit('game-state', room.activeGame);
  });

  // ─── GAME END (manual) ───────────────────────────────────────────────────────
  socket.on('game-end', (data) => {
    const { roomId, userId } = data;
    const room = rooms.find(r => r.id === roomId);
    
    if (!room?.activeGame) return;
    if (!room.activeGame.players.find(p => p.id === userId)) return;
    
    room.activeGame = null;
    room.gameLobby = null;
    io.in(roomId).emit('game-ended', { reason: 'manual' });
    io.in(roomId).emit('game-lobby-updated', null);
  });
  socket.on('uno-request-hand', (data) => {
    const { roomId } = data;
    const room = rooms.find(r => r.id === roomId);
    if (room && room.activeGame && room.activeGame.type === 'uno' && room.activeGame.hands) {
      const uid = socketToIdentity.get(socket.id) || socket.data.uid;
      if (uid && room.activeGame.hands[uid]) {
        socket.emit('uno-hand', room.activeGame.hands[uid]);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(chalk.yellow(`✗ Socket disconnected: ${socket.id}`));
    
    if (socket.data.uid) {
      authenticatedOnline.delete(socket.data.uid);
    }
    
    const identity = socketToIdentity.get(socket.id);
    if (identity) {
      socketToIdentity.delete(socket.id);
      
      // Grace period: wait 15s before removing participant
      // This prevents transport upgrades (polling→websocket) and brief network blips
      // from kicking users out of rooms
      if (disconnectTimers.has(identity)) {
        clearTimeout(disconnectTimers.get(identity));
      }
      
      const timer = setTimeout(() => {
        // Check if user reconnected with a new socket in the meantime
        const stillConnected = Array.from(socketToIdentity.values()).includes(identity);
        if (!stillConnected) {
          console.log(chalk.yellow(`✗ Grace period expired for ${identity} — removing from rooms`));
          for (const room of rooms) {
            const before = room.participants.length;
            room.participants = room.participants.filter(p => p != null && p.id != null && p.id !== identity);
            if (room.participants.length !== before) break;
          }
          purgeEmptyRooms();
          broadcastOnlineStats();
        }
        disconnectTimers.delete(identity);
      }, 15000); // 15 second grace period
      
      disconnectTimers.set(identity, timer);
    }
    
    broadcastOnlineStats();
  });
});

// Global Public Settings Endpoint
app.get('/api/settings/public', async (req, res) => {
  const fallback = {
    premiumPrice: 99,
    premiumDurationDays: 30,
    qrCodeUrl: '/qr-placeholder.png',
    premiumVisibilityBoost: true
  };

  // Return cached settings if fresh
  if (cachedSettings && (Date.now() - cachedSettingsTime) < CACHE_TTL) {
    return res.json(cachedSettings);
  }

  try {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.json(fallback);
    const db = adminInstance.firestore();
    const doc = await db.collection('settings').doc('global').get();
    const data = doc.exists ? doc.data() : {};
    cachedSettings = {
      premiumPrice: data.premiumPrice || 99,
      premiumDurationDays: data.premiumDurationDays || 30,
      qrCodeUrl: data.qrCodeUrl || '/qr-placeholder.png',
      premiumVisibilityBoost: data.premiumVisibilityBoost ?? true
    };
    cachedSettingsTime = Date.now();
    res.json(cachedSettings);
  } catch (error) {
    console.error('Settings fetch error:', error.message);
    res.json(cachedSettings || fallback);
  }
});

// Premium Payment Endpoints
app.post('/api/payments/submit', verifyToken, async (req, res) => {
  const { utr, plan, screenshot } = req.body;
  const utrStr = utr ? utr.trim() : '';
  if (!/^\d{12}$/.test(utrStr)) {
    return res.status(400).json({ error: 'Valid 12-digit UTR number is required.' });
  }

  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return res.status(500).json({ error: 'Database connection error' });

  try {
    const db = adminInstance.firestore();
    
    // Check if user already has a pending request
    const pendingSnap = await db.collection('payment_requests')
      .where('userId', '==', req.user.uid)
      .where('status', '==', 'PENDING')
      .get();
      
    if (!pendingSnap.empty) {
      return res.status(400).json({ error: 'You already have a pending payment request.' });
    }

    // Check if this UTR was already submitted (prevent duplicates)
    const utrSnap = await db.collection('payment_requests')
      .where('utr', '==', utr.trim())
      .get();
      
    if (!utrSnap.empty) {
      return res.status(400).json({ error: 'This UTR has already been submitted.' });
    }

    // Get current price from settings
    const settingsDoc = await db.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { premiumPrice: 99 };
    
    const selectedPlan = plan === 'OWNER' ? 'OWNER' : 'STANDARD';
    const currentPrice = selectedPlan === 'OWNER' ? 499 : (Number(settings.premiumPrice) || 99);

    const docRef = await db.collection('payment_requests').add({
      userId: req.user.uid,
      amount: currentPrice,
      plan: selectedPlan,
      currency: 'INR',
      utr: utrStr,
      screenshot: screenshot || null,
      status: 'PENDING',
      submittedAt: Date.now()
    });

    res.json({ success: true, requestId: docRef.id });
  } catch (error) {
    console.error('Error submitting payment:', error);
    res.status(500).json({ error: 'Failed to submit payment.' });
  }
});

app.get('/api/payments/status', verifyToken, async (req, res) => {
  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) return res.status(500).json({ error: 'Database connection error' });

  try {
    const db = adminInstance.firestore();
    const requestsSnap = await db.collection('payment_requests')
      .where('userId', '==', req.user.uid)
      .get();
      
    if (requestsSnap.empty) {
      return res.json({ hasRequest: false });
    }
    
    // Sort in memory to avoid needing a composite index
    const docs = requestsSnap.docs.sort((a, b) => b.data().submittedAt - a.data().submittedAt);
    const requestData = docs[0].data();
    res.json({
      hasRequest: true,
      request: {
        id: docs[0].id,
        status: requestData.status,
        utr: requestData.utr,
        submittedAt: requestData.submittedAt
      }
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ error: 'Failed to fetch status.' });
  }
});

app.post('/api/rooms/:id/agent-chat', express.json(), (req, res) => {
  const { id } = req.params;
  const { text, speaker, senderId, color } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  const message = {
    id: 'agent-' + Date.now(),
    senderId: senderId || 'ananya-ai',
    senderName: speaker || 'Ananya AI',
    senderEmoji: senderId === 'ananya-ai' ? '🤖' : '🎤',
    senderColor: color || '#6c47ff',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isAgent: senderId === 'ananya-ai',
    isTranscript: senderId !== 'ananya-ai'
  };

  // Broadcast to room via socket
  io.to(id).emit('chat-message', message);
  res.json({ success: true });
});
// Static files MUST be last
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    // Don't serve HTML for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/livekit/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start Server
// NOTE: The LiveKit agent (Ananya) is deployed as a SEPARATE Render Background Worker.
// It is NOT spawned here — running both in one process was causing OOM kills on the free 512MB tier.
const PORT = process.env.PORT || 3000;
loadDB();

server.listen(PORT, () => {
  console.log(chalk.cyan.bold(`🚀 Solith Backend running on port ${PORT}`));
  console.log(chalk.yellow('[agent] Ananya runs as a separate Background Worker service — not spawned here.'));
});
