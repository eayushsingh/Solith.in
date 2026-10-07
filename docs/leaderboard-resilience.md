# Leaderboard Resiliency & Zero-Error Fallback Strategy

## Guarantee
The Solith Hall of Fame Leaderboard component is engineered with a **Zero-Error Fallback Guarantee**. Under no circumstance will the user be presented with a dead-end error box ("Firebase connection failed. Check your config.") or a broken UI.

## Connection Architecture

```
1. Firestore Real-time Snapshot Stream
       │ (On error / block / permission / quota fail)
       ▼
2. Local Browser Cache (localStorage solith_leaderboard_cache_<tab>)
       │ (If cache missing)
       ▼
3. Backend Express REST Endpoint (/api/leaderboard?period=<tab>)
       │ (If server DB uninitialized or offline)
       ▼
4. Embedded Client-Side Mock Dataset (DEFAULT_MOCK_LEADERS)
```

## Key Mechanisms
- **Graceful Failover:** Automatically steps down through tiers without throwing unhandled UI exceptions.
- **Background Polling & Auto Re-sync:** Continuously polls backend endpoints and listens for network reconnection events to resume live data streaming.
- **Diagnostics & Status Pills:** Displays non-intrusive status indicators ("Offline / Cache Mode") instead of blocking the app.
