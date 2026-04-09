# Project Health — Weekly Engineering Scorecard

**Week of:** 2026-04-09  
**Canonical doc:** this file (`PROJECT-HEALTH.md`). **Dated snapshot:** `planning/2026-04-09-eng-health.md`.

Facts below were collected by running `npm run lint`, `npm test`, `npm run test:coverage`, and `npm audit --audit-level=high` on 2026-04-09.

---

## Section 1: Verification — Three-Tier Feedback

### Tier 1: Linting and formatting

| Check | Tool | Status | Notes |
|-------|------|--------|--------|
| Linting | ESLint 9 (flat config) | **Pass** (0 errors) | `client/src/`, `server/` |
| Type checking | TypeScript / `tsc` | **N/A** | Repo is JavaScript (ESM) |
| Formatting | Prettier / black | **Not configured** | ESLint-only; optional future bet |

**Pre-commit (Tier 1):** Yes — husky + lint-staged runs `eslint --fix` on staged `{client/src,server}/**/*.js`.  
**Lint in CI:** Yes — `.github/workflows/ci.yml` runs `npm run lint`.

### Tier 2: Static analysis

| Check | Tool | Status | Notes |
|-------|------|--------|--------|
| Complexity / SAST | Dedicated Sonar/Semgrep | **Not configured** | ESLint `eqeqeq`, `no-unused-vars` only |
| Dependency CVEs | `npm audit --audit-level=high` | **0 vulnerabilities** | Run 2026-04-09 |
| Dead code | knip / ts-prune | **Not configured** | — |

### Tier 3: Dynamic testing

#### Test snapshot

| Metric | Value | Change vs 2026-04-07 snapshot (`planning/2026-04-07-testing-health.md`) |
|--------|-------|------------------------------------------------------------------------|
| Total suites | 80 | ↑ (split RoomManager + depth suite) |
| Total tests | 366 pass, 0 fail | ↑ from 351 (EventBus, GameRegistry, StickerPack, UserBar, lobby/side branches) |
| Duration (local) | ~63.7 s single `npm test` | CI runs `test:repeat` → 3× |
| Test files (`*.test.js`, excl. `node_modules`) | 32 | ↑ |
| Application JS files (excl. tests, excl. `node_modules`) | 98 | — |

#### Coverage (Node `--experimental-test-coverage`, `npm run test:coverage`)

| | Line | Branch | Functions |
|--|------|--------|-----------|
| **all files** | **95.64%** | **82.48%** | **90.77%** |
| Prior snapshot (2026-04-09 AM) | 95.06% | 81.66% | 89.11% |

**Gate:** `scripts/coverage-gate.mjs` enforces line ≥94%, branch ≥80%, funcs ≥88.5% — **passing**.

#### Pyramid and risk (qualitative)

| Layer | Assessment |
|-------|------------|
| Unit — game rules | Strong: `server/games/*/GameState.test.js` per game |
| Unit — room/socket contracts | Strong: `RoomManager.*.test.js`, `NetworkManager.test.js`, `payloadShape.test.js` |
| Unit — boot/config | Improved: `env.test.js`, `GameFactory.test.js`, `dictionary.test.js` |
| Client integration | Growing: `LobbyScreen` (deep-link branches), `SideSelectScreen` (opponent row), `Router`, `analytics`, `UserBar`, `EventBus`, `GameRegistry`, `StickerPack.recordMatchResult` (jsdom / mocks) |
| E2E / browser | **Not in repo** — manual mobile check per `CLAUDE.md` deploy checklist |

**Risk heatmap (selected):**

| Area | Risk | Why |
|------|------|-----|
| `RoomManager.js` | Medium | Large module; mitigated by split test suites + payload helpers |
| `UIManager.js` / scenes | Medium–High | Many branches; fewer automated UI/E2E tests |
| External dictionary API | Low | Fail-open policy + `dictionary.test.js` + GameState integration |

#### Advanced paradigms

| Paradigm | Status |
|----------|--------|
| Mutation testing | Not configured |
| Property-based | Not configured |
| Contract testing | Partial — socket event slicing + `assertRequiredKeys` / `assertAllowedKeysOnly` |
| Load / perf | Not configured |

---

## Section 2: Design — Principles

### Micro (DRY / KISS / YAGNI)

| Principle | Grade | Notes |
|-----------|-------|--------|
| DRY | B | Payload shaping still duplicated across games/screens; helpers started in `payloadShape.js` |
| KISS | A- | RoomManager tests split; lean client refactors landed |
| YAGNI | A- | No obvious speculative layers added this week |

### Macro (SOLID) — short pulse

| Principle | Grade | Notes |
|-----------|-------|--------|
| SRP | B | `RoomManager.js` still multi-concern; tests now map to concerns |
| Open/Closed | B- | `GameFactory.getConfig` branch growth per game |
| Other SOLID | B | No regressions flagged this week |

### Resilience

| Principle | Grade | Notes |
|-----------|-------|--------|
| Fail fast | B+ | `env.js` validated + `env.test.js`; prod paths enforced |
| Idempotency | B | Reconnect/rematch covered in `RoomManager.reconnect.test.js` |
| Timeouts | B+ | Dictionary `AbortSignal.timeout(10s)`; no global policy doc |
| Law of Demeter | B | `byPlayer` slicing in `RoomManager` remains dense |

### Legacy principle scorecard (file-level)

| Principle | Grade | Issue | File | Test That Would Catch It |
|-----------|-------|--------|------|--------------------------|
| SRP | B | `RoomManager` still orchestrates lifecycle + routing + persistence | `server/rooms/RoomManager.js` | Contract tests per concern (in place) + future extract |
| DRY | B | Repeated state payload shaping across games and screens | `server/games/*/GameState.js`, `client/src/screens/*` | Expand `payloadShape` usage + game-specific fixtures |
| Open/Closed | B- | `GameFactory.getConfig` branch chain grows with each game | `server/games/GameFactory.js` | `GameFactory.test.js` (done) |
| Fail Fast | B+ | Env paths now tested | `server/config/env.js` | `env.test.js` |
| YAGNI | A- | Lean client/server patterns | `client/src/shared/*` | Contract tests |
| KISS | A- | Split RoomManager tests + kit | `server/rooms/RoomManager.*.test.js` | Regression suite |
| Law of Demeter | B | Deep payload paths | `RoomManager`, `UIManager` | Payload assertions at boundaries |
| Tell Don't Ask | B | Some global state branching | `client/src/shared/UIManager.js` | Screen transition behavior tests |
| Idempotency | B | Timer ordering sensitivity | `RoomManager` | `test:repeat` + reconnect tests |
| Timeouts | B+ | Per-call timeouts; no central matrix | multiple | Timer + dictionary tests |

---

## Section 3: Delivery

| Metric | Value | Notes |
|--------|-------|--------|
| Deployment frequency | On push to `main` | Render auto-deploy (`CLAUDE.md`) |
| Lead time | Minutes to ~hours | GitHub → CI → Render |
| Change failure rate | Unknown | No formal tracker; health URL in `CLAUDE.md` |
| Recovery | Roll back via Render / revert | — |
| CI pipeline | Lint → `npm run test:repeat` (3×) → `test:coverage:gate` → Vite build → `npm audit --audit-level=high` | `.github/workflows/ci.yml` |

**Technical debt signals**

| Signal | Status |
|--------|--------|
| `TODO` / `FIXME` / `HACK` in `client/src/**/*.js`, `server/**/*.js` (excl. node_modules) | **0 matches** (grep 2026-04-09) |
| `TODOS.md` testing strategy items T-01–T-07, Q-01–Q-03 | **Closed** |
| Open product gates in `TODOS.md` | Mobile-input contracts, dependency degradation (non-dictionary games), playable-state invariants per new game |

---

## Section 4: Security pulse

| Check | Status | Notes |
|-------|--------|--------|
| Secrets in committed code | No signal this run | `.env` gitignored; use Render env vars |
| Auth boundaries | Partially tested | Supabase + client flows; not full E2E in CI |
| Input validation | Server-authoritative games | GameState rejection tests |
| CORS | Configured in `server/index.js` | Prod domain in checklist |
| Rate limiting | Not assessed here | — |
| RLS / Supabase | Schema in repo | Manual dashboard discipline |
| npm audit (high+) | 0 | 2026-04-09 |
| CSP | Not scored this week | — |

---

## Section 5: Actions for next week

| # | Action | Effort | Priority | Ref |
|---|--------|--------|----------|-----|
| 1 | Add **pointer/drag** contract tests for a canvas-heavy HUD (e.g. word-scramble path / doodle strokes) — lobby depth improved; games still shallow on touch | Medium | High | `TODOS.md` criteria gate |
| 2 | Optional: **CI wall-clock** — measure `test:repeat` duration; consider splitting “fast PR” vs nightly full matrix if it exceeds comfort | Low | Medium | DPE |
| 3 | Extend **`payloadShape`** assertions to one more event family (e.g. `quiz-race-state`) if RoomManager gains slicing | Low | Medium | DRY + contracts |
| 4 | Keep **manual iOS Safari** smoke on deploy (existing `CLAUDE.md` checklist) | Low | High | Production quality |

---

## Section 6: Overall health

| Area | Grade | Trend | Key issue |
|------|-------|-------|-----------|
| Verification T1 (lint) | A | → | None |
| Verification T2 (static) | B | → | No Sonar/Semgrep; audit clean |
| Verification T3 (tests) | A- | ↑ | CI time cost of 3× test; no E2E |
| Design (micro) | B+ | ↑ | DRY on payloads |
| Design (macro / resilience) | B | → | RoomManager size |
| Security | B+ | → | No high CVEs; auth E2E not automated |
| Delivery / CI | A- | ↑ | Repeat-run stability wired |
| Technical debt (TODOs in code) | A | → | Zero grep hits |
| Deployment readiness | A- | → | Render + checklist |

**Overall: GREEN** — suite and gates are green; remaining gaps are **E2E/mobile automation** and **optional Tier 2 static tooling**, not blocking ship.

---

## Summary (narrative)

Strengths: **351** tests, **~95%** line coverage with an enforced gate, **split RoomManager** suites, **dictionary fail-open** tests, **client Router/lobby/analytics** coverage, and **3× `npm test`** in CI for flake detection. Dependencies report **zero high+ vulnerabilities**.

Main follow-ups: **per-game mobile-input tests** and **playable-state / degradation** gates called out in `TODOS.md` for future games; consider **CI duration** as the suite grows.
