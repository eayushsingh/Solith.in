import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const globalSocketKey = '__Talk34Socket__';

if (!globalThis[globalSocketKey]) {
  globalThis[globalSocketKey] = io(API_URL, {
    autoConnect: true,
    reconnection: true,
    transports: ['websocket', 'polling'],
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