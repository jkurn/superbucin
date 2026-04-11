/**
 * Single source of truth for Sticker Hit tuning (server + GameFactory + client defaults).
 *
 * Stages 1–4 ladder difficulty; stage 5 (index 4) is boss: more stickers, spikes, faster band.
 * Apples: bonus pickups on the ring (server-side hit + currency this match).
 */

export const STICKER_HIT_GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  COUNTDOWN_MS: 2500,
  TICK_MS: 100,
  COLLISION_DEGREES: 14,
  /** Spikes use a wider danger arc than knives (same rule family, harder read). */
  SPIKE_EXTRA_DEGREES: 5,
  /** Angular radius to collect a ring apple with a throw. */
  APPLE_HIT_DEGREES: 20,
  APPLES_MIN: 1,
  APPLES_MAX: 2,
  /** Every 5th stage is boss (1-based); last configured stage is the boss run. */
  STAGES: [
    { stickersToLand: 6, obstacles: 1, spikes: 0, minDps: 55, maxDps: 115, isBoss: false },
    { stickersToLand: 7, obstacles: 2, spikes: 0, minDps: 62, maxDps: 128, isBoss: false },
    { stickersToLand: 8, obstacles: 2, spikes: 1, minDps: 70, maxDps: 145, isBoss: false },
    { stickersToLand: 9, obstacles: 3, spikes: 1, minDps: 78, maxDps: 160, isBoss: false },
    { stickersToLand: 12, obstacles: 4, spikes: 2, minDps: 88, maxDps: 195, isBoss: true },
  ],
  MIN_SEGMENT_MS: 550,
  MAX_SEGMENT_MS: 1400,
  TIMELINE_WINDOW_MS: 60_000,
};
