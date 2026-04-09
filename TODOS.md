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

- [x] ~~Socket event contract tests~~ — Done: `RoomManager.contracts.test.js` (and related `RoomManager.*.test.js`) enforces event name/payload/recipient routing for privacy-sensitive game events (`memory-state`, `battleship-state`, `vending-state`, `bonk-state`, `cute-aggression-state`).
- [x] ~~NetworkManager client contract tests~~ — Done: `NetworkManager.test.js` covers server event mapping (`room-error`, reconnect/error notifications, `achievement-unlocked`, `match-end`) and routing behavior.
- [x] ~~Battleship mini rules/privacy unit suite~~ — Done: `server/games/battleship-mini/GameState.test.js` covers placement validation, turn ownership, hidden-state slices, and match-end behavior.
- [x] ~~Quiz race rules/authority unit suite~~ — Done: `server/games/quiz-race/GameState.test.js` covers answer validation, scoring (+ speed bonus), phase visibility (`correct` hidden until reveal), finish behavior, and reconnect identity migration.

### Criteria gate for every game (must pass before "robust")

- [x] ~~Rules correctness: win/lose/tie, illegal actions, turn ownership, scoring.~~ — Covered by `server/games/*/GameState.test.js` suites (including connect-four, othello, bonk-brawl, cute-aggression, battleship-mini, quiz-race).
- [x] ~~Authority/security: server rejects malformed/out-of-turn actions.~~ — Covered by GameState invalid-action tests and server-side action handling checks.
- [x] ~~Payload privacy: players only receive their allowed state slices (no opponent hidden data leakage).~~ — Covered by `RoomManager.contracts.test.js` contract routing for `memory-state`, `battleship-state`, `vending-state`, `bonk-state`, `cute-aggression-state`.
- [x] ~~Network resilience: disconnect/reconnect, timeout windows, rejoin consistency.~~ — Covered by reconnect tests in `RoomManager.reconnect.test.js` and client reconnect handling in `NetworkManager.test.js`.
- [x] ~~Notification integrity: correct recipient + no duplicate/conflicting notifications.~~ — Covered by `RoomManager` recipient contract tests + `NetworkManager` event mapping tests.
- [x] ~~Persistence side effects: `match-end` path records points/achievements correctly and degrades safely on DB failure.~~ — Covered by `UserService.test.js`, `RoomManager.contracts.test.js` (`match-end` DB-down fallback), and `RoomManager.persistence.test.js` (`_recordMatchResult`).
- [ ] **Mobile-input contract tests (required for all new games):** verify core touch interactions on real mobile behavior (tap/drag/swipe as applicable), not only desktop click paths.
- [ ] **Dependency degradation tests (required for all new games):** if game logic depends on external APIs/services, enforce explicit fallback behavior under timeout/network/5xx and test it.
- [ ] **Playable-state invariant tests (required for all new games):** random generation must satisfy minimum playability constraints (e.g., guaranteed legal moves/words/targets) across supported board sizes/configs.

## Engineering scorecard (run weekly)

**Canonical:** `PROJECT-HEALTH.md` (weekly EngEx scorecard). **Snapshots:** `planning/2026-04-09-eng-health.md` (latest), `planning/2026-04-07-testing-health.md` (historical).

- [x] ~~Run weekly engineering scorecard (10 categories: maintainability, DRY/reuse, SOLID boundaries, tests, reliability, delivery hygiene, change size, observability, docs freshness, focus/flow).~~ — Done for week `2026-04-07` in `planning/2026-04-07-testing-health.md`; full EngEx taxonomy now in `PROJECT-HEALTH.md` (updated 2026-04-09).
- [x] ~~Track and log baseline metrics weekly: commit size distribution, hotspot churn, test ratio, coverage trend, change failure rate, deploy health.~~ — Snapshot `planning/2026-04-09-eng-health.md` + tables in `PROJECT-HEALTH.md` Section 1 (2026-04-09).
- [x] ~~Set weekly improvement bet (one structural bet + one quality bet) and review outcome in next retro.~~ — Next bets listed in `PROJECT-HEALTH.md` Section 5 (2026-04-09); review at next retro.

## Deferred from /design-review (2026-04-08)

- [x] ~~Enforce `min-height: 44px` on mobile tappable controls (Sign In, Join Room, other CTAs) to meet touch target standards.~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`798eade`).
- [x] ~~Reduce mobile header crowding by adjusting top bar height/sticker placement and increasing hero top padding.~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`34b6592`).
- [x] ~~Normalize CTA glow/elevation tokens between lobby and auth screens for cross-page consistency.~~ — Done: shared `--elev-cta-*`, `--focus-ring-*`, and `--glow-pink-selected` in `client/src/styles/core.css` (lobby CTAs, auth CTAs via `.btn-*`, aligned game-card/side-select selection glow).
- [x] ~~Relax lobby card label density on small screens (title/badge spacing and badge prominence).~~ — Fixed by `/design-review` on `main`, 2026-04-08 (`5b4a12b`).

## Testing strategy backlog (/testing-strategy-coverage, 2026-04-08)

- [x] ~~**T-01 (0.5d): Add `analytics.js` unit tests** — cover `initAnalytics`, `captureEvent`, `capturePageView`, `syncUserIdentity`, `resetAnalyticsIdentity` with browser/no-browser + missing-key paths.~~ — Done in `client/src/shared/analytics.test.js` (`analytics.js` line coverage now `100%`).
- [x] ~~**T-02 (0.25d): Add `env.js` startup safety tests** — validate required var failures + defaults.~~ — Done in `server/config/env.test.js` (production missing-required, non-prod bypass, JWT warning path).
- [x] ~~**T-03 (0.5d): Add `GameFactory.getConfig` contract tests** — lock shape per registered game type.~~ — Done in `server/games/GameFactory.test.js` (`GameFactory.js` line coverage now `100%`).
- [x] ~~**T-04 (0.5d): Add `Router.js` route/deep-link tests** — `/`, `/auth`, `/u/:username`, `/room/:code`, fallback, uppercase normalization.~~ — Done: `client/src/shared/Router.test.js` (`matchRoute` + History API + `init` branches including in-game `popstate`).
- [x] ~~**T-05 (1.0d): Add lobby + side-select client integration tests** — touch/mobile-focused create/join/select flows.~~ — Done: `client/src/screens/LobbyScreen.test.js`, `client/src/screens/SideSelectScreen.test.js` (jsdom; create/join validation, memory options payload, side pick + `updateSideSelect`).
- [x] ~~**T-06 (0.5d): Add dictionary degradation tests** — timeout/network/5xx fallback behavior in word-scramble path.~~ — Done: `server/games/word-scramble-race/dictionary.test.js` (`__clearDictionaryCacheForTests` + mocked `fetch`: 2xx/404/5xx/429/throw paths + cache).
- [x] ~~**T-07 (0.25d): Add repeat-run stability CI check** — run `npm test` 3x and fail on any inconsistent exit status.~~ — Done: `scripts/test-repeat.mjs`, `npm run test:repeat`; CI `Tests` step runs 3× via that script.

- [x] ~~**Q-01 (0.5d): Split `RoomManager.test.js` by concern** — room lifecycle, reconnect races, event privacy contracts, persistence side-effects.~~ — Done: `RoomManager.{lifecycle,contracts,reconnect,persistence}.test.js`.
  - Regression: `assertAllowedKeysOnly` / `assertRequiredKeys` on `memory-state`, `battleship-state`, `vending-state`, `bonk-state`, `cute-aggression-state` slices in `RoomManager.contracts.test.js`.
- [x] ~~**Q-02 (0.5d): Extract shared test factories** (`mockSocket`, `createGame`, event helpers) to reduce copy-paste.~~ — Done: `server/test-helpers/roomManagerTestKit.js` (`MockGameState`, `GameFactory` registrations, `mockSocket`, `mockIo`).
- [x] ~~**Q-03 (0.25d): Add payload schema assertion helpers** for game-state events.~~ — Done: `server/test-helpers/payloadShape.js` + `payloadShape.test.js` (`assertRequiredKeys`, `assertAllowedKeysOnly`).
