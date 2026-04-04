```
╔══════════════════════════════════════════════════════════════════════╗
║                     SUPERBUCIN — ARCHITECTURE                        ║
╚══════════════════════════════════════════════════════════════════════╝

  LOCAL DEV                        DEPLOYMENT LIFECYCLE
  ─────────────────                ────────────────────────────────────

  client/                           git push → main
  ├── src/                                │
  │   ├── games/                          ▼
  │   │   └── pig-vs-chick/        GitHub (jkurn/superbucin)
  │   │       ├── PigVsChickScene.js      │
  │   │       ├── CubePetModels.js        │ webhook
  │   │       ├── config.js               ▼
  │   │       └── GameState (mirror) Render Build
  │   └── shared/                   npm install
  │       └── NetworkManager.js     cd server && npm install
  │                                 cd client && npm install
  server/                           npx vite build → client/dist/
  ├── index.js                            │
  └── games/                             ▼
      └── pig-vs-chick/            Render Deploy (npm start)
          └── GameState.js                │
                                          ▼
  npm run dev          ┌─────────── server/index.js ────────────┐
  ├── dev:server       │                                        │
  │   node index.js    │  Express          Socket.io            │
  │   :3000            │  ──────           ─────────            │
  └── dev:client       │  Static files     WebSocket            │
      vite --host      │  client/dist/     game loop            │
      :5173            │  SPA fallback     20 ticks/sec         │
                       └────────────────────────────────────────┘
                                          │
  INFRASTRUCTURE                          │ HTTPS + WSS
  ─────────────────────────────           │
                                          ▼
  pricylia.com registrar           ┌─────────────┐
  └── DNS CNAME                    │   Browser   │
      superbucin ──────────────▶   │   Player 1  │
      superbucin.pricylia.com      └─────────────┘
              │                          │
              ▼                    Socket.io (ws/polling)
       Render CDN / Edge                 │
              │                    ┌─────────────┐
              ▼                    │   Browser   │
       Render Free Tier            │   Player 2  │
       (superbucin service)        └─────────────┘
       ├── 512 MB RAM
       ├── Shared CPU              GAME FLOW
       ├── Auto-sleep 15min        ──────────────
       └── 750 hrs/mo free         create-room
                                   join-room
  TECH STACK                       select-side
  ─────────────────                game-start
  Client  Vite + Three.js 3D       ◀── game-state (20/sec)
  Server  Node.js + Express        spawn-unit ──▶
  WS      Socket.io                ◀── round-end
  Build   Vite (ESM bundle)        ◀── match-end
  Hosting Render (free)
  Domain  pricylia.com (custom)
```
