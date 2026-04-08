# SUPERBUCIN

**sayang's game collection** — a couples multiplayer minigame collection built for Jonathan & Pricylia.

Live at **[superbucin.pricylia.com](https://superbucin.pricylia.com)**

---

## Games

Current server-registered games:

- **Pig vs Chick** — 5-lane real-time battle (energy economy + tug-of-war pushes)
- **Othello** — classic 8x8 Reversi
- **Memory Match** — themed packs, grid/speed options
- **Speed Match** — rapid quiz rounds with timed scoring
- **Word Scramble Race** — trace words on a randomized grid
- **Doodle Guess** — drawer vs guesser rounds
- **Connect Four** — server-authoritative 7x6 drops
- **Quiz Race** — first-correct round scoring
- **Mini Battleship** — hidden-board ship placement + shots
- **Vending Machine** — versus vending strategy mini-game
- **Bonk Brawl** — cute real-time brawl mode
- **Cute Aggression** — virus-vs-virus mini-game set

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
# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start server + client together
npm run dev
```

Open `http://localhost:5173`, create a room on one tab, then join from another.

### Useful scripts

```bash
# Start only backend
npm run dev:server

# Start only frontend
npm run dev:client

# Lint JS in client/src and server
npm run lint

# Run all tests
npm test

# Run all tests with coverage table
npm run test:coverage

# Run coverage with fail-fast quality gate
npm run test:coverage:gate
```

### Environment variables

Copy `.env.example` to `.env` and fill in the four Supabase values:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
LOG_LEVEL=info
```

---

## Engineering hygiene and observability

- **CI**: `.github/workflows/ci.yml` runs lint, tests, coverage gate, build, and `npm audit`.
- **Security scanning**: `.github/workflows/codeql.yml` runs CodeQL on pushes/PRs + weekly schedule.
- **Secret scanning**: `.github/workflows/secret-scan.yml` runs Gitleaks on pushes/PRs.
- **Dependency updates**: `.github/dependabot.yml` enables weekly npm + GitHub Actions update PRs.
- **Coverage gate**: `scripts/coverage-gate.mjs` enforces baseline thresholds in CI.
- **Structured server logs**: `server/observability/logger.js` emits JSON logs with request/socket metadata.
- **Env validation**: `server/config/env.js` validates runtime config and enforces required production vars.

---

## Testing strategy (current)

The project now uses a layered testing approach:

- **GameState unit tests** (`server/games/*/GameState.test.js`)
- **RoomManager contract tests** (`server/rooms/RoomManager.test.js`) for event routing, payload privacy, reconnect behavior
- **UserService persistence tests** (`server/services/UserService.test.js`)
- **NetworkManager client contract tests** (`client/src/shared/NetworkManager.test.js`)

Reference plan: `planning/2026-04-07-robust-testing-strategy.md`
Weekly status and metrics: `planning/2026-04-07-testing-health.md`

---

## Git LFS (required for sticker assets)

`pricy-sticker/*.webp` is tracked via Git LFS.

### One-time setup

```bash
# macOS (Homebrew)
brew install git-lfs

# Initialize LFS hooks
git lfs install
```

### Clone / pull behavior

- On clone/pull, Git fetches lightweight pointer files via normal Git.
- Git LFS then downloads the real `.webp` binaries.

If assets look like pointer text files, run:

```bash
git lfs pull
```
