# TalkFree / Solith Architecture Overview

This document provides a high-level, production-grade overview of the system architecture. It is designed to give founders, stakeholders, and engineers a complete understanding of how the platform operates in real-time.

---

## 1. The Core Stack

*   **Frontend**: React (Vite), Tailwind CSS, LiveKit Web SDK
*   **Backend**: Node.js, Express, Socket.io, LiveKit Server SDK
*   **Database**: Firebase Firestore (NoSQL)
*   **Authentication**: Firebase Auth (Google Sign-In)
*   **Real-time Audio**: LiveKit Cloud

---

## 2. System Flow & Data Layer

The system separates **transient state** (fast, temporary data) from **persistent state** (long-term storage).

### A. The Database (Firestore) - *Persistent Storage*
Firestore is kept lean to minimize costs. It **does not** store active voice rooms. It only stores:
*   **Users (`users` collection):** Profile data, Premium status, and Gamification stats (XP, daily/weekly/monthly XP).
*   **Global Chat (`global_chat` collection):** Text messages from the lobby.
*   **System Settings (`settings` collection):** Metadata like `lastAwardedMonth` for the cron jobs.

### B. The Backend (Node.js) - *Transient State & Logic*
The Node server is the brain of the real-time interactions.
*   **In-Memory Rooms:** Voice rooms are stored purely in RAM (`const rooms = []`). This allows lightning-fast room creation, joining, and listing without database reads/writes.
*   **LiveKit Webhooks:** Listens to events from LiveKit Cloud (e.g., when a user loses internet, the webhook tells Node.js to remove them from the in-memory room).
*   **Continuous XP Engine:** Listens to HTTP `/ping` requests from users currently in rooms (every 4 seconds). It awards 5-10 XP directly to Firestore if the user is actively listening or speaking.
*   **Automated Rewards:** Runs a 12-hour cron job (`setInterval`) that detects month-rollovers and automatically grants Premium to the top 3 users.

### C. The Frontend (React) - *Real-Time UI*
The client is highly reactive, combining WebRTC streams with WebSocket and Firestore streams.
*   **LiveKit SDK:** Handles the actual P2P/SFU WebRTC audio mesh. It analyzes microphone activity (`audioLevels`) to show who is currently speaking.
*   **Socket.io:** Connects to the Node server to receive instant updates on lobby counts (`online-stats`), hand-raises, and kicks.
*   **Firestore Listeners (`onSnapshot`):** Subscribes to the user's XP in Firestore. When the Node server awards XP via the ping, Firestore instantly pushes the new XP to the client, triggering the floating "+10 XP" animation natively.

---

## 3. The Complete User Journey

1.  **Authentication**: User logs in via Google. Frontend establishes a Socket.io connection and emits an `authenticate` event so the server counts them as an active online user.
2.  **Lobby**: Frontend requests the live, in-memory room list from the Node backend and displays it.
3.  **Joining a Room**: User clicks a room. The Node backend generates a secure LiveKit Token. The Frontend uses this token to connect to the LiveKit Cloud audio mesh.
4.  **Earning XP**: While in the room, the Frontend sends a `/ping` to the Node server every 4 seconds. The server writes +5 or +10 XP to Firestore.
5.  **Gamification Loop**: Firestore instantly syncs the new XP to the Frontend via `onSnapshot`, driving the UI.
6.  **Disconnection**: When the user leaves (or closes the tab), a `navigator.sendBeacon` safely cleans them out of the in-memory room. Any missed connections are caught by LiveKit Webhooks.
