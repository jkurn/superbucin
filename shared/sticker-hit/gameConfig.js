/**
 * Single source of truth for Sticker Hit tuning (server + GameFactory + client defaults).
 */

export const STICKER_HIT_GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  COUNTDOWN_MS: 2500,
  TICK_MS: 100,
  COLLISION_DEGREES: 14,
  STAGES: [
    { stickersToLand: 6, obstacles: 1, minDps: 60, maxDps: 120 },
    { stickersToLand: 7, obstacles: 2, minDps: 70, maxDps: 150 },
    { stickersToLand: 8, obstacles: 3, minDps: 85, maxDps: 180 },
  ],
  MIN_SEGMENT_MS: 550,
  MAX_SEGMENT_MS: 1400,
  TIMELINE_WINDOW_MS: 60_000,
};
