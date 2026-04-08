---
name: testing-strategy-coverage
description: Build and execute a layered test strategy with measurable coverage goals across game rules, networking contracts, and critical flows. Use when the user asks for a robust testing strategy, TDD expansion, or coverage improvement.
---

# Testing Strategy and Coverage

## Purpose

Design a practical, high-signal test system that catches regressions early.

## Test Layers

1. **Game rule unit tests**
- `server/games/*/GameState.test.js`
- Validate game invariants, edge cases, and end-of-match events.

2. **Server orchestration tests**
- Room/manager flow coverage (join, leave, reconnect, ownership).

3. **Client contract tests**
- Event payload handling and state mapping in network layer.

4. **Risk-focused integration tests**
- Reconnect race, timing-sensitive updates, malformed payload handling.

## Coverage Workflow

1. Baseline current coverage.
2. Identify high-risk untested files (critical mechanics first).
3. Add tests using fail -> pass -> refactor cadence.
4. Re-measure and document gains.

## Coverage Targets

- Critical game logic files: >= 90% lines.
- Network/event contract modules: high branch confidence for known event families.
- Keep thresholds realistic and file-specific.

## Suggested Commands

- `npm test`
- `npm run lint`
- `node --experimental-test-coverage --test`
- scoped example:
  - `node --experimental-test-coverage --test server/games/pig-vs-chick/GameState.test.js`

## Strategy Output

- Prioritized test backlog
- Added tests by layer
- Coverage before/after snapshot
- Explicit remaining gaps and risks
