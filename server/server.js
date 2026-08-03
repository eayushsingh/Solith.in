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
import { initFirebaseAdmin, verifyToken } from './firebaseAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGIN || '*' } // Strictly allow frontend URL in prod
});

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

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

  // Inject standard mock rooms if the list is empty
  if (rooms.length === 0) {
    rooms = [
      {
        id: 'room-1',
        name: 'Chill Coffee Chat ☕',
        language: 'English',
        topic: 'Casual conversation, hobbies, and weekend plans. Everyone is welcome!',
        tags: ['Casual', 'Beginner Friendly'],
        participants: [
          { id: 'mock-user-1', name: 'Sophia', color: '#ff4d4d', emoji: '👩‍🦰', joinedAt: Date.now(), lastPing: Date.now() },
          { id: 'mock-user-2', name: 'Hiro', color: '#4da6ff', emoji: '👦', joinedAt: Date.now(), lastPing: Date.now() }
        ],
        roles: { 'mock-user-1': 'owner', 'mock-user-2': 'co-host' },
        messages: [],
        createdAt: Date.now()
      },
      {
        id: 'room-2',
        name: 'Debate: AI & Human Creativity 🧠',
        language: 'Spanish',
        topic: 'Discusión sobre si la inteligencia artificial reemplazará a los artistas.',
        tags: ['Debate', 'Intermediate'],
        participants: [
          { id: 'mock-user-3', name: 'Elena', color: '#33cc33', emoji: '👩', joinedAt: Date.now(), lastPing: Date.now() }
        ],
        roles: { 'mock-user-3': 'owner' },
        messages: [],
        createdAt: Date.now()
      },
      {
        id: 'room-3',
        name: 'Job Interview Practice 💼',
        language: 'French',
        topic: 'Pratique des questions typiques d\'entretien d\'embauche. Formel.',
        tags: ['Interview Prep', 'Advanced'],
        participants: [],
        roles: {},
        messages: [],
        createdAt: Date.now()
      }
    ];
    saveDB();
  }
};

const saveDB = () => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(rooms, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to DB:', err);
  }
};

// Auto-clean stale users and empty rooms
setInterval(() => {
  const now = Date.now();
  let modified = false;
  const initialRoomCount = rooms.length;

  rooms = rooms.filter(room => {
    // Filter out mock users from stale cleaning so the rooms feel alive during first look!
    // But remove real users who haven't pinged in 8 seconds
    const originalCount = room.participants.length;
    room.participants = room.participants.filter(p => {
      if (p.id.startsWith('mock-user-')) return true;
      return (now - p.lastPing) < 8000;
    });

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

function isJunkText(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 4) return true; // Too short (e.g. "hi")
  
  // Rule 2: Check for 4+ identical consecutive characters (e.g. "hiiii99")
  if (/(.)\1{3,}/.test(trimmed)) return true;
  
  // Rule 3: Check for 5+ consecutive consonants (catches keyboard smashes like "hjhhj")
  if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(trimmed)) return true;

  return false;
}

// API Endpoint: Create Room
app.post('/api/rooms', verifyToken, async (req, res) => {
  const { name, language, topic, tags } = req.body;

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: 'Invalid language selection' });
  }

  if (isJunkText(name)) {
    return res.status(400).json({ error: 'Room name must be a valid, descriptive phrase.' });
  }

  if (topic && topic.trim().length > 0 && isJunkText(topic)) {
    return res.status(400).json({ error: 'Room topic must be a valid, descriptive phrase.' });
  }

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
    // 2. Demo fallback
    console.warn('⚠️ LIVEKIT_API_KEY missing - running in Demo Mode');
    livekitUrl = `wss://solith-demo.livekit.cloud`;
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
app.post('/api/rooms/:id/ping', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

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
app.post('/api/rooms/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const room = rooms.find(r => r.id === id);
  if (room) {
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
  console.log('Socket connected:', socket.id);

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
    console.log('Socket disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
loadDB();
server.listen(PORT, () => {
  console.log(`Solith Backend running on port ${PORT}`);
});
