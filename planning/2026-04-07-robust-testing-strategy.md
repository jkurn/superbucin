# SUPERBUCIN robust testing strategy (games + notifications + networking)

Goal: prevent gameplay regressions, hidden-state leaks, and reconnect/notification failures with a minimal-diff, criteria-driven test system.

## Scope

- In scope: server game-rule tests, RoomManager event-contract tests, reconnect race tests, targeted client NetworkManager contract tests, focused manual smoke.
- Not in scope (for now): full browser E2E matrix, visual regression for 3D scenes, large-load CI infrastructure.

## Criteria gate (all games)

Each game is "robust" only when all criteria pass:

1. Rules correctness
2. Authority/security
3. Payload privacy
4. Network resilience
5. Notification integrity
6. Persistence side effects

## Test architecture

```text
[GameState unit tests]
  - deterministic rules, edge cases, invariants
            |
            v
[RoomManager event-contract tests]
  - event payload shape
  - recipient routing
  - per-player privacy
            |
            +----> [Reconnect race tests]
            |        - timeout edge
            |        - id remap correctness
            |        - no duplicate cleanup
            |
            v
[NetworkManager contract tests]
  - socket event -> UI/EventBus mapping
            |
            v
[Manual smoke]
  - one happy path + one adversarial path per game
```

## Coverage matrix by area

### Games (server-authoritative)

- Unit tests in `server/games/*/GameState.test.js`:
  - win/lose/tie
  - invalid action rejection
  - turn sequencing
  - scoring and end conditions
  - one invariant per game (state cannot violate core rules)

### Notifications

- Contract tests in `server/rooms/RoomManager.test.js` and client contract tests:
  - room lifecycle: `room-created`, `room-joined`, `player-joined`, `room-error`
  - gameplay: `action-error`, `match-end`, `achievement-unlocked`
  - connectivity: `opponent-disconnected`, `opponent-reconnected`
  - assertions:
    - correct recipient(s)
    - no unintended recipient
    - stable payload fields

### Networking / reconnect

- Reconnect race tests:
  - disconnect during active game schedules timeout
  - rejoin before timeout cancels teardown and remaps identity/state
  - timeout expiry destroys room and clears mappings
  - repeated reconnect attempts do not corrupt room membership

### Privacy-sensitive states

- Per-player slice enforcement:
  - `memory-state`
  - `battleship-state`
  - `vending-state`
  - `bonk-state`
  - `cute-aggression-state`

For each event:
- Player A never receives Player B hidden slice.
- Player B never receives Player A hidden slice.

## Execution order (minimal diff)

1. Expand `RoomManager.test.js` contract coverage (high leverage, low tooling cost).
2. Add reconnect race and timeout tests (critical risk area).
3. Add lightweight `NetworkManager` contract tests with mocked socket/UI.
4. Extend per-game invariants as each game gets modified.

## Definition of done for each new game or major change

- [ ] All 6 criteria gates are green.
- [ ] Contract tests updated for any new/changed socket event.
- [ ] Reconnect behavior verified (automated or explicitly N/A with reason).
- [ ] Manual adversarial smoke run on mobile viewport.
- [ ] `npm test` and `npm run lint` pass.
