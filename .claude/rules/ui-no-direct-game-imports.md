# Rule: UI Modules Must Not Directly Import Game Implementations

Scope: `client/src/shared/**`, `client/src/screens/**`

## Policy

- UI orchestration uses `GameRegistry` as the abstraction boundary.
- Avoid direct imports from `client/src/games/**` inside shared UI or screen modules.
- Route all game scene/HUD creation through `GameScreen` + registry entries.

## Why

- Keeps UI decoupled from per-game internals.
- Makes adding a new game an extension operation rather than UI rewrites.

## Exceptions

- `client/src/main.js` may import game modules for registration.
- `GameRegistry` and game index modules are expected to reference game implementations.
