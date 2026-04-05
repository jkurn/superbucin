# SUPERBUCIN — Checklist Before Building Game #2

## Blockers (do these first)

- [x] ~~Extract EventBus class (simple pub/sub, < 30 lines)~~ — Done: `client/src/shared/EventBus.js`
- [x] ~~Create GameRegistry on client (map of gameType → Scene class)~~ — Done: `client/src/shared/GameRegistry.js`
- [x] ~~Create GameFactory on server (map of gameType → GameState class)~~ — Done: `server/games/GameFactory.js`
- [x] ~~Add gameType field to rooms in RoomManager~~ — Done: `server/rooms/RoomManager.js`
- [x] ~~Make UIManager.startGame() dispatch via registry instead of direct import~~ — Done: `client/src/shared/UIManager.js`

## Quality improvements (alongside or after game #2)

- [x] ~~Unify duplicated configs (single source, copy at build or import from shared)~~ — Done: server sends GAME_CONFIG on game-start, client config.js accepts it via applyServerConfig()
- [ ] Add client-side position interpolation (`lerp`) — units snap every 50ms, lerp would smooth visually
- [ ] Extract CSS from index.html into styles/ directory — 400+ lines inline, will grow per game
- [x] ~~Add 15-second reconnection grace period~~ — Done: RoomManager pauses game, auto-rejoin via room code
- [ ] Add `window.getGameState()` for debugging/testing — expose game state as JSON for AI/Playwright QA

## Sheep Fight clone — next steps

- [ ] Rewrite combat to tug-of-war push — Replace stop-and-attack (HP/atk) with weight-based pushing. Stronger unit pushes weaker backward. Multiple weak can overwhelm one strong. ~110 lines in GameState.js `updateUnits()` + client fight visualization changes. Core gameplay change, test carefully.
- [ ] Add weight-based unit system (10kg/20kg/50kg/70kg) — Replace tier numbers with weight labels. Requires rebalancing all unit stats. Bundle with combat rewrite.
- [ ] Add 3D floating power/weight labels on units — TextSprite or CSS2DRenderer label above each unit showing its weight/power. Polish layer.

## Deferred from plan-eng-review (2026-04-05)

- [ ] Path-scoped `.claude/rules/` — enforce "no hardcoded numbers in game logic", "no direct game imports in UI", "server-authoritative networking". Prevention, not blocker.
- [ ] Spectacle event hooks — pre-wire visual effect triggers (ENTRANCE, HIT, KILL, COMBO, NEAR_MISS, BASE_HIT). Separates "when to fire" from "what to fire". Polish layer, add after core game loop works.
- [ ] Web Audio synthesis — spawn blips, fight sounds, base hit impact, victory jingle, BGM loop. All synthesized via Web Audio API oscillators (no audio files). Feature, independent of architecture.
- [ ] Session state hook — `.claude/hooks/pre-compact.sh` saves game design decisions to SESSION.md before context compression. DX improvement for long dev sessions.
