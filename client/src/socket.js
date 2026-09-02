import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const globalSocketKey = '__Talk34Socket__';

if (!globalThis[globalSocketKey]) {
  globalThis[globalSocketKey] = io(API_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000, // 20s handshake timeout — tolerates Render cold starts
    transports: ['polling', 'websocket'], // Start with polling (always works), auto-upgrade to websocket
    upgrade: true,
  });
}

const socket = globalThis[globalSocketKey];

// Handle Vite HMR to prevent multiple socket connections
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (globalThis[globalSocketKey]) {
      globalThis[globalSocketKey].disconnect();
      globalThis[globalSocketKey] = null;
    }
  });
}

export default socket;