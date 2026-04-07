/**
 * Virus vs Virus — Super Bucin Edition!
 * Match container: 4 rotating mini-games, first to WIN_SCORE points wins.
 *
 * Mini-games:
 *   mash    — Virus Inflater: tap fast to grow your virus across the center
 *   reflex  — Quick Draw: tap only when the signal appears, false-start = lose
 *   pong    — Deflector: drag paddle to block the bouncing ball
 *   sorting — Gatekeeper: toggle gate to catch your color, block enemy color
 */
export const CUTE_AGGRESSION_CONFIG = {
  GAME_TYPE: 'cute-aggression',
  SKIP_SIDE_SELECT: false,

  /** Countdown before each mini-game (ms) */
  COUNTDOWN_MS: 3000,

  /** Pause after mini-game ends before next one (ms) */
  MINI_RESULT_MS: 2800,

  /** First player to reach this score wins the match */
  WIN_SCORE: 5,

  // ── Mash (Virus Inflater) ──────────────────────────────
  /** Scale added per tap */
  MASH_SCALE_PER_TAP: 0.014,
  /** Scale at which virus crosses the center line and wins */
  MASH_WIN_SCALE: 1.0,
  /** Time-limit fallback: whoever is bigger wins (ms) */
  MASH_TIME_LIMIT_MS: 25000,

  // ── Reflex (Quick Draw) ───────────────────────────────
  /** Random wait before signal fires (ms) */
  REFLEX_MIN_WAIT_MS: 2000,
  REFLEX_MAX_WAIT_MS: 7000,
  /** How long after signal before round times out (ms) */
  REFLEX_RESPONSE_WINDOW_MS: 5000,

  // ── Pong (Deflector) ──────────────────────────────────
  /** Ball speed magnitude per server tick */
  PONG_BALL_SPEED: 0.018,
  /** Max ball speed per tick (after speedups) */
  PONG_MAX_SPEED: 0.048,
  /** Paddle width as fraction of court width */
  PONG_PADDLE_WIDTH: 0.30,
  /** Physics tick interval (ms) */
  PONG_TICK_MS: 50,

  // ── Sorting (Gatekeeper) ──────────────────────────────
  /** How often a new virus spawns (ms) */
  SORTING_SPAWN_INTERVAL_MS: 1200,
  /** Travel time from spawn to gate (ms) */
  SORTING_TRAVEL_MS: 2800,
  /** Successful catches needed to win */
  SORTING_WIN_CATCHES: 10,
  /** Time-limit fallback (ms) */
  SORTING_TIME_LIMIT_MS: 60000,
  /** Arrival-check tick (ms) */
  SORTING_TICK_MS: 150,

  /** Character definitions — kept from Cute Aggression, now as virus personas */
  CHARACTERS: {
    merah: {
      name: 'Virus Merah',
      emoji: '\uD83E\uDDA0',       // 🦠
      color: '#ff4466',
      colorLight: '#ff8899',
      colorDark: '#cc2244',
      taunt: 'INFEKSI SEMUANYA!!',
    },
    biru: {
      name: 'Virus Biru',
      emoji: '\uD83E\uDDEC',       // 🧬
      color: '#4488ff',
      colorLight: '#88bbff',
      colorDark: '#2266dd',
      taunt: 'DOMINASI TOTAL!!',
    },
  },
};

export function applyServerConfig(serverConfig) {
  // No-op: client uses its own constants; server config is informational only.
  void serverConfig;
}
