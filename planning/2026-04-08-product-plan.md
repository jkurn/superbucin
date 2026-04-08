# SUPERBUCIN — Product Plan

Last updated: 2026-04-08  
Owner: Product (Jonathan) · Engineering partner: same repo  
Status: Living document — revise monthly or after major ships

## 1. Purpose of this doc

This is the **single map** for what SUPERBUCIN is building toward: user value, growth loops, content, and platform bets. Detailed engineering specs live in linked plans; this file ties them together and answers “what’s next and why.”

**Related artifacts**

| Topic | Document |
|--------|-----------|
| Original game #1 design & premises | `main-design-20260404-superbucin.md` (repo root) |
| Event names, properties, funnels | `planning/2026-04-08-event-tracking-dictionary.md` |
| PostHog dashboard build | `planning/2026-04-08-posthog-viral-dashboard.md` |
| Test health & weekly bets | `planning/2026-04-07-testing-health.md` |
| Testing strategy depth | `planning/2026-04-07-robust-testing-strategy.md` |
| Next games rationale (historical) | `planning/2026-04-05-next-three-games.md` |
| UIManager modularization (largely shipped) | `planning/uimanager-refactor-plan.md` |
| UI regression checklist | `planning/2026-04-07-ui-regression-checklist.md` |
| Engineering checklist / gates | `TODOS.md` |
| /autoplan analytics gate | Bottom of `planning/2026-04-08-event-tracking-dictionary.md` |

---

## 2. Vision (unchanged core)

SUPERBUCIN is a **mobile-web couples minigame collection**: low friction, real-time two-player rooms, and a **personality layer** (pet names, stickers, Indonesian-flavored copy) that makes it feel like a gift, not a generic party game.

**Product principles**

1. **Mobile-web first** — iOS Safari and Android Chrome are the bar; touch targets and safe areas matter more than desktop polish.
2. **Server-authoritative fairness** — especially as the audience widens beyond the original two players.
3. **Room-code simplicity** — create → share → join must stay understandable in one glance.
4. **Expandable shell** — new modes slot in via registry/factory patterns already in place.
5. **Measure before optimizing** — funnels and failures are defined in the event dictionary; ship instrumentation before big UX bets.

---

## 3. Who it’s for

| Segment | Definition | Implication |
|---------|------------|-------------|
| **Primary** | Couple who already know each other; one sends a link or code | Optimize invite + first match, not matchmaking |
| **Secondary** | Close friends duos (same mechanics) | Same flows; tone can stay “couple-first” |
| **Growth edge** | Stranger opens a viral result link | Deep link → lobby → pick/join game is the conversion path |

---

## 4. Product pillars & current state

| Pillar | Intent | Today (2026-04-08) | Next product bets |
|--------|--------|--------------------|-------------------|
| **Play** | Fast, reliable matches across many modes | Many registered games + strong server tests on core paths | Per-mode onboarding hints; optional short “how to play” modals |
| **Connect** | Low friction to same room | Auth, room codes, reconnection grace, deep links from result shares | Optional reminders / “play again” nudges (respect notification constraints on web) |
| **Express** | Personality & delight | Stickers, quotes, victory share, bucin categories | Seasonal sticker drops; lightweight profile flair tied to achievements |
| **Grow** | Viral loop + measurable funnel | PostHog events, result share URLs, `challenge_deep_link_opened`, dashboard blueprint | Build PostHog widgets; run first A/B on share copy or default game |
| **Trust** | Safe, stable experience | Lint, ~300 tests, coverage gate, CORS/deploy discipline | Abuse surface review if traffic grows; rate limits already worth monitoring |

---

## 5. User journeys (product view)

### J.1 First-time activation

Load → lobby visible → pick game → create or join → side select → **first `game_started`** within one session.

**Failure points to watch:** loading drop-off, join validation, socket errors, confusing side select.

### J.2 Returning session

Open app → lobby → repeat match or switch game.

**Retention proxy:** `game_started` on D1/D7 after first qualifying session (see metrics).

### J.3 Viral inbound (recipient)

Open shared `/?challenge=&game=` → **`challenge_deep_link_opened`** → (optional) preselected game → create/join → `game_started`.

**Success:** recipient completes a match, not only lands on lobby.

### J.4 Auth path

Sign up / sign in → lobby with persistent profile.

**Funnel:** dictionary Journey B (`auth_*` events).

---

## 6. Metrics

### North Star (recommended)

**Weekly active pairs completing at least one match** — operationalized as: distinct `room_code` values (or `user_id` pairs if modeled) with ≥1 `match_ended` per week. If that’s too heavy to query initially, proxy with **unique users with `game_started` per week** (segment `is_guest` vs authenticated).

### Supporting KPIs

- **Activation:** % of sessions: `loading_completed` → `game_started` (same session, time window per PostHog funnel).
- **Viral:** `share_clicked` / `result_viewed`; inbound `challenge_deep_link_opened` → `game_started` (Widget 11 in viral dashboard doc).
- **Reliability:** `share_failed` rate; `room_error` / `socket_connect_error` counts by `error_code`.
- **Engagement depth:** `match_ended` per user per week; rematch funnel `rematch_requested` → next `game_started`.

### Guardrails

- p95 load time (from `game_loaded` / loading events).
- Mobile vs desktop split on errors (`is_mobile_web`).

---

## 7. Roadmap

Horizons are **calendar guidance**, not commitments. Re-order when data or life context changes.

### Phase A — Growth truth (weeks 0–2) — *mostly complete in code*

- [x] Core PostHog instrumentation + dictionary
- [x] Result + invite share events; inbound challenge/game query handling + `challenge_deep_link_opened`
- [ ] **Operator task:** create PostHog dashboard from `2026-04-08-posthog-viral-dashboard.md`
- [ ] First weekly review: compare funnel to intuition; note top 3 drop-offs

### Phase B — Activation polish (weeks 2–6)

- Lightweight **per-game “how to play”** (modal or first-run tooltip) for top 3 modes by traffic — emit `tutorial_started` / `tutorial_completed` when added (dictionary already reserves names).
- **Join flow clarity:** clearer empty states if code wrong; optional deep link `?room=CODE` *if* product wants join-by-URL without typing (engineering spike: router + privacy).
- **Loading UX:** if `loading_tapped` correlates with drop-off, add subtle progress or copy.

### Phase C — Retention & habit (weeks 4–12)

- **Streaks / gentle nudges** in profile or post-match (no spam): “Main lagi minggu ini?” tied to stickers or points already in Supabase path.
- **Rematch friction:** one-tap rematch when same pair reconnects quickly (validate server room lifecycle).
- Optional **weekly challenge** mode: fixed game-of-week with leaderboard between friends (scope gate: only if metrics show repeat play ceiling).

### Phase D — Content expansion (ongoing)

- **New minigames** when a clear gap appears (party balance, session length, or “we’re bored of X”).
- **Difficulty / variants** for existing hits (memory grid, quiz packs) — track with `game_type` + new properties, not new event names where possible.
- **Seasonal drops** (stickers, quotes, lobby easter eggs) — low engineering, high delight.

### Phase E — Platform & scale (conditional)

Only if usage leaves the “trusted circle” phase:

- **Moderation:** report flow, profanity on custom prompts (doodle), rate limits on room creation.
- **Performance:** CDN for static assets; review Socket.io room caps.
- **Compliance:** privacy copy, cookie/consent if EU traffic matters.

---

## 8. Prioritized backlog (product backlog, not `TODOS.md`)

| Priority | Item | Type | Notes |
|----------|------|------|--------|
| P0 | PostHog dashboard live | Ops | Unblocks data-driven prioritization |
| P0 | Weekly funnel review (30 min) | Process | Use dictionary + dashboard |
| P1 | Per-game first-run tips (top modes) | UX + analytics | Enables `tutorial_*` events |
| P1 | Share copy experiment (1 variant) | Growth | Same events; different strings |
| P2 | Join-by-URL `?room=` | UX | Needs router + security review |
| P2 | Rematch one-tap | Retention | Server + UI |
| P2 | Profile / streak nudges | Retention | Tied to existing points/stats |
| P3 | New game or major variant | Content | After data or explicit creative push |
| P3 | Public-scale moderation | Platform | If traffic warrants |

---

## 9. Engineering alignment (not product scope, but shared schedule)

These protect the product’s ability to ship safely:

- **Testing:** follow improvement bets in `planning/2026-04-07-testing-health.md` (e.g. `GameFactory` seams, `bonk-brawl` / `doodle-guess` branches).
- **UI shell:** `UIManager` is already thin (~232 lines); treat `uimanager-refactor-plan.md` as **reference**, not urgent rework.
- **Pre-deploy:** `CLAUDE.md` checklist (Supabase, PostHog `VITE_*`, CORS, mobile smoke).

---

## 10. Risks & non-goals

**Risks**

- Over-instrumenting without reviewing dashboards → noise. Mitigation: one standing calendar block.
- Custom user content (doodle prompts) + growth → abuse. Mitigation: defer until Phase E or add minimal filtering.
- Mobile browser background tab / sleep → disconnect perception. Mitigation: copy + reconnect UX already partially there; measure `opponent_disconnected`.

**Non-goals (for now)**

- Native app store clients.
- Global skill-based matchmaking.
- Heavy monetization design (keep optional; dictionary already mentions future economy events if needed).

---

## 11. Revision log

| Date | Change |
|------|--------|
| 2026-04-08 | Initial integrated product plan: pillars, journeys, roadmap, metrics, backlog links |

---

## 12. Premises (confirm or edit)

1. Primary use remains **two people who coordinate out-of-band** (chat apps), not in-app discovery.
2. **Web + Socket.io** architecture is fixed for the medium term.
3. **PostHog** is the analytics system of record for growth and reliability segmentation.
4. Personality (Indonesian / couple tone) remains a **differentiator**, not localized away unless you explicitly expand markets.

When these change, update Section 2–3 and re-check Phase E triggers.
