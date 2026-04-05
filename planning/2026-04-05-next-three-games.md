<!-- /autoplan restore point: planning/_restore/2026-04-05-next-three-games.restore.md -->

# Plan: Next three SUPERBUCIN minigames

**Intent:** After the current five-game lineup ships stable, add **three** new 2-player realtime games that fit the couples / Hago-style collection, reuse `GameRegistry` + `GameFactory` + `RoomManager` patterns, and diversify mechanics (not “another grid word game”).

**Base branch:** `main`  
**UI scope:** Yes (each game has lobby card, side select or role pick, in-game HUD)

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | SELECTIVE EXPANSION mode | P1 completeness | Ship 3 concrete games with full failure-mode thinking, not a vague backlog | HOLD-only doc |
| 2 | CEO | Pick **Connect Four** as game A | P1 + P3 | Fills “vertical drop + physics feel” niche; reuses Othello-style grid authority | Pure Tic-Tac-Toe (too shallow) |
| 3 | CEO | Pick **Mini Battleship (5×5)** as game B | P1 | Only hidden-information game in roster; banter-friendly | Full 10×10 (too long on mobile) |
| 4 | CEO | Pick **Quiz Race** as game C | P1 + P4 | Reuses “host content pack” idea like Doodle; no LLM v1 | Rhythm game (audio sync risk, P3) |
| 5 | Design | Shared neon shell + per-game accent | P5 explicit | One HUD chrome pattern; each game gets one signature color | Full redesign |
| 6 | Eng | No new transport; socket events namespaced per game | P4 DRY | Same as `submit-word`, `memory-flip`, `game-action` | New WebRTC |
| 7 | Eng | Server-authoritative state for all three | P1 | Anti-cheat for Quiz timestamps + Battleship | Client-trust scoring |
| 8 | Tests | Defer E2E Playwright; require GameState unit tests | P3 | Matches Othello test precedent | Block ship on full E2E |

---

## Phase 1 — CEO review (SELECTIVE EXPANSION)

### 0A — Premise challenge

| Premise | Verdict |
|---------|---------|
| “We need more games” is the right problem | **Yes** — collection value is the product; 5 titles is healthy, 8+ feels like a real “arcade.” |
| Outcome is “Pricylia opens one link, they laugh, low friction” | **Yes** — all three picks are **short sessions** (5–12 min). |
| Doing nothing | Stale novelty; same five loops forever. |

**Framing:** Build **one game per “mechanic family”** still missing: (1) gravity column, (2) hidden info, (3) speed knowledge.

### 0B — Existing code leverage

| Sub-problem | Leverage |
|-------------|----------|
| Room + socket lifecycle | `RoomManager`, `GameFactory.create`, `handleGameEvent` |
| Client scene swap | `GameRegistry`, `UIManager.startGame`, `NetworkManager` listeners |
| Turn-based grid | `server/games/othello/GameState.js` patterns (turn, emit state, match-end) |
| Content packs | `doodle-guess` custom prompts + `memory-match` pack id |
| Dictionary / external API | **Not needed** for these three (keeps ops simple) |

### 0C — Dream state diagram

```
  CURRENT (5 games)              THIS PLAN (+3)                 12-MONTH IDEAL
  PvC, Othello, WSR,      --->   + Connect Four          --->   12–15 games, seasonal
  Doodle, Memory                 + Mini Battleship              “drops,” shared stats,
                                 + Quiz Race                    optional async daily
```

### 0D — Mode analysis (expansion)

- **10x variant:** User-generated pack marketplace + weekly featured quiz decks — **defer** (trust/moderation).
- **Delight (≤30 min each):** (1) Connect Four win confetti, (2) Battleship “splash/miss” SFX hook in Web Audio TODO, (3) Quiz “streak” multiplier.

### 0E — Temporal interrogation

| Window | Risk |
|--------|------|
| Hour 1 | `GameFactory.getConfig` branch proliferation — keep each game’s client config minimal |
| Hour 2–3 | Battleship phase machine (place → battle) vs Connect Four single phase |
| Hour 4–5 | Quiz server timestamp for “first correct” — clock skew |
| Hour 6+ | Mobile layout for 5×5 + side-by-side quiz answers |

### 0F — Mode confirmation

**SELECTIVE EXPANSION** applied: three full games, explicitly **not** a 10-game roadmap.

### Error & Rescue Registry

| Error | Trigger | User sees | Rescue |
|-------|---------|-----------|--------|
| UNKNOWN_GAME | typo in gameType | “Unknown game type” | Already in factory |
| PLACEMENT_INVALID | bad ship coords | toast / action-error | Server rejects, state unchanged |
| PACK_EMPTY | quiz JSON empty on create | create-room error | Host must add questions |
| CLOCK_SKEW | extreme latency | optional “too fast” discard | Server uses receive order + monotonic round |

### Failure Modes Registry

| Mode | Mitigation |
|------|------------|
| Double submit (Quiz) | Per-player tail promise or single active round lock |
| Reveal cheating (Battleship) | Never emit opponent grid; only hit/miss/sink |
| Column race (Connect Four) | Same pattern as word-scramble `submitWord` serialization if needed |

### NOT in scope (deferred)

- Matchmaking, MMR, spectators
- LLM-generated quiz questions (v1)
- Real-money / wagering
- Offline mode

### What already exists

- Multi-game registration pipeline (client + server)
- `match-end` + `UserService.recordMatch`
- Kenney `boardgame-pack` for chips / UI accents (@ASSETS.md)

### Completion summary (CEO)

| Area | Status |
|------|--------|
| Strategic fit | Strong — fills mechanic gaps |
| Couples tone | Quiz + Battleship support custom “inside joke” content |
| Risk | Medium on Quiz timestamp fairness; mitigated by server adjudication |

---

## Phase 2 — Design review (7 dimensions)

**Assumption:** Keep existing SUPERBUCIN neon pink/blue shell (`design-reports/design-audit-superbucin-2026-04-05.md`).

| Dimension | Score | Notes |
|-----------|-------|-------|
| Hierarchy | B+ | One primary action per phase (drop / fire / tap answer) |
| Typography | B | Stay system-ui; large tap labels on quiz |
| Color | B+ | Connect: blue/red discs; Battleship: ocean gradient optional; Quiz: use existing pill scores |
| Spacing / layout | B | Mini 5×5 grid must respect thumb zone |
| Motion | B | Drop animation (Connect); hit splash (Battleship) — `prefers-reduced-motion` |
| Accessibility | B- | Answer buttons must be real `<button>` (learn from FINDING-002) |
| AI slop | A | Avoid generic “feature grid”; use couple copy |

**Taste decision (surface at gate):** Battleship **drag-placement vs tap-to-cycle** — recommend **tap cells to rotate ship** for simpler mobile implementation.

---

## Phase 3 — Eng review

### Scope challenge

- **Minimum:** Each game = `server/games/<id>/GameState.js` + client `games/<id>/` + register lines + 1–2 socket verbs (or reuse `game-action` with typed payloads).
- **Complexity:** Battleship highest (two phases); Connect Four lowest; Quiz middle (timer + content).

### Codex

**Unavailable** — no Codex invocation in this environment. Proceeding from codebase patterns.

### Architecture (dependency graph)

```
                    ┌─────────────┐
                    │  index.js   │ register + socket.on(...)
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
 ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
 │ GameFactory   │ │ RoomManager   │ │ Client main   │
 │ + getConfig   │ │ + handlers    │ │ + Registry    │
 └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
         │                 │                 │
    ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
    │ connect │       │ battle  │       │  quiz   │
    │  four   │       │  ship   │       │  race   │
    │ GameState      │ GameState│       │ GameState
    └─────────┘       └─────────┘       └─────────┘
```

### Test diagram → coverage

See `planning/test-plan-next-three-games-2026-04-05.md` (artifact on disk).

### Performance

- All three: **O(1)** or small grid per event; no N+1 DB (unless loading quiz from Supabase later — v1 use in-memory pack from room create).

### Eng completion summary

| Item | Status |
|------|--------|
| Architecture | Fits existing map; no new services |
| Highest risk | Battleship state size + secret leakage audits |
| Test plan | Written to `planning/test-plan-*.md` |

---

## The three games (product spec snapshot)

### 1) Connect Four — working title **“Stack for Us”**

- **Mechanics:** 7×6 grid, gravity, first to four in a line.
- **Sides:** Yellow vs Pink (or Red vs Blue) — pick in side select.
- **Transport:** Reuse `game-action` `{ type: 'drop', col }` or dedicated `connect-drop`.
- **Client:** Three.js discs like Othello discs or DOM for speed (autoplan: **Three.js** for consistency).

### 2) Mini Battleship — **“Sink Squad”** (5×5, 3 ships: len 3,2,2)

- **Phases:** (1) Place ships (2) Battle until all sunk.
- **Transport:** `game-action` with placement / shot types; server validates.
- **Session length:** Target <8 min.

### 3) Quiz Race — **“Blitz Trivia”**

- **Mechanics:** Host picks or pastes JSON pack (like Doodle prompts); N questions, multiple choice A/B/C; **first correct** wins the round point; most points after N wins.
- **Anti-cheat:** Server records arrival order of `quiz-answer` events; ignore after round closed.
- **v1:** Static JSON only (no OpenAI).

---

## Deferred to TODOS.md

- Drag-and-drop ship placement (if tap-first ships)
- User-generated quiz moderation
- Sound pack (see existing Web Audio TODO in TODOS)

---

## PREMISE GATE (human confirmation required)

Please confirm or correct these three premises:

1. **Audience:** Two players in a private room (couples-first), mobile web, same stack as today.  
2. **Priority order to build:** Connect Four → Quiz Race → Mini Battleship *(Battleship most complex)* — swap if you want fastest “new mechanic” first.  
3. **Content:** Quiz v1 is **host-supplied JSON only** (no LLM).

Reply with **Approve**, or **Override:** (e.g. “Battleship first”, “skip quiz”, “add X instead”).
