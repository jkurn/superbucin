import { getPackListForClient } from './packs.js';

export const MEMORY_MATCH_CONFIG = {
  GAME_TYPE: 'memory-match',
  /** Used by GameFactory.skipSideSelect */
  SKIP_SIDE_SELECT: true,
  /** Flip-back delay after a mismatch (ms) */
  MISMATCH_MS: 900,
  DEFAULT_PACK: 'nickname',
  /** 4 = 4×4 (8 pairs), 6 = 6×6 (18 pairs) */
  DEFAULT_GRID: 4,
  SPEED_MODE_DEFAULT: false,
  packList: getPackListForClient(),
};

export function getClientConfig(roomOptions = {}) {
  return {
    gameType: MEMORY_MATCH_CONFIG.GAME_TYPE,
    skipSideSelect: true,
    mismatchMs: MEMORY_MATCH_CONFIG.MISMATCH_MS,
    defaultPack: roomOptions.packId || MEMORY_MATCH_CONFIG.DEFAULT_PACK,
    defaultGrid: roomOptions.gridSize || MEMORY_MATCH_CONFIG.DEFAULT_GRID,
    speedMode: roomOptions.speedMode ?? MEMORY_MATCH_CONFIG.SPEED_MODE_DEFAULT,
    packs: MEMORY_MATCH_CONFIG.packList,
  };
}
