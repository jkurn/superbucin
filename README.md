# SUPERBUCIN

**sayang's game collection** — a couples multiplayer minigame collection built for Jonathan & Pricylia.

Live at **[superbucin.pricylia.com](https://superbucin.pricylia.com)**

---

## Games

### Pig vs Chick
A 5-lane real-time battle game inspired by Hago's Sheep Fight.

- Pick your side: **Pig** or **Chicken**
- Spawn units across 5 lanes using your energy bar
- Units march toward the enemy base and clash via tug-of-war combat (weight-based pushing)
- Deal damage when a unit reaches the opponent's base
- First to drain the opponent's HP to 0 wins

**4 unit tiers per side:**
| Pig | Chicken | Cost | Weight |
|-----|---------|------|--------|
| Piglet | Chick | 5 | 10 kg |
| Pig | Hen | 12 | 20 kg |
| Boar | Chicken | 25 | 50 kg |
| Big Boar | Rooster | 50 | 70 kg |

---

### Othello
Classic 8×8 Othello/Reversi.

- One player is **Black**, the other **White**
- Flip your opponent's discs by sandwiching them
- Most discs at the end wins

---

### Memory Match
Flip card pairs from memory before your opponent does.

- Multiple themed packs (Photo pack and more)
- Configurable grid size and speed mode
- Score by collecting the most matched pairs

---

### Speed Match
A rapid-fire quiz race.

- 10 questions per round + 2 bonus questions
- 15 seconds per question — first correct answer scores 10 pts (bonus: 20 pts)
- Most points after all rounds wins

---

### Word Scramble Race
Hunt for words in a letter grid.

- 5-round format, 75 seconds per round
- Trace connected letters on a randomized 5×5 grid to form English words
- Longer words score more points; same word can only be claimed once per round

---

### Doodle Guess
One draws, the other guesses — Draw Something style.

- 6 rounds, 30 seconds to draw each prompt
- Guess faster for more points (up to 100 pts, minimum 8 pts if correct)
- Themed prompt packs: **Love & us**, and more

---

## Tech Stack

- **Client**: Vite + Three.js (procedural 3D for Pig vs Chick; Canvas 2D for Doodle Guess)
- **Server**: Node.js + Express + Socket.io (server-authoritative game loops, 20 ticks/sec)
- **Auth / Persistence**: Supabase
- **Deploy**: Render (auto-deploy on push to `main`)

## Assets & art reference

Local Kenney packs and 2D/3D inventory (gitignored source folders): **[ASSETS.md](./ASSETS.md)**

---

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

Open `http://localhost:5173`, create a room on one tab, join from another.

### Environment variables

Copy `.env.example` to `.env` and fill in the four Supabase values:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```
