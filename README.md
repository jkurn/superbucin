# SUPERBUCIN

**sayang's game collection** — a couples multiplayer minigame collection built for Jonathan & Pricylia.

Live at **[superbucin.pricylia.com](https://superbucin.pricylia.com)**

### Product & planning

- **Roadmap & metrics:** [planning/2026-04-08-product-plan.md](./planning/2026-04-08-product-plan.md) — pillars, journeys, phased roadmap, backlog, links to all other plans
- **Analytics spec:** [planning/2026-04-08-event-tracking-dictionary.md](./planning/2026-04-08-event-tracking-dictionary.md)
- **PostHog viral dashboard (setup guide):** [planning/2026-04-08-posthog-viral-dashboard.md](./planning/2026-04-08-posthog-viral-dashboard.md)

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
- **Sticker Mash Duel** — countdown into endless tap high-score duel

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

PostHog (optional, frontend analytics):

```
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://eu.i.posthog.com
# optional (default in code matches PostHog install snippet)
VITE_POSTHOG_DEFAULTS=2026-01-30
# optional override, otherwise inferred from hostname
VITE_APP_ENV=production
```

Use the **EU** host if your PostHog project is on EU cloud; use `https://us.i.posthog.com` for US. If you use PostHog’s **managed reverse proxy**, set `VITE_POSTHOG_HOST` to that URL (for example `https://t.yourdomain.com`) so the SDK sends events through your domain.

If `VITE_POSTHOG_KEY` is missing, analytics is disabled automatically. Never commit real keys; set them in `.env` locally and in Render (or your host) only.

PostHog filtering best practice:
- Exclude `environment=local` in production dashboards/insights.
- Keep internal QA users tagged and excluded (for example by email domain or person property).

Viral loop dashboard (widgets, funnels, KPI formulas): see `planning/2026-04-08-posthog-viral-dashboard.md`.

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
- **RoomManager tests** (`server/rooms/RoomManager.*.test.js` — lifecycle, contracts, reconnect, persistence) for routing, payload privacy, reconnect behavior
- **UserService persistence tests** (`server/services/UserService.test.js`)
- **NetworkManager client contract tests** (`client/src/shared/NetworkManager.test.js`)
- **Lobby viral deep-link parsing** (`client/src/shared/lobbyDeepLink.test.js`)

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
