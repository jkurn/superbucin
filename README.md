# SUPERBUCIN

**sayang's game collection** — a couples multiplayer minigame collection built for Jonathan & Pricylia.

Live at **[superbucin.pricylia.com](https://superbucin.pricylia.com)**

---

## Games

### Pig vs Chick
A 5-lane real-time battle game inspired by Hago's Sheep Fight.

- Pick your side: **Pig** or **Chicken**
- Spawn units across 5 lanes using your energy
- Units march toward the enemy base and fight opponents in the same lane
- Deal damage when units reach the enemy base
- First to drain the opponent's HP to 0 wins

**4 unit tiers per side:**
| Pig | Chicken | Cost | Strength |
|-----|---------|------|----------|
| Piglet | Chick | 5 | Weak |
| Pig | Hen | 12 | Medium |
| Boar | Chicken | 25 | Strong |
| Big Boar | Rooster | 50 | Massive |

---

## Tech Stack

- **Client**: Vite + Three.js (procedural 3D models, perspective camera)
- **Server**: Node.js + Express + Socket.io (authoritative game loop at 20 ticks/sec)
- **Deploy**: Render (free tier)

## Assets & art reference

Local Kenney packs and 2D/3D inventory (gitignored source folders, what to use for builds): **[ASSETS.md](./ASSETS.md)**.

## Run Locally

```bash
# Install all deps
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start server (port 3000)
npm run dev:server

# Start client (port 5173)
npm run dev:client
```

Then open `http://localhost:5173`, create a room on one tab, join from another.
