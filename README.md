# SOLITH.IN Voice Chat

SOLITH.IN is a real-time, browser-based voice chat app built with React, Express, Socket.IO, and LiveKit.

## Deployment Guide

We are splitting the deployment: 
- **Frontend** (Vite/React) will be hosted on **Vercel**
- **Backend** (Express/Socket.IO) will be hosted on **Render**

Follow these exact steps to deploy your application to production.

### Phase 1: Deploy the Backend on Render
The backend needs to be deployed first so you can get the API URL for the frontend.

1. Create an account on [Render.com](https://render.com) and link your GitHub account.
2. Go to your Render Dashboard and click **New+** -> **Blueprint**.
3. Select this GitHub repository. Render will automatically read the `render.yaml` file included in this repo.
4. Render will prompt you to fill in the missing Environment Variables (`sync: false`). Fill them in as follows:
   - `LIVEKIT_API_KEY`: *(Optional)* Your production API Key from the LiveKit dashboard.
   - `LIVEKIT_API_SECRET`: *(Optional)* Your LiveKit API secret.
   - `LIVEKIT_URL`: *(Optional)* Your LiveKit WebSocket URL (for example, `wss://your-project.livekit.cloud`).
   - `ALLOWED_ORIGIN`: Leave this blank or put `*` for now (you will come back and change this after deploying the frontend).
5. Click **Apply**.
6. Wait for the deploy to finish. Once it says "Live", click on your Web Service (`solith-backend`). 
7. At the top of the page, **copy your Render URL** (e.g., `https://solith-backend.onrender.com`).

### Phase 2: Deploy the Frontend on Vercel
Now that you have your backend URL, you can deploy the frontend.

1. Create an account on [Vercel.com](https://vercel.com) and link your GitHub account.
2. Click **Add New** -> **Project**.
3. Import this GitHub repository.
4. In the "Configure Project" screen, ensure the Framework Preset is detected as **Vite**.
5. Set the **Root Directory** to `client` (Click edit and type `client`, then save).
6. Open the **Environment Variables** dropdown and add:
   - Name: `VITE_API_URL`
   - Value: *(Paste the Render URL you copied in Phase 1, make sure there is no trailing slash! e.g., `https://solith-backend.onrender.com`)*
7. Click **Deploy**.
8. Once deployed, **copy your new Vercel domain** (e.g., `https://solith-xxx.vercel.app`).

### Phase 3: Final Integration (CORS)
To secure your backend, we need to tell it to only accept requests from your Vercel URL.

1. Go back to the **Render Dashboard** and open your `solith-backend` Web Service.
2. Click on **Environment** in the left sidebar.
3. Find the `ALLOWED_ORIGIN` variable.
4. Paste your Vercel URL (e.g., `https://solith-xxx.vercel.app`). *Make sure there is no trailing slash!*
5. Click **Save Changes**. This will trigger a quick restart of your backend.

### Real Production Data Architecture
The application is fully synchronized with live production data:
- **Leaderboards & User Stats**: Powered by Firestore with multi-path Firebase Admin discovery. Zero mock users (Sophia Chen, Alexander Wright, etc.) are injected; rankings reflect real registered learners (XP, talk time, and streaks).
- **Graceful Live States**: Empty periods display clean waiting states rather than synthetic bots.
- **Real Voice Rooms**: LiveKit and Socket.IO voice participant streams represent real connected speakers with media track visualizers.
- **Global Chat & Community Feed**: Live Firestore streams with realtime subscriptions.

Open to Contribute

