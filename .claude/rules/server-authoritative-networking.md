# Rule: Server-Authoritative Networking

Scope: `server/**`, `client/src/shared/NetworkManager.js`, `client/src/games/**`

## Policy

- Game state truth is computed on the server.
- Clients emit intents/actions (`game-action`, typed events), not final state.
- Client scenes treat incoming state as source of truth and render only.

## Guardrails

- Validate malformed/out-of-turn actions server-side before state mutation.
- Emit per-player state slices for hidden-information games.
- Never trust client-provided score/win outcomes.

## Testing Expectations

- Keep `RoomManager` event-contract tests green for recipient and payload privacy.
- Add/maintain `GameState` unit tests for rule correctness and authority checks.
