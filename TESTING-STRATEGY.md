# Testing Strategy

## Current State (baseline numbers)

- Test files discovered: `17` (`14` server, `3` client).
- Test command: `npm test` (`node --test ...` explicit file list).
- Baseline run:
  - tests: `302`
  - suites: `64`
  - pass: `302`
  - fail: `0`
  - skipped: `0`
  - duration: `~63.7s`
- Coverage run (`npm run test:coverage`):
  - line: `93.77%`
  - branch: `80.82%`
  - funcs: `88.25%`
- Lowest meaningful coverage areas:
  - `client/src/shared/analytics.js` (`41.30%` line)
  - `server/config/env.js` (`48.00%` line)
  - `server/games/GameFactory.js` (`63.77%` line)
  - `server/games/word-scramble-race/dictionary.js` (`76.60%` line)

## Test Quality Audit (assertion quality, mock fidelity, isolation, smells)

### Assertion quality

- Strong in game logic tests:
  - Validates state transitions, illegal actions, winner logic, reconnect migration.
  - Uses specific assertions (`equal/deepEqual`) over weak truthiness checks.
- Weak spots:
  - Several tests use broad `assert.ok(true)` style smoke assertions for "does not crash" behavior.
  - Some edge-case tests check event existence but not full payload contracts.

### Happy path vs edge case ratio

- Strong edge-case coverage in server game states:
  - Turn ownership, invalid moves, malformed inputs, paused states, timeouts.
- Gaps:
  - Client UX flow tests are thin (no DOM interaction tests for screens).
  - Router/navigation behavior has no dedicated unit tests.
  - Analytics behavior has almost no direct tests.

### Mock fidelity

- Good:
  - `NetworkManager.test.js` fake socket captures event API contract accurately.
  - `RoomManager.{lifecycle,contracts,reconnect,persistence}.test.js` exercise routing/privacy/reconnect via mock sockets (`server/test-helpers/roomManagerTestKit.js`).
- Risks:
  - `UserService` fake Supabase chain can drift from real query behavior (especially `.or()/.order()/.limit()` paths).
  - No contract tests pinning expected external dictionary API behavior/schema.

### Isolation and flakiness

- Tests are deterministic by design in most suites (manual timer control, event capture).
- Randomized/fuzz-like loops exist in several game tests (good signal).
- Known residual risk:
  - Global timer overrides and global fetch overrides are used frequently; while restored, this is a common future flake source.

### Test smells

- **Resolved split**: RoomManager tests are split by concern (`RoomManager.*.test.js`); payload helpers live in `server/test-helpers/payloadShape.js`.
- **The Mockery**: `UserService.test.js` mock chain complexity is high.
- **The Happy Path Addict**: not present in core game tests; present in some client smoke checks.
- **The Sleeper**: generally avoided (good use of timer stubs), but many manual timeout manipulations are fragile.
- **The Inspector**: limited, but a few tests assert internals directly (`game.phase` and private-ish state) instead of emitted contract only.

## Risk-Scored File Assessment (every source file, scored)

Scoring dimensions: Data integrity, Security, Core loop, Complexity, Blast radius.  
Risk tier uses `max()` dimension.

### CRITICAL (5)

- `server/rooms/RoomManager.js` — game session authority, event privacy, reconnect lifecycle.
- `server/services/UserService.js` — points/stats/achievements persistence.
- `server/index.js` — socket/event ingress and app runtime boundary.
- `client/src/shared/NetworkManager.js` — client-server contract and state/event bridge.
- `client/src/shared/UIManager.js` — route-to-screen orchestration for gameplay flow.

### HIGH (4)

- `server/games/*/GameState.js` (all game modes) — core game rules and win conditions.
- `server/games/GameFactory.js` — game instantiation/config exposure contract.
- `server/config/env.js` — environment parsing and startup safety.
- `client/src/shared/Router.js` — deep-link and route resolution behavior.
- `client/src/shared/UserManager.js` — auth/profile identity flow.
- `client/src/main.js` — boot sequence and global wiring.

### MEDIUM (3)

- `server/games/*/config.js`, `questions.js`, `packs.js`, `prompts.js`, `gridUtils.js`, `dictionary.js`.
- `client/src/games/*/index.js` and scene files.
- `client/src/screens/*.js`.
- `client/src/shared/analytics.js`, `EventBus.js`, `WebAudioManager.js`, `GameRegistry.js`, `SceneManager.js`.

### LOW (1-2)

- Mostly constants-only modules and display-only helpers:
  - `client/src/shared/ui/constants.js`
  - `client/src/shared/ui/timeAgo.js`
  - `client/src/shared/ui/toasts.js`
  - `client/src/shared/GameTypes.js`

## Test Layers (the pyramid/trophy for this project)

Current shape:

- **Unit / rule-engine heavy (strong):**
  - Server game states and service logic.
- **Integration / contracts (moderate):**
  - `RoomManager` + socket payload routing.
  - `NetworkManager` event mapping.
- **Component/UI tests (weak):**
  - Very limited DOM/screen behavior tests.
- **E2E (missing in repo tests):**
  - No automated browser journey tests in suite.

Target shape for this project:

1. Keep strong server-unit base.
2. Expand integration contracts around router + auth + analytics boundaries.
3. Add focused client UI integration tests for core user journeys.
4. Add minimal smoke E2E for create/join/play/rematch + reconnect.

## Specific Tests to Write (function-level, with happy/error/edge/boundary)

### 1) `client/src/shared/analytics.js` (CRITICAL integration boundary)

Incident prevented: lost product telemetry after env/config drift.

- `initAnalytics()`
  - happy: initializes once with expected options.
  - error: missing key returns false and does not call SDK.
  - edge: called repeatedly remains idempotent.
- `captureEvent()`
  - happy: forwards event when initialized.
  - error: no-op when not initialized.
- `capturePageView()`
  - happy: includes `path` and `url`.
  - boundary: no browser context returns safely.
- `syncUserIdentity()`
  - happy: identifies authenticated and guest forms.
  - edge: unchanged identity avoids duplicate identify calls.

### 2) `server/config/env.js` (startup safety)

Incident prevented: production boot with invalid/missing critical env vars.

- happy: parses valid env.
- error: missing required variables fails fast with clear message.
- edge: optional vars default correctly.

### 3) `server/games/GameFactory.js` (config contract drift)

Incident prevented: client receives incorrect game config shape and crashes.

- `create()`
  - happy: registered game returns instance.
  - error: unknown game returns null.
- `getConfig()`
  - happy: each game type returns expected keys/shape.
  - edge: unknown game returns null.
  - regression: memory/vending/speed/quiz/custom branches stay intact.

### 4) `client/src/shared/Router.js` (deep-link reliability)

Incident prevented: challenge links landing users on wrong screen.

- `matchRoute()` via public init/navigate behavior
  - happy: `/`, `/auth`, `/profile`, `/u/:username`, `/room/:code`.
  - error: invalid paths fallback to lobby.
  - edge: room code normalization, trailing slash handling.

### 5) `client/src/screens/LobbyScreen.js` + `SideSelectScreen.js` (mobile contract)

Incident prevented: mobile users unable to create/join/select side under touch-only interactions.

- tap flows:
  - create room CTA.
  - join room path with code.
  - side select with one-tap feedback.
- boundary:
  - small viewport keyboard overlap.
  - empty/invalid room code handling.

### 6) `server/games/word-scramble-race/dictionary.js` (external dependency degradation)

Incident prevented: dictionary API outage hard-blocking valid gameplay.

- happy: dictionary hit accepted.
- error: 404 reject.
- degradation: timeout/network failure fallback behavior verified explicitly.
- boundary: malformed response object.

## Test Infrastructure Requirements (mocks, factories, helpers, CI)

| Requirement | Status | Action |
|---|---|---|
| Test runner config | Partial | Keep `node --test`; add dedicated scripts for client-integration tests. |
| Coverage in CI | Partial | Add CI step for `npm run test:coverage` + gate report artifact upload. |
| Random-order/isolation check | Missing | Add scheduled repeated-run job (`3x`) and fail on inconsistency. |
| Factories | Partial | Extract reusable socket/player/game factories from large test files. |
| Shared assertion helpers | Partial | Add helpers for event payload contract assertions. |
| External API mocks | Partial | Add dedicated mock utilities for dictionary + Supabase chain. |
| Browser-flow tests | Missing | Add Playwright smoke for create/join/play/rematch/reconnect. |

## Non-Deterministic Code Strategy (AI/LLM testing approach)

No LLM endpoints are in this codebase.  
Equivalent non-deterministic surfaces here:

- randomness (`Math.random`) in game generation (`word-scramble-race`, `cute-aggression`),
- timing (`setTimeout`/`setInterval`) in gameplay phases,
- external API dependency (dictionary checks).

Strategy:

- Seed/override randomness in deterministic unit tests where exact outcomes matter.
- Keep property-style repetition tests for generation invariants.
- Use fake timers everywhere for phase transitions.
- Add fallback/degradation tests for external dependency failure modes.

## Coverage Targets (per-file, not blanket)

| File | Current line % | Target | Why |
|---|---:|---:|---|
| `client/src/shared/analytics.js` | 41.30 | 85 | critical observability boundary |
| `server/config/env.js` | 48.00 | 90 | startup safety |
| `server/games/GameFactory.js` | 63.77 | 90 | client config contract |
| `server/games/word-scramble-race/dictionary.js` | 76.60 | 92 | external dependency risk |
| `client/src/shared/Router.js` | n/a (not listed) | 85 | deep-link correctness |
| `client/src/main.js` | n/a (not listed) | 75 | boot flow and fail-safe telemetry |
| `server/rooms/RoomManager.js` | 99.18 | maintain >95 | already excellent; protect regressions |

## Prioritised Backlog (batched, with acceptance criteria)

### Batch A (1-2 days, highest ROI)

1. Add `analytics.js` unit tests.
2. Add `env.js` tests.
3. Add `GameFactory.getConfig` contract tests.

Acceptance:
- all new tests pass,
- coverage on 3 files reaches target floor (`>=80` on first pass),
- no changes to runtime behavior.

### Batch B (2-3 days)

1. Add `Router` route resolution tests.
2. Add client lobby/side-select integration tests (DOM-level).

Acceptance:
- route permutations pass,
- mobile-oriented interaction paths pass.

### Batch C (2-3 days)

1. Add dependency degradation tests for dictionary integration.
2. Add repeated-run stability CI job (`3x` test loop).

Acceptance:
- explicit timeout/network/5xx behavior validated,
- CI fails on instability.

### Batch D (optional hardening)

1. Introduce light property-based tests for grid/sequence generators.
2. Add minimal Playwright smoke for end-to-end loop.

Acceptance:
- no flake over 20 CI runs,
- play loop smoke under 60s.

## Known Gaps and Accepted Risks (what we are consciously NOT testing and WHY)

- Not testing full visual styling details via unit tests (cost > value right now).
- Not testing third-party SDK internals (`posthog-js`, `socket.io`) directly.
- No exhaustive E2E suite yet; accepted short-term because server rule-engine coverage is strong.
- Supabase contract tests are mocked and could diverge from real backend behavior; accepted until dedicated integration environment exists.

## Regression Test Log (bugs found -> tests written)

- Word Scramble playable-state constraints: generation tests ensure at least one valid word path across 4x4 and 6x6.
- RoomManager reconnect race behavior: tests cover timeout destroy vs. successful remap.
- Event privacy routing: tests ensure per-player slices for hidden-state games.

