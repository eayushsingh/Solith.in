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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const server = createServer(app);

// CORS configuration - allow only explicit origins in production
let corsOptions;
if (process.env.NODE_ENV === 'production') {
  const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  corsOptions = { origin: allowedOrigins.length > 0 ? allowedOrigins : false };
} else {
  corsOptions = { origin: '*' };
}

const io = new Server(server, { cors: corsOptions });

app.use(helmet()); // Set basic HTTP security headers
app.use(cors(corsOptions));

// Apply global rate limiting (100 reqs / 15 mins per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
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

// Rooms Database State
let rooms = [];
const socketToIdentity = new Map();
const authenticatedOnline = new Set();

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
    console.error('setAdminRoles error:', e);
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
      await setAdminRoles();
      return;
    } catch (err) {
      console.error('Error loading rooms from Firestore, fallback to local DB:', err);
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

const saveDB = async () => {
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
  if (io) {
    io.emit('rooms-updated', { rooms: rooms.filter(r => r.accessType !== 'invite') });
  }
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
      // Fetch all users to avoid missing composite index
      const snapshot = await db.collection('users').get();
      const usersList = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.monthlyXpId === previousMonthId && data.monthlyXp > 0) {
          usersList.push({ id: doc.id, monthlyXp: data.monthlyXp });
        }
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

    if (event.event === 'participant_left' || event.event === 'participant_disconnected') {
      const roomName = event.room.name;
      const participant = event.participant;
      const room = rooms.find(r => r.id === roomName);
      if (room) {
        room.participants = room.participants.filter(p => p.id !== participant.identity);
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

const awardUserXP = async (userId, xpEarned) => {
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

      transaction.update(userRef, {
        xp: admin.firestore.FieldValue.increment(xpEarned),
        weeklyXp: newWeeklyXp,
        weeklyXpId: currentWeekId,
        monthlyXp: newMonthlyXp,
        monthlyXpId: currentMonthId,
        dailyXp: newDailyXp,
        dailyXpId: currentDayId
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
  res.json({
    hasApiKey: !!runtimeConfig.livekitApiKey,
    livekitUrl: runtimeConfig.livekitUrl
  });
});

// API Endpoint: Update Config dynamically
app.post('/api/config', verifyToken, verifyAdmin, (req, res) => {
  const { apiKey, apiSecret, url } = req.body;
  if (apiKey !== undefined) runtimeConfig.livekitApiKey = apiKey.trim();
  if (apiSecret !== undefined) runtimeConfig.livekitApiSecret = apiSecret.trim();
  if (url !== undefined) runtimeConfig.livekitUrl = url.trim();
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
  if (/(.)\1{4,}/.test(trimmed)) return true;
  
  return false;
}

// Strict rate limiting for Room Creation (15 reqs / 15 mins)
const roomCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
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
    
    // Dispatch the AI Host agent exactly once per room
    try {
      if (!global.dispatchedRooms) global.dispatchedRooms = new Set();
      if (!global.dispatchedRooms.has(roomId)) {
        global.dispatchedRooms.add(roomId);
        const agentClient = new AgentDispatchClient(livekitUrl, runtimeConfig.livekitApiKey, runtimeConfig.livekitApiSecret);
        await agentClient.createDispatch(roomId, 'agent-ananya', {
          metadata: JSON.stringify({
            photoUrl: '/ananya.png',
            color: '#8b5cf6',
            emoji: '✨'
          })
        });
        console.log(`Dispatched AI Host for room ${roomId}`);
      }
    } catch (e) {
      console.error('Failed to dispatch AI Host:', e.message);
    }
  } else {
    return res.status(500).json({ error: 'LiveKit configuration is missing. Cannot create real rooms.' });
  }

  const ownerIsPremium = !!req.body.ownerIsPremium;


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
    participants: [],
    roles: req.user ? { [req.user.uid]: 'owner' } : {},
    ownerIsPremium,
    messages: [],
    emptySince: Date.now(),
    livekitUrl,
    createdAt: Date.now()
  };

  rooms.push(newRoom);
  saveDB();

  res.status(201).json(newRoom);
});

// API Endpoint: Join Room
app.post('/api/rooms/:id/join', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userId, name, color, emoji, photoUrl } = req.body;

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
    followersCount: followersCount || 0,
    joinedAt: Date.now(),
    lastPing: Date.now()
  };
  if (!participant || !participant.id) {
    return res.status(400).json({ error: 'Invalid participant data' });
  }
  room.participants.push(participant);
  saveDB();

  let token = '';
  const isRealConnection = !!(runtimeConfig.livekitApiKey && runtimeConfig.livekitApiSecret);

  // Generate LiveKit token if credentials exist
  if (isRealConnection) {
    try {
      const at = new AccessToken(runtimeConfig.livekitApiKey, runtimeConfig.livekitApiSecret, {
        identity: userId,
        name: name,
        metadata: JSON.stringify({ photoUrl: photoUrl || '', color: color || '#ff4d4d', emoji: emoji || '😊' }),
        ttl: 24 * 60 * 60, // 24 hours
      });
      at.addGrant({ roomJoin: true, room: room.id, canPublish: true, canSubscribe: true });
      token = await at.toJwt();
    } catch (err) {
      console.error('Failed to create LiveKit meeting token:', err.message);
      return res.status(500).json({ error: 'Failed to generate LiveKit token. Please check backend configuration.' });
    }
  }

  res.json({
    room,
    livekitUrl: isRealConnection ? runtimeConfig.livekitUrl : room.livekitUrl,
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
  if (!participant) return res.status(400).json({ error: 'Not in room' });

  const now = Date.now();
  const lastPing = participant.lastPing || now;
  const secondsElapsed = (now - lastPing) / 1000;
  participant.lastPing = now;

  // Only award XP if ping interval is realistic (3-6 seconds)
  // Prevents abuse from manual POST requests
  if (secondsElapsed >= 3 && secondsElapsed <= 10) {
    const isSpeaking = req.body.isSpeaking || false;
    const xpToAward = isSpeaking ? 10 : 5; // per ~4s ping = same rate as client
    
    // Fire and forget
    awardUserXP(userId, xpToAward);
  }

  res.json({ success: true });
});

// API Endpoint: Leave Room
app.post('/api/rooms/:id/leave', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  const room = rooms.find(r => r.id === id);
  if (room) {
    const participant = room.participants.find(p => p.id === userId);
    if (participant && participant.lastPing) {
      const secondsSinceLastPing = (Date.now() - participant.lastPing) / 1000;
      if (secondsSinceLastPing > 3) {
        awardUserXP(userId, Math.floor(secondsSinceLastPing * (5 / 4)));
      }
    }
    room.participants = room.participants.filter(p => p.id !== userId);
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
    if (secondsSinceLastPing > 3) {
      awardUserXP(targetUserId, Math.floor(secondsSinceLastPing * (5 / 4)));
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
    const refs = ids.map(id => db.collection('users').doc(id));
    const docs = await db.getAll(...refs);
    
    const profiles = docs
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          photoUrl: data.photoUrl || '',
          xp: data.xp || 0
        };
      });

    res.json({ profiles });
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
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

// Serve frontend in production build if needed
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Socket.IO Logic
let totalUserCount = 0;
const broadcastOnlineStats = async () => {
  const adminInstance = initFirebaseAdmin();
  if (adminInstance) {
    try {
      const db = adminInstance.firestore();
      const snapshot = await db.collection('users').get();
      totalUserCount = snapshot.size;
    } catch (err) {
      console.warn('Failed to query total user count from Firestore:', err.message);
    }
  } else {
    totalUserCount = 1;
  }

  const onlineUserIds = [...authenticatedOnline];
  io.emit('online-stats', {
    online: authenticatedOnline.size,
    total: totalUserCount,
    onlineUserIds
  });
};

// Periodically update total user count and broadcast stats
setInterval(async () => {
  await broadcastOnlineStats();
}, 15000);

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
    if (!room.activeGame.players.find(p => p.id === playerId)) {
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
    const players = room.activeGame.players;
    const currentIndex = players.findIndex(p => p.id === playerId);
    
    // Handle UNO reverse
    if (newState.direction === -1 && !room.activeGame.direction) {
      room.activeGame.direction = -1;
    }
    const direction = room.activeGame.direction || 1;
    
    // Handle skip
    const skipCount = newState.skipCount || 1;
    let nextIndex = (currentIndex + (direction * skipCount) + players.length) % players.length;
    
    room.activeGame.currentTurnId = players[nextIndex].id;

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
      for (const room of rooms) {
        const before = room.participants.length;
        room.participants = room.participants.filter(p => p != null && p.id != null && p.id !== identity);
        if (room.participants.length !== before) break;
      }
      socketToIdentity.delete(socket.id);
      purgeEmptyRooms();
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

  try {
    const adminInstance = initFirebaseAdmin();
    if (!adminInstance) return res.json(fallback);
    const db = adminInstance.firestore();
    const doc = await db.collection('settings').doc('global').get();
    if (!doc.exists) return res.json(fallback);
    const data = doc.data();
    res.json({
      premiumPrice: data.premiumPrice || fallback.premiumPrice,
      premiumDurationDays: data.premiumDurationDays || fallback.premiumDurationDays,
      qrCodeUrl: data.qrCodeUrl || fallback.qrCodeUrl,
      premiumVisibilityBoost: data.premiumVisibilityBoost ?? fallback.premiumVisibilityBoost
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.json(fallback); // Always return fallback, never 500
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
      .orderBy('submittedAt', 'desc')
      .limit(1)
      .get();
      
    if (requestsSnap.empty) {
      return res.json({ hasRequest: false });
    }
    
    const requestData = requestsSnap.docs[0].data();
    res.json({
      hasRequest: true,
      request: {
        id: requestsSnap.docs[0].id,
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

// Start Server
const PORT = process.env.PORT || 3000;
loadDB();
server.listen(PORT, () => {
  console.log(chalk.cyan.bold(`🚀 Solith Backend running on port ${PORT}`));
});
