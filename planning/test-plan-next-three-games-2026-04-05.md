# Test plan — next three SUPERBUCIN games (autoplan 2026-04-05)

Per-game matrix: each row is a flow or branch; columns are coverage type.

## Connect Four (`connect-four`)

| Codepath / flow | Unit | Integration (socket) | Manual |
|-----------------|------|----------------------|--------|
| Win detection (4 in row/col/diag) | GameState pure fn tests | — | Play to win |
| Illegal column (full / out of range) | ✓ | emit error to one player | Try full column |
| Drop on wrong turn | ✓ | action-error | Both tap fast |
| Draw (board full) | ✓ | match-end tie | Force fill |
| Rematch / rejoin | — | RoomManager rematch | Disconnect mid-game |

## Mini Battleship (`battleship-mini`)

| Codepath / flow | Unit | Integration | Manual |
|-----------------|------|-------------|--------|
| Placement validation (overlap, bounds) | ✓ | — | Drag illegal |
| Shot on already-hit cell | ✓ | state update idempotent | Repeat fire |
| Sink all ships → match-end | ✓ | both clients | Complete game |
| Cheating: shoot before placement done | ✓ | server rejects | Socket fuzz |
| Hidden board never leaks opponent ships | ✓ | snapshot per player | Inspect payloads |

## Quiz Race (`quiz-race`)

| Codepath / flow | Unit | Integration | Manual |
|-----------------|------|-------------|--------|
| First correct answer wins round | ✓ | scores broadcast | Two taps |
| Both wrong → no point / next question | ✓ | — | — |
| Timer expiry → skip or no-point | ✓ | — | Slow device |
| Malformed host question pack | ✓ | room create error | Bad JSON |
| Tie-breaker final round | optional v2 | — | — |

## Shared shell (all three)

| Codepath | Coverage |
|----------|----------|
| GameFactory.register + getConfig | Add factory test or smoke script |
| RoomManager game-type branch | Mirror existing game integration pattern |
| Client GameRegistry + HUD + NetworkManager events | Manual smoke per game |
| match-end → UserService.recordMatch | Regression: existing games still record |

**Gaps accepted for v1 (autoplan):** visual regression, load testing, full iOS device matrix — defer to TODOS.
