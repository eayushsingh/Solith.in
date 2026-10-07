# Leaderboard Resiliency & Multi-Tier Fallback Architecture

## Overview
This document outlines the zero-downtime multi-tier connection fallback mechanism built into the Solith Hall of Fame Leaderboard.

## Fallback Layers

```
1. Client Firestore (onSnapshot Real-time Stream)
       ↓ (If offline, permission denied, quota limit, or network blocked)
2. Local Browser Cache (localStorage solith_leaderboard_cache_<tab>)
       ↓ (If cache missing or expired)
3. Backend REST API (/api/leaderboard?period=<tab>)
       ↓ (If server DB uninitialized or empty)
4. Server Seed Mock Dataset (getMockLeaderboardSeedData)
```

## Resilience Features
- **Auto Reconnect:** Listens to browser `online` events and re-subscribes automatically when connectivity returns.
- **Exponential Backoff:** Retries 3 times with progressive delays on network dropouts.
- **Visual Diagnostics:** Displays subtle status indicators instead of breaking with blank error screens.
- **Offline Persistence:** Instant UX rendering via local cache while background connection establishes.
