# Design Audit — superbucin.pricylia.com (2026-04-08)

## Headline Scores

- **Design Score:** `B+`
- **AI Slop Score:** `A-`

## First Impression

- The site communicates **a playful, romantic mini-game hub with personality**.
- I notice **strong visual identity and emotional tone, but small mobile usability cracks**.
- The first 3 things my eye goes to are: **SUPERBUCIN wordmark**, **Pig vs Chick highlighted card**, **decorative stickers/avatars**.
- If I had to describe this in one word: **charming**.

## Scope

- Target URL: `https://superbucin.pricylia.com`
- Mode: Full audit (lobby, auth, room waiting state, responsive checks)
- Screenshots captured:
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/first-impression.png`
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/lobby-desktop.png`
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/lobby-tablet.png`
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/lobby-mobile.png`
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/auth-desktop.png`
  - `/var/folders/2n/lc7lb9h148j3m_zs46xlhzy80000gn/T/cursor/screenshots/room-waiting-desktop.png`

## Inferred Design System

- **Fonts:** Rounded geometric sans style with consistent display/body pairing; no obvious font sprawl.
- **Colors:** Deep navy background + pink primary + electric blue secondary + muted violet text accents. Cohesive and on-brand.
- **Heading scale:** Strong hero heading, medium section text, compact labels; hierarchy is generally clear.
- **Spacing pattern:** Card spacing is mostly consistent in 2-column lobby grid; some vertical rhythm feels crowded on smaller viewports.
- **Touch target audit (sampled):**
  - Sign In button (`mobile`, before): `80x29` (fails 44px minimum)
  - Sign In button (`mobile`, after): `83x44` (passes)
  - Join Room button (`mobile`, before): `200x35` (fails 44px minimum)
  - Join Room button (`mobile`, after): `200x44` (passes)
  - Create Room button (`mobile`): `280x46` (passes)

Want me to save this inferred system as a formal `DESIGN.md` baseline for the repo?

## Findings

### High Impact

1. **FINDING-001 — Mobile top bar crowds the hero area**
   - Category: Responsive / Hierarchy
   - I notice the top account strip + stickers intrude into the hero block on mobile, making the first screen feel cramped.
   - Evidence: `lobby-mobile.png`
   - What if: tighten top bar height on <768px, reduce sticker footprint near the title, and increase top padding under header.
   - Status: verified
   - Commit: `34b6592`
   - Files Changed: `client/src/screens/LobbyScreen.js`, `client/src/styles/stickers.css`
   - Before/After: `lobby-mobile.png` -> `finding-001-after.png`

2. **FINDING-002 — Critical controls under 44px touch minimum**
   - Category: Interaction / Accessibility
   - Sign In and Join Room controls are below recommended touch target size on mobile.
   - Evidence: measured bounding boxes (`80x29`, `200x35`)
   - What if: enforce `min-height: 44px` for all primary/secondary action buttons.
   - Status: verified
   - Commit: `798eade`
   - Files Changed: `client/src/styles/core.css`, `client/src/styles/games.css`
   - Before/After: `lobby-mobile.png` -> `finding-002-after.png`

### Medium Impact

3. **FINDING-003 — Decorative stickers compete with navigation and title**
   - Category: Visual Hierarchy
   - I think sticker placement near the logo/header adds noise because it competes with key orientation elements.
   - Evidence: `lobby-desktop.png`, `lobby-mobile.png`
   - What if: lower opacity/scale in hero area and constrain decorative overlays away from top nav/title.
   - Status: best-effort

4. **FINDING-004 — Lobby card labels are visually dense at smaller widths**
   - Category: Typography / Spacing
   - Subtitle badges and two-line titles stack tightly and reduce scan speed on mobile.
   - Evidence: `lobby-mobile.png`
   - What if: reduce badge prominence, add 2-4px vertical breathing room, and simplify copy where possible.
   - Status: verified
   - Commit: `5b4a12b`
   - Files Changed: `client/src/styles/core.css`
   - Before/After: `lobby-mobile.png` -> `finding-004-after.png`

5. **FINDING-005 — Auth page lacks clear inline validation feedback prominence**
   - Category: Content / Interaction
   - I notice the auth form is visually clean, but feedback hierarchy is subtle when fields are empty.
   - Evidence: `auth-desktop.png`
   - What if: stronger error contrast/placement directly under related field group with clearer action text.
   - Status: deferred

### Polish

6. **FINDING-006 — Room waiting screen has large low-information empty area**
   - Category: Composition
   - The waiting state has strong branding but leaves substantial unused vertical space.
   - Evidence: `room-waiting-desktop.png`
   - What if: add lightweight “what to do next” checklist (copy link, share, invite cue).
   - Status: deferred

7. **FINDING-007 — CTA styling language differs between auth and lobby**
   - Category: Consistency
   - Lobby buttons and auth buttons are both on-brand but diverge in weight/glow behavior.
   - Evidence: `lobby-desktop.png`, `auth-desktop.png`
   - What if: align button elevation/glow scale tokens across screens.
   - Status: deferred

## Category Grades

- Visual Hierarchy & Composition: `B`
- Typography: `B`
- Spacing & Layout: `B+`
- Color & Contrast: `B+`
- Interaction States: `B`
- Responsive Design: `B`
- Motion & Animation: `B`
- Content & Microcopy: `B`
- AI Slop Detection: `A-`
- Performance Feel: `B`

## Regression vs Baseline (2026-04-05)

| Area | Baseline | Current | Delta |
|---|---:|---:|---:|
| Design Score | B+ | B+ | = |
| AI Slop Score | A- | A- | = |
| Responsive | B+ | B | ~ |
| Interaction | B- | B | + |

### Newly Observed

- Mobile touch target failures for top-right and bottom CTA controls (resolved).
- Mobile hero/header crowding from decorative layer overlap (resolved).

### Previously Observed

- Prior semantic button / viewport issues appear materially improved in current render.

## Quick Wins (< 30 min each)

1. Add stronger inline error contrast and spacing on auth forms for clearer failure states.
2. Normalize CTA elevation/glow tokens between lobby and auth screens.
3. Add waiting-room next-step guidance (copy/share/invite checklist).

## Flow Review Notes

- Lobby -> Auth: transition is clear and quick.
- Lobby -> Create Room: flow works and URL state is shareable (`/room/:code`), which is good UX.
- Waiting room: clear state messaging, but can benefit from more actionable guidance.

## PR Summary

Design review found 7 issues, fixed 3. Design score `B+ -> B+`, AI slop score `A- -> A-`.
