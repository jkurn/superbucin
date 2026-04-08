# SUPERBUCIN PostHog Viral Dashboard Setup

Last updated: 2026-04-08
Owner: Product + Growth

## Goal

Measure and improve the viral loop:

`result_viewed -> share_clicked -> (recipient) challenge_deep_link_opened -> room/game_started`

## Dashboard Name

`SUPERBUCIN - Viral Loop`

## Global Filters (apply to whole dashboard)

- `environment != local`
- `app = superbucin`
- Time range:
  - Default: last 14 days
  - Compare with: previous 14 days

Optional:
- Exclude internal users/persons by your internal email/domain property.

## Widget 1: Result Exposure

- Type: Trend
- Event: `result_viewed`
- Metric: total events and unique users
- Breakdown: `game_type`
- Why: baseline denominator for share conversion.

## Widget 2: Share Clicks

- Type: Trend
- Event: `share_clicked`
- Metric: total events and unique users
- Breakdown: `share_platform`
- Why: see which channels users prefer (WhatsApp/X/copy/native).

## Widget 3: Viral Funnel (Core)

- Type: Funnel
- Steps:
  1. `result_viewed`
  2. `share_clicked`
- Conversion window: 30 minutes
- Breakdown: `share_platform`
- Why: primary share conversion KPI.

## Widget 4: Share Conversion by Category

- Type: Funnel
- Steps:
  1. `result_viewed`
  2. `share_clicked`
- Conversion window: 30 minutes
- Breakdown: `bucin_category`
- Why: identify which result categories are most share-worthy.

## Widget 5: Invite Surface Effectiveness

- Type: Funnel
- Steps:
  1. `invite_link_viewed`
  2. `share_clicked` where `share_context = invite`
- Conversion window: 30 minutes
- Breakdown: `share_platform`
- Why: quantify waiting-room invite share performance separately from result share.

## Widget 6: Share Failures

- Type: Trends (table view preferred)
- Event: `share_failed`
- Breakdown: `share_platform`, then `error_code`
- Why: reliability monitoring for viral features.

## Widget 7: Loading Impact on Virality

- Type: Funnel
- Steps:
  1. `loading_started`
  2. `loading_completed`
  3. `result_viewed`
  4. `share_clicked`
- Conversion window: 1 day
- Breakdown: `connection_type`
- Why: validate whether poor loading/network quality suppresses downstream sharing.

## Widget 8: Platform Mix (Pie)

- Type: Pie
- Event: `share_clicked`
- Breakdown: `share_platform`
- Filter: last 7 days
- Why: fast at-a-glance channel allocation.

## Widget 9: Mobile Segment Check

- Type: Trend
- Event: `share_clicked`
- Breakdown: `is_mobile_web`
- Why: ensure viral behavior is actually happening on mobile-web (core surface).

## Widget 10: Cohort Retention with Viral Action

- Type: Retention
- Returning event: `game_started`
- Cohort event: `share_clicked`
- Periods: D1 / D7 / D30
- Why: test whether users who share have stronger retention.

## Widget 11: Inbound challenge links

- Type: Funnel
- Steps:
  1. `challenge_deep_link_opened`
  2. `game_started`
- Conversion window: 1 day
- Breakdown: `game_param_matched`, `has_challenge`
- Why: measure whether shared result URLs (`/?challenge=&game=`) convert to an actual match.

## Core KPI Definitions

- Viral Share Conversion (%):
  - `unique users who did share_clicked / unique users who did result_viewed`
- Invite Share Conversion (%):
  - `unique users who did share_clicked where share_context=invite / unique users who did invite_link_viewed`
- Share Failure Rate (%):
  - `share_failed / share_clicked`
- Platform Contribution (%):
  - `% of share_clicked by share_platform`
- Challenge link activation (%):
  - `unique users with game_started / unique users with challenge_deep_link_opened` (same-day window as in Widget 11)

## Recommended Targets (initial)

- Viral Share Conversion: start with 8-15% goal
- Share Failure Rate: <2%
- Top platform concentration: no single platform >80% long-term (healthy mix)

## Weekly Review Cadence

- Monday:
  - Check KPI trends vs previous week
  - Check top `error_code` from `share_failed`
- Wednesday:
  - Review replays for users with `result_viewed` but no `share_clicked`
  - Identify UX copy/button placement experiments
- Friday:
  - Decide one viral UX experiment for next week

## Experiment Backlog (ready to test)

1. Result CTA copy variants:
   - "Share your Bucin Level 💕" vs "Challenge sayang now!"
2. Platform-first ordering:
   - Put WhatsApp first on mobile if that is top platform.
3. Social proof:
   - Add micro-copy: "Most shared this week: Bucin Akut"
4. One-tap challenge links:
   - Pre-fill challenge intent (`?challenge=` + `?game=`) and auto-highlight join path.

## QA Checklist (before relying on metrics)

- Verify each share button emits `share_clicked` with correct `share_platform`.
- Force failures and verify `share_failed` with meaningful `error_code`.
- Verify both contexts:
  - `share_context = result` (victory screen)
  - `share_context = invite` (waiting room)
- Ensure dashboard filters exclude `environment=local`.
