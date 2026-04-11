import { STICKER_HIT_GAME_CONFIG } from './gameConfig.js';
import { normalizeDeg } from './timeline.js';

/** Shortest arc distance on the circle [0, 180]. */
export function angularDistanceDeg(a, b) {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(diff, 360 - diff);
}

/** Minimum center-to-center gap between obstacle slots (matches GameState._createStage). */
export function obstacleCenterMinGap(cfg = STICKER_HIT_GAME_CONFIG) {
  return cfg.COLLISION_DEGREES + cfg.SPIKE_EXTRA_DEGREES + 4;
}

/**
 * Minimum separation for ring apple centers vs obstacles and vs each other
 * (matches GameState.placeRingApples).
 */
export function ringAppleMinSeparation(cfg = STICKER_HIT_GAME_CONFIG) {
  return Math.max(
    cfg.COLLISION_DEGREES + cfg.SPIKE_EXTRA_DEGREES + 8,
    cfg.APPLE_HIT_DEGREES + 8,
  );
}

/**
 * Playability / layout checks for one generated stage.
 * @returns {string[]} violations (empty if layout matches placement rules)
 */
export function validateStickerHitStageLayout(stage, cfg = STICKER_HIT_GAME_CONFIG) {
  const errors = [];
  const obs = stage.obstacleStickers || [];
  const apples = stage.ringApples || [];
  const minSep = ringAppleMinSeparation(cfg);
  const minGapObs = obstacleCenterMinGap(cfg);

  for (let i = 0; i < obs.length; i += 1) {
    for (let j = i + 1; j < obs.length; j += 1) {
      const d = angularDistanceDeg(obs[i].angle, obs[j].angle);
      if (d < minGapObs) {
        errors.push(`obstacle ${i} vs ${j}: ${d.toFixed(2)}° < ${minGapObs}°`);
      }
    }
  }

  for (let i = 0; i < apples.length; i += 1) {
    for (const o of obs) {
      const d = angularDistanceDeg(apples[i].angle, o.angle);
      if (d < minSep) {
        errors.push(`apple ${i} vs obstacle: ${d.toFixed(2)}° < ${minSep}°`);
      }
    }
    for (let j = i + 1; j < apples.length; j += 1) {
      const d = angularDistanceDeg(apples[i].angle, apples[j].angle);
      if (d < minSep) {
        errors.push(`apple ${i} vs apple ${j}: ${d.toFixed(2)}° < ${minSep}°`);
      }
    }
  }

  return errors;
}
