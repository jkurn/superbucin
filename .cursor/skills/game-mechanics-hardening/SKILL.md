---
name: game-mechanics-hardening
description: Diagnose and harden multiplayer game mechanics using executable requirements, self-play simulation, invariant checks, and high-coverage server tests. Use when a game feels wrong, spec drift is reported, or mechanics/balance bugs need root-cause fixes.
---

# Game Mechanics Hardening

## Purpose

Turn vague gameplay complaints into reproducible, fixed, and tested server logic.

## When to Use

- "This mechanic is not per spec"
- "Units pass through each other"
- "Damage feels wrong"
- "Please battle test this game"
- Any request for deep mechanics debugging + confidence hardening

## Workflow

1. **Extract requirements**
- Write concrete requirements from current spec and behavior.
- Store as a short executable spec in `planning/YYYY-MM-DD-<game>-requirements.md`.

2. **Reproduce with simulation**
- Run deterministic or randomized self-play (typically 10 matches minimum).
- Track invariants:
  - no pass-through/crossing
  - correct winner semantics
  - correct damage ordering
  - valid state transitions

3. **Find root cause in server logic**
- Inspect `server/games/<game>/GameState.js`.
- Prefer server-authoritative fixes over client-side masking.

4. **Patch with minimal behavior-safe diff**
- Fix logic, not symptoms.
- Keep config-driven values in `GAME_CONFIG`.

5. **Add high-value tests**
- Create/expand `server/games/<game>/GameState.test.js`.
- Cover:
  - core mechanics
  - edge conditions
  - malformed/invalid actions
  - end-state events
  - migration/reconnect state integrity

6. **Enforce coverage target**
- Run:
  - `node --experimental-test-coverage --test server/games/<game>/GameState.test.js`
- Target at least 90% line coverage for critical game logic files.

7. **Re-simulate to confirm**
- Re-run 10 self-play matches.
- Verify failures are eliminated with evidence.

## Output Checklist

- Requirements doc in `planning/`
- Logic patch in `GameState.js`
- Dedicated game test suite
- Coverage report meeting target
- Before/after simulation evidence
