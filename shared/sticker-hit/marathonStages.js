/**
 * Expand base STAGES into a longer ladder (multiple 5-stage cycles) with mild scaling.
 * Boss cadence: every 5th global stage index (0-based: 4, 9, 14, …) sets isBoss true (scaled recipe still derived from the repeating STAGES template).
 *
 * @param {typeof import('./gameConfig.js').STICKER_HIT_GAME_CONFIG} cfg
 * @returns {import('./gameConfig.js').STICKER_HIT_GAME_CONFIG['STAGES']}
 */
export function buildExpandedStageDefinitions(cfg) {
  const base = cfg.STAGES || [];
  if (!base.length) return [];
  const rounds = Math.max(1, Math.floor(Number(cfg.MARATHON_ROUNDS) || 1));
  const out = [];
  for (let r = 0; r < rounds; r += 1) {
    for (let i = 0; i < base.length; i += 1) {
      const src = base[i];
      const bump = r * 2;
      const globalIdx = r * base.length + i;
      out.push({
        ...src,
        isBoss: globalIdx % 5 === 4,
        stickersToLand: Math.min(26, (src.stickersToLand || 0) + bump),
        obstacles: Math.min(7, (src.obstacles || 0) + Math.min(2, r)),
        spikes: Math.min(5, (src.spikes || 0) + Math.floor(r / 2)),
        minDps: Math.min(210, (src.minDps || 0) + r * 5),
        maxDps: Math.min(250, (src.maxDps || 0) + r * 7),
      });
    }
  }
  return out;
}
