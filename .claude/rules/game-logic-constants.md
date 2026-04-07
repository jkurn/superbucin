# Rule: No Hardcoded Numbers in Game Logic

Scope: `server/games/**`, `client/src/games/**`

## Policy

- Avoid embedding gameplay constants directly in logic branches.
- Keep balance values and tunables in config modules (`config.js`, `GAME_CONFIG`).
- Reference config values in calculations and comparisons.

## Examples

- Prefer `if (energy >= GAME_CONFIG.UNITS[tier - 1].cost)` over `if (energy >= 30)`.
- Prefer `setTimeout(..., GAME_CONFIG.COUNTDOWN_MS)` over `setTimeout(..., 3000)`.

## Exceptions

- Loop indices, array lengths, and trivial coordinate math are allowed.
- Test data may use inline numeric literals for readability.
