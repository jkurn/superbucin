# SUPERBUCIN Event Tracking Dictionary

Last updated: 2026-04-08
Owner: Product + Engineering
Analytics tool: PostHog

## Purpose

This document defines what we track, why we track it, and how to keep event data consistent enough for fast product decisions.

## Conventions

- Event names: `lowercase_snake_case` with action verbs.
- Properties: `lowercase_snake_case`.
- Keep event names stable; prefer adding properties over creating near-duplicate events.
- Track journeys as `intent -> success -> failure`.
- Every new event must include trigger, required properties, and QA checks.

## Global Properties (Track On Most Events)

These are the key information fields needed for reliable analysis:

- `environment` (string): `local`, `staging`, `production`
- `app` (string): `superbucin`
- `is_guest` (boolean): guest vs authenticated
- `user_id` (string|null): stable user identifier when available
- `session_id` (string): analytics/session grouping
- `screen` (string): current full-screen context
- `room_code` (string|null): active room identifier
- `game_type` (string|null): current game mode
- `is_host` (boolean|null): host vs joiner
- `error_code` (string|null): failure reason code for explicit failures
- `error_message` (string|null): human-readable error (truncate if needed)
- `ts_client` (datetime): client timestamp (PostHog default timestamp is also used)

Notes:
- `app` is registered globally in code.
- Add `environment` explicitly in client init (`local` for localhost, `production` for prod).
- If a property is not applicable, send `null` instead of omitting it for consistent queries.

## Growth Journeys

### Journey A: First Match Activation

Intent:
- `ui_screen_viewed` (`screen=lobby`)
- `lobby_game_selected`
- `create_room_attempt` or `join_room_attempt`

Success:
- `room_created` / `room_joined`
- `game_started`
- `match_ended`

Failure:
- `lobby_join_validation_failed`
- `room_error`
- `socket_connect_error`
- Implicit drop-off before `game_started`

### Journey B: Auth Activation

Intent:
- `ui_screen_viewed` (`screen=auth`)
- `auth_forgot_password_opened`

Success:
- `auth_sign_up_success`
- `auth_sign_in_success`
- `auth_password_updated`

Failure:
- `auth_sign_up_failed`, `auth_sign_in_failed`
- `auth_*_validation_failed`
- `auth_reset_password_failed`, `auth_update_password_failed`

### Journey C: Replay/Retention Loop

Intent:
- `ui_screen_viewed` (`screen=victory`)

Success:
- `rematch_requested`
- next `game_started`

Failure:
- `opponent_disconnected`
- no replay after victory

## Mobile Web Game Telemetry Goals

This project is a mobile-web multiplayer game collection, so analytics must answer:
- Is onboarding fast enough and clear enough?
- Is gameplay balanced and fun?
- Where does mobile-web UX break (lag, touch targets, viewport issues)?
- Do players come back on D1/D7/D30?

### Core Event Set for Mobile-Web Games

- Already implemented:
  - `loading_started` (entry into loading state)
  - `loading_completed` (loading UI replaced by game UI)
  - `loading_tapped` (first impatient tap during loading)
  - `game_loaded` (app boot complete + load timing + device context)
  - `ui_screen_viewed`, `game_started`, `match_ended`, `game_action_error`, `room_error`
  - `result_viewed`, `share_clicked`, `share_failed`, `invite_link_viewed`
  - connectivity and opponent reconnect events
- Planned (next iteration):
  - `tutorial_started`
  - `tutorial_completed`
  - `level_started`
  - `level_completed`
  - `level_failed`
  - `reward_claimed` (or `item_purchased` if economy/monetization is added)

### Funnel Templates (PostHog)

- Onboarding funnel:
  - `$pageview` -> `loading_started` -> `loading_completed` -> `game_loaded` -> `ui_screen_viewed(screen=lobby)` -> `game_started`
  - If/when tutorial is added: insert `tutorial_started` and `tutorial_completed` before first `game_started`.
- Progression/balance funnel (per game mode):
  - `level_started` -> `level_completed`
  - break down by `game_type`, `level_number`, `failure_reason`
- Reliability funnel:
  - `game_started` -> `match_ended`
  - drop-offs broken down by `socket_disconnected`, `opponent_disconnected`, `game_action_error`
- Viral funnel:
  - `result_viewed` -> `share_clicked`
  - break down by `share_platform`, `bucin_category`, `result_outcome`

### Mobile-Web Diagnostics

- Enable/keep PostHog autocapture for rage/dead clicks.
- Analyze session replays for:
  - touch targets too small
  - accidental pull-to-refresh/back gestures
  - browser chrome overlap on short viewports
- Segment insights by:
  - `is_mobile_web`
  - `viewport_width`, `viewport_height`, `device_pixel_ratio`
  - `connection_type`

### Retention Targets

- D1 retention: returned and played (`game_started`) next day after first play
- D7 retention: returned and played within day-7 window
- D30 retention: long-term habit/content durability

## Key Information to Track for Actionable Analytics

These fields are highest priority for game balancing and mobile UX:

- Journey context:
  - `screen`, `route`
  - `room_code`, `game_type`, `is_host`, `is_guest`
- Performance and device:
  - `load_time_ms`, `load_time_seconds`, `is_mobile_web`
  - `viewport_width`, `viewport_height`, `device_pixel_ratio`, `connection_type`
- Success outcome:
  - `is_winner`, `tie`, `points_earned` (where available)
  - `time_taken`, `score`, `stars_earned` (for level-based games)
- Failure diagnostics:
  - `error_code`, `error_message`, `failure_reason`
  - `reason` on validation and disconnect events
- Economy (if added):
  - `item_id`, `item_type`, `currency_type`, `cost`, `reward_type`

## Event Dictionary

## 1) Navigation and Screen Events

### `ui_screen_viewed`
- Trigger when: app renders a full-screen UI state via `UIManager`.
- Required properties: `screen`
- Recommended properties: `from_router`, `room_code`, `game_type`, `is_host`, `username`
- Type: Intent/context
- QA: navigate to each major screen and verify event with expected `screen` value.

### `$pageview`
- Trigger when: SPA route is navigated/replaced or resolved.
- Required properties: `path`, `url`
- Type: Context
- QA: confirm initial load and route changes emit pageviews.

### `loading_started`
- Trigger when: app init begins and loading screen is shown.
- Required properties: none
- Recommended properties: `is_mobile_web`, `viewport_width`, `viewport_height`, `device_pixel_ratio`, `connection_type`, `route`
- Type: Onboarding/performance
- QA: hard-refresh page and verify event fires once.

### `loading_completed`
- Trigger when: loading UI is hidden and replaced by playable UI.
- Required properties: `loading_time_ms`, `loading_time_seconds`, `exceeded_5s`, `was_tapped_during_loading`
- Recommended properties: `is_mobile_web`, `viewport_width`, `viewport_height`, `connection_type`, `route`
- Type: Onboarding/performance
- QA: verify event always follows `loading_started` and timing is non-negative.

### `loading_tapped`
- Trigger when: user taps/clicks the loading screen (first tap only).
- Required properties: `elapsed_ms_since_loading_start`
- Recommended properties: `is_mobile_web`, `viewport_width`, `viewport_height`, `connection_type`, `route`
- Type: Friction signal
- QA: tap loading screen during throttled load and verify event fires once.

### `game_loaded`
- Trigger when: first playable app state is reached after boot/init.
- Required properties: `load_time_ms`, `load_time_seconds`, `is_mobile_web`
- Recommended properties: `viewport_width`, `viewport_height`, `device_pixel_ratio`, `connection_type`, `route`
- Type: Onboarding/performance
- QA: verify event fires once per page load and load-time values are non-negative.

## 2) Auth Events

### `auth_sign_up_success`
- Trigger when: sign-up API call succeeds.
- Required properties: `has_display_name`, `has_avatar`
- Type: Success

### `auth_sign_in_success`
- Trigger when: sign-in API call succeeds.
- Required properties: none
- Type: Success

### `auth_password_reset_requested`
- Trigger when: reset-password request API succeeds.
- Required properties: none
- Type: Intent/success

### `auth_password_updated`
- Trigger when: update-password API succeeds.
- Required properties: none
- Type: Success

### `auth_sign_out`
- Trigger when: sign-out action succeeds.
- Required properties: none
- Type: Context

### `auth_forgot_password_opened`
- Trigger when: forgot-password UI is opened.
- Required properties: none
- Type: Intent

### `auth_sign_in_validation_failed`
- Trigger when: sign-in blocked by client validation.
- Required properties: `reason`
- Type: Failure

### `auth_sign_in_failed`
- Trigger when: sign-in API call fails.
- Required properties: `code`
- Recommended properties: `error_message`
- Type: Failure

### `auth_sign_up_validation_failed`
- Trigger when: sign-up blocked by client validation.
- Required properties: `reason`
- Type: Failure

### `auth_sign_up_failed`
- Trigger when: sign-up API call fails.
- Required properties: `code`
- Recommended properties: `error_message`
- Type: Failure

### `auth_reset_password_validation_failed`
- Trigger when: reset-password blocked by client validation.
- Required properties: `reason`
- Type: Failure

### `auth_reset_password_failed`
- Trigger when: reset-password API call fails.
- Required properties: `code`
- Recommended properties: `error_message`
- Type: Failure

### `auth_update_password_validation_failed`
- Trigger when: update-password blocked by client validation.
- Required properties: `reason`
- Type: Failure

### `auth_update_password_failed`
- Trigger when: update-password API call fails.
- Required properties: `code`
- Recommended properties: `error_message`
- Type: Failure

## 3) Lobby / Matchmaking Events

### `lobby_game_selected`
- Trigger when: player selects a game card in lobby.
- Required properties: `game_type`
- Type: Intent

### `create_room_attempt`
- Trigger when: user clicks create room.
- Required properties: `game_type`, `has_custom_prompts`
- Recommended properties: `pack_id`, `grid_size`, `speed_mode`
- Type: Intent

### `room_created`
- Trigger when: server confirms room creation.
- Required properties: `room_code`, `game_type`
- Type: Success

### `invite_link_viewed`
- Trigger when: waiting room invite/share block is rendered.
- Required properties: `room_code`, `is_native_share_supported`
- Type: Intent/context

### `join_room_attempt`
- Trigger when: user submits a room code.
- Required properties: `room_code`
- Type: Intent

### `lobby_join_validation_failed`
- Trigger when: invalid room code format in lobby.
- Required properties: `reason`, `length`
- Type: Failure

### `room_joined`
- Trigger when: server confirms room join.
- Required properties: `room_code`, `game_type`, `skip_side_select`
- Type: Success

### `room_player_joined`
- Trigger when: second player presence is confirmed in room.
- Required properties: `room_code`, `game_type`, `skip_side_select`
- Type: Success/context

### `side_selected`
- Trigger when: player selects side.
- Required properties: `room_code`, `game_type`, `side`
- Type: Intent

### `room_error`
- Trigger when: room-level server error is received.
- Required properties: `message`
- Recommended properties: `error_code`, `room_code`, `game_type`
- Type: Failure

## 4) Gameplay and Outcome Events

### `game_started`
- Trigger when: server starts a match.
- Required properties: `room_code`, `game_type`, `is_host`
- Type: Success

### `match_ended`
- Trigger when: server sends final match result.
- Required properties: `room_code`, `game_type`
- Recommended properties: `winner`, `loser`, `is_winner`, `tie`, `points_earned`
- Type: Success/outcome

### `result_viewed`
- Trigger when: victory/result screen is rendered.
- Required properties: `game_type`, `result_outcome`, `bucin_category`
- Recommended properties: `points_earned`, `your_score`, `opp_score`
- Type: Success/outcome

### `share_clicked`
- Trigger when: user taps a share CTA (result share or invite share).
- Required properties: `share_platform`
- Recommended properties: `share_context`, `game_type`, `bucin_category`, `result_outcome`, `room_code`
- Type: Intent/viral

### `share_failed`
- Trigger when: share action fails due to unsupported API or runtime error.
- Required properties: `share_platform`, `error_code`
- Recommended properties: `share_context`, `game_type`, `bucin_category`, `result_outcome`, `room_code`
- Type: Failure/viral

### `tutorial_started` (planned)
- Trigger when: first-run tutorial begins.
- Required properties: `game_type`
- Recommended properties: `tutorial_version`, `entry_point`
- Type: Intent

### `tutorial_completed` (planned)
- Trigger when: first-run tutorial finishes.
- Required properties: `game_type`
- Recommended properties: `tutorial_version`, `time_taken`
- Type: Success

### `level_started` (planned)
- Trigger when: a level/round begins in a level-based mode.
- Required properties: `game_type`
- Recommended properties: `level_number`, `stage_name`, `difficulty`
- Type: Intent

### `level_completed` (planned)
- Trigger when: a level/round completes successfully.
- Required properties: `game_type`
- Recommended properties: `level_number`, `score`, `stars_earned`, `time_taken`
- Type: Success

### `level_failed` (planned)
- Trigger when: a level/round ends in failure.
- Required properties: `game_type`
- Recommended properties: `level_number`, `failure_reason`, `enemy_type`, `time_taken`
- Type: Failure

### `reward_claimed` (planned)
- Trigger when: player claims any in-game reward.
- Required properties: `reward_type`
- Recommended properties: `reward_id`, `reward_amount`, `currency_type`
- Type: Engagement/economy

### `rematch_requested`
- Trigger when: user requests rematch.
- Required properties: `room_code`, `game_type`
- Type: Intent/retention

### `achievement_unlocked`
- Trigger when: achievement unlock toast payload is received.
- Required properties: `count`
- Recommended properties: `ids`
- Type: Success/engagement

### `game_action_error`
- Trigger when: gameplay action fails.
- Required properties: `message`
- Recommended properties: `error_code`, `room_code`, `game_type`
- Type: Failure

## 5) Connectivity and Reliability Events

### `socket_connected`
- Trigger when: websocket connection established.
- Required properties: `room_code`, `in_game`
- Type: Reliability

### `socket_disconnected`
- Trigger when: websocket disconnects.
- Required properties: `reason`, `room_code`, `in_game`
- Type: Reliability/failure

### `socket_connect_error`
- Trigger when: websocket connection error occurs.
- Required properties: `message`
- Recommended properties: `error_code`
- Type: Reliability/failure

### `opponent_disconnected`
- Trigger when: opponent drops connection.
- Required properties: `reconnecting`, `room_code`, `in_game`
- Type: Reliability/failure

### `opponent_reconnected`
- Trigger when: opponent reconnect event arrives.
- Required properties: `room_code`
- Type: Reliability/success

### `opponent_reconnected_dismissed`
- Trigger when: reconnect overlay is dismissed after opponent reconnects.
- Required properties: `room_code`
- Type: Reliability/context

## QA / Pressure-Test Checklist

- Understanding test:
  - Ask one PM and one non-engineering teammate to explain 10 random events.
  - If event meaning is unclear without code context, rename or clarify description.
- Actionability test:
  - Can we explain at least one actionable decision from each failure event?
  - Can we segment success vs drop-off users using current properties?
- Integrity test:
  - Ensure no impossible funnels (e.g. `game_started` > `room_joined` in the same scope).
  - Verify required properties are present and correctly typed.

## Decisions Made Without Data (Ongoing)

Track these each month in a separate log:
- Decision
- Why we lacked data
- Missing event/property
- Owner and due date

This prevents data drift and keeps instrumentation aligned with product changes.
