# Design audit: SUPERBUCIN

| Field | Value |
|-------|-------|
| **Date** | 2026-04-05 |
| **URL** | https://superbucin.pricylia.com |
| **Scope** | Lobby, auth, inferred in-game HUD styles (shell + multi-game CSS) |
| **DESIGN.md** | None in repo; calibrated against `main-design-20260404-superbucin.md` (couples / Hago-style collection intent) |
| **Working tree** | **Dirty** at audit time (`client/src/main.js`, `.claude/worktrees/…`). Per `/design-review` workflow, atomic design commits are easiest after `git stash` or commit. |

---

## Phase 1 — First impression

The site communicates **a private arcade for two people** — playful, romantic, and slightly loud (neon pink on midnight blue), not a corporate product.

I notice **one visual system** carrying the whole product: pink primary actions, blue secondary, soft glows on buttons, rounded “pill” geometry, and emoji-forward game cards. It matches the approved brief (“love letter disguised as a game”) without sliding into generic SaaS purple gradients.

The first three things my eye hits are: **(1)** the glowing **SUPERBUCIN** wordmark, **(2)** the **Create Room** pink slab, **(3)** the **game grid**. That hierarchy is correct for “pick a game, then host.”

One word: **Earnest** — it looks purpose-built for the audience, not template-churn.

---

## Phase 2 — Inferred design system (rendered)

| Token | Observation |
|--------|-------------|
| **Background** | `#1a1a2e` navy; loading gradient adds `#16213e` / `#0f3460` |
| **Primary accent** | `#ff6b9d` / `#ff4081` (pink gradients, glow) |
| **Secondary accent** | `#6bc5ff` / `#4081ff` (blue join / back actions) |
| **Body type** | `Segoe UI`, system-ui, -apple-system, sans-serif (single stack — good) |
| **Game HUDs** | Shared language: dark surfaces, rounded rects, pink + mint (`#7dffb3`) / rose (`#ff8ab8`) score cues in Word Scramble; Othello turn/score bars use the same pink + cyan glow language; Doodle/Memory use parallel top bars and pills |
| **Motion** | Short `transform` / `opacity` on buttons; loading `pulse` on copy |

**Palette:** Warm pink + cool blue on cool navy — coherent, under 12 semantic hues. **Not** AI-slop purple/indigo hero gradients.

---

## Phase 3 — Page / surface audit

### Lobby (desktop ~1280×800)

- **Hierarchy:** Strong — title → room actions → catalogue.
- **Composition:** Centered column; game grid 2×2 + trailing row reads as “collection.” On production snapshot, **Othello sat fifth** and was **clipped** at the bottom — hurts discoverability and feels like a mistake (deploy may still be catching up if `main.js` order changed locally).
- **Interaction:** Game tiles are **divs**, not `<button>` — hurts keyboard, screen readers, and automated testing (medium impact).

### Lobby (mobile ~390×844)

- Same visual quality; **all five cards** can be reached only if the lobby scrolls. **Fix applied in repo:** `.lobby-ui` is now vertically scrollable with safe-area padding and `touch-action: pan-y` so scrolling works despite `touch-action: none` on `body`.

### Auth (Sign in)

- **Consistency:** Matches lobby — pink primary, blue secondary, same glow vocabulary.
- **Hierarchy:** “SIGN IN” + subline + segmented Log in / Sign up is clear.
- **Forms:** Inputs are full-width, readable; touch targets look adequate on mobile snapshot.

### In-game style (codebase CSS review — *supplementary* to live pass)

Without a second player on production, full live capture of every HUD wasn’t possible in one session. From `client/index.html` styles:

| Game | Shell pattern | Fit with brand |
|------|----------------|----------------|
| **Pig vs Chick** | HP bars + circular spawn dock | Same pink/blue; more “gamey” chrome than word games — appropriate for RTS-lite |
| **Word Scramble** | `.wsr-topbar`, pills, grid cells | Tight typographic UI; mint/rose score split matches couple competitive vibe |
| **Doodle Guess** | Top bar + prompt box + canvas strip | Aligns with WSR bar rhythm |
| **Memory** | Board + `.memory-hud-*` | Card backs/fronts share dark + pink accent |
| **Othello** | `.othello-turn-bar` / `.othello-score-bar` | Same glow + turn emphasis as other games |

**Verdict:** The **multi-game shell still works** — one “SUPERBUCIN neon dark” language with per-game layout variance that’s justified by genre. No clash that forces a rebrand; biggest risk is **lobby ergonomics** (now mitigated by scroll) and **semantic HTML** for tiles.

---

## Phase 4 — Interaction flow (feel)

- **Lobby:** Taps feel immediate (`:active` scale). Loading overlay fades — acceptable.
- **Auth:** Tab switch between Log in / Sign up should feel instant; primary CTA is obvious.
- **Gap:** Focus-visible rings not verified on custom tiles — likely weak for keyboard users.

---

## Phase 5 — Cross-surface consistency

- Lobby, auth, and HUD CSS share **radius ~16px**, **pink/blue pairing**, and **text-shadow glow** on hero type — good.
- **Inconsistency:** Pig vs Chick uses a heavier game chrome (bars + circles) vs word games’ flatter HUD — acceptable as long as **color + glow** stay aligned (they do).

---

## Phase 6 — Scores

### Design score: **B+**

| Category | Grade | Notes |
|----------|-------|--------|
| Visual hierarchy | B+ | Strong; fifth card was a problem pre-scroll |
| Typography | B | System stack; no custom display font — fine for utilitarian game UI |
| Spacing & layout | B | Mostly 8-ish rhythm; centered everything is on-brand for this product |
| Color & contrast | B+ | Readable; pink on dark passes for large type; check small grey copy on AA in a contrast tool |
| Interaction states | B- | Buttons good; non-button tiles |
| Responsive | B → **B+** | Scroll fix addresses real failure mode |
| Content / microcopy | A- | “sayang”, hearts, guest names — coherent voice |
| AI slop | **A-** | Avoids SaaS template tropes; emoji here are **content**, not decoration slop |
| Motion | B | Short, purposeful |
| Performance feel | B | Large single JS chunk — perceptual load on first visit |

### AI slop score (standalone): **A-**

Not the “three columns with icons in circles” SaaS look. The risk is only **generic system fonts** — acceptable for a small indie web game.

---

## Findings & triage

| ID | Title | Impact | Fix status |
|----|--------|--------|------------|
| **FINDING-001** | Lobby content clipped on small viewports (no scroll) | High | **Fixed** — `client/index.html` `.lobby-ui` scroll + safe-area + `pan-y` |
| **FINDING-002** | Game cards & side picks are `<div>` only | Medium | Deferred — use `<button type="button">` or roles + keyboard |
| **FINDING-003** | `user-scalable=no` / `maximum-scale=1` | Medium | Deferred — accessibility vs game pinch tradeoff |
| **FINDING-004** | `outline`/focus-visible on custom controls | Medium | Deferred |
| **FINDING-005** | Production lobby order may lag `main` (Othello position) | Low | Deploy / cache |

---

## Quick wins (< 30 min each)

1. ~~Enable lobby scroll~~ (done in this pass).
2. Add `role="button"` + `tabindex="0"` + Enter/Space on `.game-card` and `.side-option` (or replace with `<button>`).
3. Soften viewport meta to allow zoom (`maximum-scale=5` or remove max) if pinch-zoom doesn’t break games.
4. Run contrast check on `.lobby-subtitle` grey vs `#1a1a2e`.

---

## PR-style summary

> Design review: SUPERBUCIN shell stays on-brand across games (neon pink/blue on navy; per-game HUDs share vocabulary). Fixed lobby vertical scroll on small screens so all games are reachable. Deferred semantic controls and viewport-zoom for a follow-up.

---

## Files touched (this review)

- `client/index.html` — FINDING-001 lobby scroll
- `design-reports/design-audit-superbucin-2026-04-05.md` — this report
- `design-reports/design-baseline.json` — baseline for regression
