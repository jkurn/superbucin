/**
 * Virus vs Virus — Super Bucin Edition!
 * Match container: 3 rotating mini-games, first to WIN_SCORE round wins.
 *
 * Mini-games:
 *   mash   — Virus Inflater: tug-of-war tapping, push the line to opponent's side
 *   color  — Speed Color Match: tap opponent dots to flip, blunder penalty on own dots
 *   memory — Virus Counting: count displayed viruses, answer question first
 *
 * Ready handshake: both players hold READY simultaneously. 3-2-1-GO countdown
 * only ticks while both are holding. Release resets the countdown.
 */
export const CUTE_AGGRESSION_CONFIG = {
  GAME_TYPE: 'cute-aggression',
  SKIP_SIDE_SELECT: false,

  /** First player to reach this score wins the match */
  WIN_SCORE: 3,

  /** Roulette spin display duration (ms) */
  ROULETTE_MS: 3000,

  /** Countdown hold duration before mini-game starts (ms) */
  COUNTDOWN_MS: 3000,

  /** Ready phase tick interval for checking countdown (ms) */
  READY_TICK_MS: 100,

  /** Pause after mini-game result before roulette (ms) */
  MINI_RESULT_MS: 2500,

  // ── Mash (Virus Inflater / Tug-of-War) ────────────────
  /** Offset increment per tap */
  MASH_TAP_VALUE: 1,
  /** Absolute offset threshold to win */
  MASH_WIN_THRESHOLD: 50,
  /** Time-limit fallback (ms) — whoever has more offset wins */
  MASH_TIME_LIMIT_MS: 20000,

  // ── Color Match (Speed Color Match) ────────────────────
  /** Number of dots on the track */
  COLOR_DOT_COUNT: 5,
  /** Time-limit fallback (ms) — whoever has more dots wins */
  COLOR_TIME_LIMIT_MS: 30000,

  // ── Memory (Virus Counting) ────────────────────────────
  /** Total viruses in the display sequence */
  MEMORY_TOTAL_VIRUSES: 10,
  /** Time between each virus appearing (ms) */
  MEMORY_DISPLAY_INTERVAL_MS: 800,
  /** Pause after display before showing prompt (ms) */
  MEMORY_PAUSE_MS: 1000,
  /** Time limit for answering after prompt appears (ms) */
  MEMORY_ANSWER_TIME_MS: 10000,
  /** Number of answer options shown */
  MEMORY_OPTION_COUNT: 4,

  /** Character definitions — virus personas */
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
  void serverConfig;
}
