import { STICKER_HIT_GAME_CONFIG } from './gameConfig.js';

/** Bank cap per profile row (anti-grief / sanity). */
export const STICKER_HIT_MAX_BANKED_APPLES = 9999;

/**
 * Normalizes persisted or inbound progress against shop skin ids and boss rules.
 * @param {unknown} raw
 * @param {typeof STICKER_HIT_GAME_CONFIG} [cfg]
 */
export function sanitizeStickerHitProgress(raw, cfg = STICKER_HIT_GAME_CONFIG) {
  const shopIds = new Set((cfg.SKINS || []).map((s) => s.id));

  let apples = Math.floor(Number(raw?.apples));
  if (!Number.isFinite(apples) || apples < 0) apples = 0;
  apples = Math.min(apples, STICKER_HIT_MAX_BANKED_APPLES);

  const ownedIn = Array.isArray(raw?.ownedSkinIds) ? raw.ownedSkinIds : [];
  const ownedSkinIds = [...new Set(ownedIn.filter((id) => typeof id === 'string' && shopIds.has(id)))];

  const bossSkinUnlocked = !!raw?.bossSkinUnlocked;

  let equippedSkinId = raw?.equippedSkinId;
  if (equippedSkinId !== null && equippedSkinId !== undefined && equippedSkinId !== '') {
    if (typeof equippedSkinId !== 'string') {
      equippedSkinId = null;
    } else if (equippedSkinId === 'boss_glow') {
      if (!bossSkinUnlocked) equippedSkinId = null;
    } else if (!ownedSkinIds.includes(equippedSkinId)) {
      equippedSkinId = null;
    }
  } else {
    equippedSkinId = null;
  }

  return {
    apples,
    ownedSkinIds,
    equippedSkinId,
    bossSkinUnlocked,
  };
}

/** Snapshot from live GameState player slice for match-end persistence. */
export function stickerHitPersistShapeFromPlayerState(ps) {
  if (!ps || typeof ps !== 'object') {
    return sanitizeStickerHitProgress({}, STICKER_HIT_GAME_CONFIG);
  }
  return sanitizeStickerHitProgress(
    {
      apples: ps.apples,
      ownedSkinIds: ps.ownedSkinIds,
      equippedSkinId: ps.equippedSkinId,
      bossSkinUnlocked: ps.bossSkinUnlocked,
    },
    STICKER_HIT_GAME_CONFIG,
  );
}
