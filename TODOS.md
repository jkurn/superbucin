# SUPERBUCIN — Checklist Before Building Game #2

## Blockers (do these first)

- [x] ~~Extract EventBus class (simple pub/sub, < 30 lines)~~ — Done: `client/src/shared/EventBus.js`
- [x] ~~Create GameRegistry on client (map of gameType → Scene class)~~ — Done: `client/src/shared/GameRegistry.js`
- [x] ~~Create GameFactory on server (map of gameType → GameState class)~~ — Done: `server/games/GameFactory.js`
- [x] ~~Add gameType field to rooms in RoomManager~~ — Done: `server/rooms/RoomManager.js`
- [x] ~~Make UIManager.startGame() dispatch via registry instead of direct import~~ — Done: `client/src/shared/UIManager.js`

## Quality improvements (alongside or after game #2)

- [x] ~~Unify duplicated configs (single source, copy at build or import from shared)~~ — Done: server sends GAME_CONFIG on game-start, client config.js accepts it via applyServerConfig()
- [x] ~~Add client-side position interpolation (`lerp`)~~ — Done: `PigVsChickScene` now lerps unit X/Z toward server targets each frame while preserving push-shake behavior.
- [x] ~~Extract CSS from index.html into styles/ directory~~ — Done: moved to `client/src/styles/` split (`index.css`, `core.css`, `games.css`) with import-order guardrails in `IndexHtmlRefactor.test.js`.
- [x] ~~Add 15-second reconnection grace period~~ — Done: RoomManager pauses game, auto-rejoin via room code
- [x] ~~Add `window.getGameState()` for debugging/testing~~ — Done: `client/src/main.js` exposes `window.getGameState()`, backed by `NetworkManager.getDebugSnapshot()`.

## Deferred from Othello build (2026-04-05)

- [x] ~~Rewrite combat to tug-of-war push~~ — Done: weight-based pushing in GameState.js, push shake visualization on client
- [x] ~~Add weight-based unit system (10kg/20kg/50kg/70kg)~~ — Done: server + client configs aligned, units have weight/hp/speed/cost
- [x] ~~Add 3D floating HP bars on units~~ — Done: subtle canvas sprite bars above each unit, auto-updates per tick

## Backlog — next games (/autoplan 2026-04-05)

See `planning/2026-04-05-next-three-games.md` for CEO/Design/Eng rationale and test matrix.

- [x] ~~**Connect Four** (“Stack for Us”)~~ — Done: server-authoritative implementation is registered and covered by `server/games/connect-four/GameState.test.js`.
- [x] ~~**Mini Battleship** (“Sink Squad”)~~ — Done: implementation is registered with privacy-focused routing/tests (`battleship-state` slicing + `GameState` suite).
- [x] ~~**Quiz Race** (“Blitz Trivia”)~~ — Done: implementation is registered with scoring/authority tests in `server/games/quiz-race/GameState.test.js`.

Suggested build order in plan: Connect Four → Quiz Race → Battleship (complexity). Override in plan gate if you prefer.

## Deferred from /design-review (2026-04-05)

- [x] ~~Semantic lobby/side controls~~ — Done: `.game-card` and `.side-option` are now semantic `<button>` controls with focus-visible styling and keyboard support via native button behavior.
- [x] ~~Revisit viewport meta (`user-scalable=no`) for a11y vs game input~~ — Done: removed zoom lock in `client/index.html` viewport meta and switched to `viewport-fit=cover`.
- [x] ~~Lobby scroll on small screens~~ — Fixed: `.lobby-ui` `overflow-y: auto`, safe-area padding, `touch-action: pan-y` (FINDING-001)

## Deferred from plan-eng-review (2026-04-05)

- [x] ~~Path-scoped `.claude/rules/`~~ — Done: added `.claude/rules/game-logic-constants.md`, `.claude/rules/ui-no-direct-game-imports.md`, `.claude/rules/server-authoritative-networking.md`.
- [x] ~~Spectacle event hooks~~ — Done: added `client/src/shared/SpectacleHooks.js` and pre-wired ENTRANCE/HIT/KILL/COMBO/NEAR_MISS/BASE_HIT triggers from `PigVsChickScene`.
- [x] ~~Web Audio synthesis~~ — Done: `client/src/shared/WebAudioManager.js` synthesizes spectacle SFX, victory jingle, and an ambient BGM loop via Web Audio oscillators (no audio files).
- [x] ~~Session state hook~~ — Done: `.claude/hooks/pre-compact.sh` writes status + recent commits snapshots to `SESSION.md` before compaction.

## Deferred from plan-eng-review (testing strategy, 2026-04-07)

- [x] ~~Socket event contract tests~~ — Done: `RoomManager.test.js` enforces event name/payload/recipient routing for privacy-sensitive game events (`memory-state`, `battleship-state`, `vending-state`, `bonk-state`, `cute-aggression-state`).
- [x] ~~NetworkManager client contract tests~~ — Done: `NetworkManager.test.js` covers server event mapping (`room-error`, reconnect/error notifications, `achievement-unlocked`, `match-end`) and routing behavior.
- [x] ~~Battleship mini rules/privacy unit suite~~ — Done: `server/games/battleship-mini/GameState.test.js` covers placement validation, turn ownership, hidden-state slices, and match-end behavior.
- [x] ~~Quiz race rules/authority unit suite~~ — Done: `server/games/quiz-race/GameState.test.js` covers answer validation, scoring (+ speed bonus), phase visibility (`correct` hidden until reveal), finish behavior, and reconnect identity migration.

### Criteria gate for every game (must pass before "robust")

- [x] ~~Rules correctness: win/lose/tie, illegal actions, turn ownership, scoring.~~ — Covered by `server/games/*/GameState.test.js` suites (including connect-four, othello, bonk-brawl, cute-aggression, battleship-mini, quiz-race).
- [x] ~~Authority/security: server rejects malformed/out-of-turn actions.~~ — Covered by GameState invalid-action tests and server-side action handling checks.
- [x] ~~Payload privacy: players only receive their allowed state slices (no opponent hidden data leakage).~~ — Covered by `RoomManager.test.js` contract routing for `memory-state`, `battleship-state`, `vending-state`, `bonk-state`, `cute-aggression-state`.
- [x] ~~Network resilience: disconnect/reconnect, timeout windows, rejoin consistency.~~ — Covered by reconnect race tests in `RoomManager.test.js` and client reconnect handling in `NetworkManager.test.js`.
- [x] ~~Notification integrity: correct recipient + no duplicate/conflicting notifications.~~ — Covered by `RoomManager` recipient contract tests + `NetworkManager` event mapping tests.
- [x] ~~Persistence side effects: `match-end` path records points/achievements correctly and degrades safely on DB failure.~~ — Covered by `UserService.test.js` and `RoomManager.test.js` match-end fallback behavior.

## Engineering scorecard (run weekly)

Reference doc: `planning/2026-04-07-testing-health.md`

- [x] ~~Run weekly engineering scorecard (10 categories: maintainability, DRY/reuse, SOLID boundaries, tests, reliability, delivery hygiene, change size, observability, docs freshness, focus/flow).~~ — Done for week `2026-04-07` in `planning/2026-04-07-testing-health.md`.
- [x] ~~Track and log baseline metrics weekly: commit size distribution, hotspot churn, test ratio, coverage trend, change failure rate, deploy health.~~ — Done baseline snapshot for week `2026-04-07` in `planning/2026-04-07-testing-health.md`.
- [x] ~~Set weekly improvement bet (one structural bet + one quality bet) and review outcome in next retro.~~ — Done: added structural + quality bets for next review cycle in `planning/2026-04-07-testing-health.md`.

## Deferred from /design-review (2026-04-08)

- [x] ~~Enforce `min-height: 44px` on mobile tappable controls (Sign In, Join Room, other CTAs) to meet touch target standards.~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`798eade`).
- [x] ~~Reduce mobile header crowding by adjusting top bar height/sticker placement and increasing hero top padding.~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`34b6592`).
- [ ] Normalize CTA glow/elevation tokens between lobby and auth screens for cross-page consistency.
- [x] ~~Relax lobby card label density on small screens (title/badge spacing and badge prominence).~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`5b4a12b`).
