# Pig vs Chick - Initial Requirements (Executable Spec)

This captures the core gameplay requirements that the server `GameState` must enforce.
Tests for these requirements live in `server/games/pig-vs-chick/GameState.test.js`.

## Core Requirements

1. Server-authoritative simulation
- Spawns are validated server-side (tier, lane, energy).
- Clients can only send spawn intents; game state is computed by server ticks.

2. Economy loop
- Both players start with `STARTING_ENERGY`.
- Energy regens over time and is capped at `MAX_ENERGY`.
- Spawn deducts the exact configured unit cost.

3. Lane march and base pressure
- Units march toward enemy base by direction and speed.
- Reaching enemy base applies tier-based base damage and removes the unit.
- Higher tiers must represent higher base threat than lower tiers.

4. Tug-of-war collision and push
- Opposing units in same lane lock into push when colliding.
- Units must not pass through each other due to tick overshoot.
- Heavier unit pushes lighter unit and inflicts attrition on weaker unit.
- Equal weights create stalemate attrition (both lose HP).

5. Combat lifecycle
- Dead units are marked and cleaned after short decay window.
- If a push target dies, remaining unit returns to march.

6. Match end semantics
- Match ends when one player base HP reaches zero.
- Winner id is emitted correctly in `match-end`.

7. Reconnect identity migration
- `migratePlayer` remaps owner/energy/HP state correctly.

## Coverage Goal

Target at least 90% line coverage for `server/games/pig-vs-chick/GameState.js`.
Use:

```bash
node --experimental-test-coverage --test server/games/pig-vs-chick/GameState.test.js
```
