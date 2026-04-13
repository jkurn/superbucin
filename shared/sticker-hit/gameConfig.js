/**
 * Single source of truth for Sticker Hit tuning (server + GameFactory + client defaults).
 *
 * **Knife-hit feel:** early stages use an empty rim (no pre-placed blades); you lose by
 * hitting your own stuck throws (and later, pre-placed hazards). Collisions are judged at
 * **landing only** by default (`THROW_CHECK_PATH_COLLISION: false`) like classic knife games.
 * Stages ladder to a boss tier with more blades + speed.
 * Apples: bonus pickups on the ring (server-side hit + currency this match).
 */

export const STICKER_HIT_GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  COUNTDOWN_MS: 2500,
  TICK_MS: 100,
  COLLISION_DEGREES: 12,
  /** Spikes use a wider danger arc than knives (same rule family, harder read). */
  SPIKE_EXTRA_DEGREES: 5,
  /** Angular radius to collect a ring apple with a throw. */
  APPLE_HIT_DEGREES: 20,
  APPLES_MIN: 1,
  APPLES_MAX: 2,
  /**
   * Match-scoped shop: spend apples for cosmetic ids (server deducts + tracks ownedSkinIds).
   * Boss glow is separate (bossSkinUnlocked); equip id `boss_glow` when unlocked.
   */
  SKINS: [
    { id: 'trail_pink', cost: 3, label: 'Pink trail' },
    { id: 'sparkle_blue', cost: 5, label: 'Blue sparkle' },
  ],
  /** Every 5th stage is boss (1-based); last configured stage is the boss run. */
  STAGES: [
    { stickersToLand: 7, obstacles: 0, spikes: 0, minDps: 26, maxDps: 68, isBoss: false },
    { stickersToLand: 8, obstacles: 0, spikes: 0, minDps: 32, maxDps: 78, isBoss: false },
    { stickersToLand: 8, obstacles: 1, spikes: 0, minDps: 40, maxDps: 92, isBoss: false },
    { stickersToLand: 9, obstacles: 2, spikes: 1, minDps: 48, maxDps: 112, isBoss: false },
    { stickersToLand: 12, obstacles: 3, spikes: 2, minDps: 58, maxDps: 158, isBoss: true },
  ],
  MIN_SEGMENT_MS: 550,
  MAX_SEGMENT_MS: 1400,
  TIMELINE_WINDOW_MS: 60_000,
  /** Client + server agree on throw duration; server resolves impact at `now + flightMs`. */
  THROW_FLIGHT_MS: 520,
  /** Upper bound for `throw-sticker` flightMs from clients (anti-spam / sanity). */
  THROW_FLIGHT_MAX_MS: 750,
  /**
   * When false (default): only the **rim slot at landing** can crash — classic knife-hit timing.
   * When true: sample occupied arc along flight (stricter / less “knife” feel).
   */
  THROW_CHECK_PATH_COLLISION: false,
  /**
   * How many full copies of STAGES to chain (1 = five-stage match).
   * Boss appears every 5th stage index (4, 9, 14, …) across the chain.
   */
  MARATHON_ROUNDS: 1,
  /** Used only when `THROW_CHECK_PATH_COLLISION` is true; server + client must match. */
  THROW_PATH_SAMPLES: 12,
  /** Subtle lateral wobble; keep near zero for a straight “knife line” read. */
  THROW_WOBBLE_X: 0.04,
  THROW_WOBBLE_Y: 0.08,
};
