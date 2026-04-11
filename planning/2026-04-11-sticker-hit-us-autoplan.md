# /autoplan — Sticker Hit US closure (restore-backed plan)

Captured: 2026-04-11 | Branch: main | Worktree: superbucin

## Premises (confirmed)

- TODOS.md Sticker Hit US01–US14 are marked shipped; remaining gaps are **parity / polish** (bounce vector math, marathon HUD affordance, DRY tests), not missing epics.
- Server remains authoritative for throw outcome; client VFX must consume the same geometric conventions as pre-ship debris code.

## What already existed

- `resolveThrowAgainstDisc`, `buildExpandedStageDefinitions`, `stickerHitStateViewKeys`, lobby `createHUD`, `StickerHitScene` crash FX.

## NOT in scope (deferred)

- Hold-to-charge variable `flightMs` (new input modality; no US demand in TODOS).
- Physics engine–grade continuous collision sweep (discrete samples are the product contract).

## Implementation (this pass)

1. **`reboundHeadingDegFromImpact`** in `shared/sticker-hit/throwResolve.js` — heading of rim tangent matching client’s historical `(-cos θ, sin θ)` debris basis; server `throwFx.reboundTangentDeg` now uses it (replaces incorrect `impactAngle + 90`).
2. **`StickerHitScene._spawnCrashBounceFx(throwFx)`** — builds `worldT` from `reboundTangentDeg` via `(cos, sin)` of that heading; falls back to helper when field absent.
3. **Stage pips** — `data-boss="true"` when `i % 5 === 4` (matches `marathonStages` boss cadence); CSS ring highlight.
4. **Tests** — `throwResolve.test` for heading; client acceptance covers marathon pips + merged `createHUD` test; removed duplicate `index.test.js`.
5. **GameState / acceptance assertions** — aligned with `reboundHeadingDegFromImpact`.

## Test diagram (codepath → coverage)

```
throwFx.crash ──► reboundHeadingDegFromImpact ──► throwResolve.test + GameState.test + server acceptance
throwFx.crash ──► _spawnCrashBounceFx(fx) ──► (manual / visual; contract via shared math)
stage pips loop ──► data-boss i%5===4 ──► client stickerHitAcceptance (10 pips)
createHUD onState ──► EventBus sticker-hit:state ──► stickerHitAcceptance (merged from index.test)
```

## Decision audit trail

| # | Phase | Decision | Principle | Rationale |
|---|-------|----------|-----------|-----------|
| 1 | Eng | Fix tangent math vs +90 hack | Explicit | `impact+90` did not match client basis; shared helper documents truth. |
| 2 | Eng | Boss pip marker = `i%5===4` | DRY | Same rule as `marathonStages.js`. |
| 3 | Eng | Merge index.test into acceptance | DRY | One file fewer; same assertions. |

## Failure modes

| Path | Realistic failure | Test | Handling | Silent? |
|------|-------------------|------|----------|---------|
| Old clients ignore `reboundTangentDeg` | N/A server always sends | heading unit test | Client uses field when present | No |
| Marathon rounds mismatch config | Pips wrong cadence | acceptance 10-pip boss indices | Single source would be ideal future | No if server totalStages matches |
