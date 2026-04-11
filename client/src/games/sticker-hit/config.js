import { STICKER_HIT_GAME_CONFIG } from '../../../../shared/sticker-hit/gameConfig.js';

const clientStickerHitDefaults = { ...STICKER_HIT_GAME_CONFIG };
delete clientStickerHitDefaults.SKIP_SIDE_SELECT;

/** @type {typeof clientStickerHitDefaults} */
export let GAME_CONFIG = { ...clientStickerHitDefaults };

export function applyServerConfig(serverConfig) {
  if (!serverConfig) return;
  GAME_CONFIG = { ...GAME_CONFIG, ...serverConfig };
}
