/**
 * Authoritative allowlists for `GameState._buildView` → `sticker-hit-state` per-player slices.
 * Used by server tests to catch accidental new fields (privacy / contract drift).
 * When `_buildView` changes shape, update these arrays in the same commit.
 */

export const STICKER_HIT_STATE_VIEW_TOP_KEYS = [
  'gameType',
  'phase',
  'serverNow',
  'countdownMsRemaining',
  'totalStages',
  'collisionDegrees',
  'skins',
  'you',
  'opponent',
];

export const STICKER_HIT_STATE_VIEW_YOU_KEYS = [
  'crashed',
  'finished',
  'stageIndex',
  'apples',
  'bossSkinUnlocked',
  'stageBreakSeq',
  'throwFx',
  'throwFxSeq',
  'ownedSkinIds',
  'equippedSkinId',
  'stage',
];

/** Opponent slice omits throwFx / ownedSkinIds (no leaking your shop into their packet). */
export const STICKER_HIT_STATE_VIEW_OPPONENT_KEYS = [
  'crashed',
  'finished',
  'stageIndex',
  'apples',
  'bossSkinUnlocked',
  'stageBreakSeq',
  'equippedSkinId',
  'stage',
];

/** Ghost `opponent.stage` and full `you.stage` share this wire shape. */
export const STICKER_HIT_STATE_VIEW_STAGE_KEYS = [
  'stageIndex',
  'isBoss',
  'stickersTotal',
  'stickersRemaining',
  'obstacleStickers',
  'stuckStickers',
  'ringApples',
  'timeline',
];
