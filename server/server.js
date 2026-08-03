import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { AccessToken } from 'livekit-server-sdk';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

// CORS configuration - Fail safely in production if no ALLOWED_ORIGIN is set
let corsOptions;
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ALLOWED_ORIGIN) {
    console.warn(chalk.yellow("⚠ WARNING: ALLOWED_ORIGIN is not set in production. Falling back to strict same-origin to prevent leaks."));
  }
  corsOptions = { origin: process.env.ALLOWED_ORIGIN || false };
} else {
  corsOptions = { origin: '*' };
}

const io = new Server(server, { cors: corsOptions });

app.use(helmet()); // Set basic HTTP security headers
app.use(cors(corsOptions));
app.use(express.json());

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

// Load rooms from db.json if exists
const loadDB = () => {
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

const saveDB = () => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(rooms, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to DB:', err);
  }
};

const awardUserXP = async (userId, durationMs) => {
  if (!userId || durationMs < 60000) return; // Minimum 1 minute to earn XP
  
  const xpEarned = Math.floor(durationMs / 60000) * 1; // 1 XP per minute
  if (xpEarned <= 0) return;

  const adminInstance = initFirebaseAdmin();
  if (!adminInstance) {
    console.warn(`Mock: Awarded ${xpEarned} XP to user ${userId}`);
    return;
  }

  try {
    const db = adminInstance.firestore();
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      xp: adminInstance.firestore.FieldValue.increment(xpEarned)
    });
    console.log(`Successfully awarded ${xpEarned} XP to user ${userId} for ${Math.floor(durationMs / 60000)} minutes of talking.`);
  } catch (error) {
    console.error('Failed to award XP:', error);
  }
};

// Auto-clean stale users and empty rooms
setInterval(() => {
  const now = Date.now();
  let modified = false;
  const initialRoomCount = rooms.length;

  rooms = rooms.filter(room => {
    // Remove real users who haven't pinged in 8 seconds
    const originalCount = room.participants.length;
    
    // Identify who is timing out
    const keptParticipants = [];
    room.participants.forEach(p => {
      if ((now - p.lastPing) < 8000) {
        keptParticipants.push(p);
      } else {
        // Participant timed out, award them XP for their session
        if (p.joinedAt) {
          const durationMs = Date.now() - p.joinedAt;
          awardUserXP(p.id, durationMs); // Async, fire and forget
        }
      }
    });

    room.participants = keptParticipants;

    if (room.participants.length !== originalCount) {
      modified = true;
    }

    // Phase 3: Auto-delete empty rooms
    if (room.participants.length === 0) {
      if (!room.emptySince) {
        room.emptySince = now;
        modified = true;
      } else if (now - room.emptySince > 5 * 60 * 1000) {
        // Room empty for > 5 mins
        if (io) io.to(room.id).emit('room-deleted');
        return false;
      }
    } else {
      if (room.emptySince) {
        delete room.emptySince;
        modified = true;
      }
    }
    
    return true;
  });

  if (rooms.length !== initialRoomCount) {
    modified = true;
  }

  if (modified) {
    saveDB();
  }
}, 4000);

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
app.post('/api/config', (req, res) => {
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
app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

const SUPPORTED_LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Portuguese', 'Korean'];

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
  max: 1500,
  message: { error: 'Too many rooms created from this IP, please try again after 15 minutes.' }
});

// API Endpoint: Create Room
app.post('/api/rooms', verifyToken, roomCreationLimiter, async (req, res) => {
  const { name, language, topic, tags } = req.body;

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

  // 1. If LiveKit API is available, use real URL
  if (runtimeConfig.livekitApiKey && runtimeConfig.livekitApiSecret) {
    livekitUrl = runtimeConfig.livekitUrl;
    console.log(`Real LiveKit Room Created Implicitly: ${roomId}`);
  } else {
    return res.status(500).json({ error: 'LiveKit configuration is missing. Cannot create real rooms.' });
  }

  const newRoom = {
    id: roomId,
    name,
    language,
    topic: topic ? topic.trim() : '',
    tags: validTags,
    participants: [],
    roles: req.user ? { [req.user.uid]: 'owner' } : {},
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
  const { userId, name, color, emoji } = req.body;

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

  // Remove user from any other rooms they might be in
  rooms.forEach(r => {
    r.participants = r.participants.filter(p => p.id !== userId);
  });

  // Add user to the target room
  const participant = {
    id: userId,
    name,
    color: color || '#ff4d4d',
    emoji: emoji || '😊',
    joinedAt: Date.now(),
    lastPing: Date.now()
  };
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
        ttl: 24 * 60 * 60, // 24 hours
      });
      at.addGrant({ roomJoin: true, room: room.id, canPublish: true, canSubscribe: true });
      token = await at.toJwt();
    } catch (err) {
      console.error('Failed to create LiveKit meeting token:', err.message);
    }
  }

  res.json({
    room,
    livekitUrl: room.livekitUrl,
    token,
    isRealConnection
  });
});

// API Endpoint: Keep-Alive Ping
app.post('/api/rooms/:id/ping', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  const room = rooms.find(r => r.id === id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const participant = room.participants.find(p => p.id === userId);
  if (participant) {
    participant.lastPing = Date.now();
    res.json({ success: true });
  } else {
    // Re-register if somehow cleared
    res.status(400).json({ error: 'Participant not in room, please join again' });
  }
});

// API Endpoint: Leave Room
app.post('/api/rooms/:id/leave', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  const room = rooms.find(r => r.id === id);
  if (room) {
    const participant = room.participants.find(p => p.id === userId);
    if (participant && participant.joinedAt) {
      const durationMs = Date.now() - participant.joinedAt;
      awardUserXP(userId, durationMs); // Async, fire and forget
    }
    room.participants = room.participants.filter(p => p.id !== userId);
    saveDB();
  }

  res.json({ success: true });
});

// Moderation Endpoints
app.post('/api/rooms/:id/promote', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  if (!room.roles) room.roles = {};
  if (room.roles[req.user.uid] !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can promote' });
  }
  if (room.roles[targetUserId] === 'owner') {
    return res.status(400).json({ error: 'Cannot promote owner' });
  }

  room.roles[targetUserId] = 'co-host';
  saveDB();
  io.to(id).emit('role-changed', { userId: targetUserId, role: 'co-host' });
  res.json({ success: true, roles: room.roles });
});

app.post('/api/rooms/:id/kick', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.roles) room.roles = {};

  const requesterRole = room.roles[req.user.uid] || 'guest';
  if (requesterRole !== 'owner' && requesterRole !== 'co-host') {
    return res.status(403).json({ error: 'Not authorized to kick' });
  }
  if (room.roles[targetUserId] === 'owner') {
    return res.status(403).json({ error: 'Cannot kick owner' });
  }

  const targetParticipant = room.participants.find(p => p.id === targetUserId);
  if (targetParticipant && targetParticipant.joinedAt) {
    const durationMs = Date.now() - targetParticipant.joinedAt;
    awardUserXP(targetUserId, durationMs); // Async, fire and forget
  }

  room.participants = room.participants.filter(p => p.id !== targetUserId);
  saveDB();
  io.to(id).emit('participant-kicked', { userId: targetUserId });
  res.json({ success: true });
});

app.post('/api/rooms/:id/mute', verifyToken, (req, res) => {
  const { id } = req.params;
  const { targetUserId } = req.body;
  const room = rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.roles) room.roles = {};

  const requesterRole = room.roles[req.user.uid] || 'guest';
  if (requesterRole !== 'owner' && requesterRole !== 'co-host') {
    return res.status(403).json({ error: 'Not authorized to mute' });
  }

  io.to(id).emit('participant-muted', { userId: targetUserId });
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

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const targetDoc = await transaction.get(targetRef);

      const userFollowing = userDoc.exists ? (userDoc.data().following || []) : [];
      const targetFollowers = targetDoc.exists ? (targetDoc.data().followers || []) : [];

      const isFollowing = userFollowing.includes(targetId);

      if (isFollowing) {
        // Unfollow
        transaction.set(userRef, { following: adminInstance.firestore.FieldValue.arrayRemove(targetId) }, { merge: true });
        transaction.set(targetRef, { followers: adminInstance.firestore.FieldValue.arrayRemove(userId) }, { merge: true });
      } else {
        // Follow
        transaction.set(userRef, { following: adminInstance.firestore.FieldValue.arrayUnion(targetId) }, { merge: true });
        transaction.set(targetRef, { followers: adminInstance.firestore.FieldValue.arrayUnion(userId) }, { merge: true });
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in toggle-follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow.' });
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

import setupAdminRoutes from './adminRoutes.js';

// Setup admin routes
setupAdminRoutes(app, rooms, saveDB, io);

// Serve frontend in production build if needed
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log(chalk.green(`✓ Socket connected: ${socket.id}`));

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Send existing message history to the user joining
    const room = rooms.find(r => r.id === roomId);
    if (room && room.messages) {
      socket.emit('chat-history', room.messages);
    }
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('chat-message', (data) => {
    const { roomId, message } = data;
    
    // Broadcast immediately to everyone else in the room
    socket.to(roomId).emit('chat-message', message);

    // Save to persistence
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      if (!room.messages) room.messages = [];
      room.messages.push(message);
      
      // Keep only the last 50 messages
      if (room.messages.length > 50) {
        room.messages = room.messages.slice(-50);
      }
      saveDB();
    }
  });

  socket.on('disconnect', () => {
    console.log(chalk.yellow(`✗ Socket disconnected: ${socket.id}`));
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
loadDB();
server.listen(PORT, () => {
  console.log(chalk.cyan.bold(`🚀 Solith Backend running on port ${PORT}`));
});
