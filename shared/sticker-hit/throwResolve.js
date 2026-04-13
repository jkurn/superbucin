import { angularDistanceDeg } from './stageLayoutInvariants.js';
import { normalizeDeg, targetRotationDeg } from './timeline.js';

/**
 * Heading in degrees (0 = +X …) of the rim tangent vector used by the client bounce VFX:
 * `(-cos θ, sin θ)` in disc-local XY when the impact sits at angle θ° on the rim.
 */
export function reboundHeadingDegFromImpact(impactAngleDeg) {
  const ir = ((Number(impactAngleDeg) || 0) * Math.PI) / 180;
  const rad = Math.atan2(Math.sin(ir), -Math.cos(ir));
  return normalizeDeg((rad * 180) / Math.PI);
}

/**
 * Collision against rim obstacles + stuck stickers (shared server/client rules).
 * @param {number} impactAngleDeg
 * @param {{ angle: number, kind?: string }[]} obstacleStickers
 * @param {{ angle: number }[]} stuckStickers
 * @param {{ COLLISION_DEGREES: number, SPIKE_EXTRA_DEGREES?: number }} cfg
 */
export function collidesOccupiedStickerHit(impactAngleDeg, obstacleStickers, stuckStickers, cfg) {
  const col = cfg.COLLISION_DEGREES;
  const spikeExtra = cfg.SPIKE_EXTRA_DEGREES ?? 0;
  for (const o of obstacleStickers || []) {
    const th = o.kind === 'spike' ? col + spikeExtra : col;
    if (angularDistanceDeg(o.angle, impactAngleDeg) < th) return true;
  }
  for (const s of stuckStickers || []) {
    if (angularDistanceDeg(s.angle, impactAngleDeg) < col) return true;
  }
  return false;
}

/**
 * @param {{ angle: number }[]} ringApples
 * @param {number} impactAngleDeg
 * @param {{ APPLE_HIT_DEGREES: number }} cfg
 * @returns {number} index or -1
 */
export function findRingAppleHitIndex(ringApples, impactAngleDeg, cfg) {
  const th = cfg.APPLE_HIT_DEGREES;
  for (let i = 0; i < (ringApples || []).length; i += 1) {
    if (angularDistanceDeg(ringApples[i].angle, impactAngleDeg) < th) return i;
  }
  return -1;
}

/**
 * Rim impact angle (degrees) at server time `atMs` for the rotating disc.
 */
export function impactAngleAtServerTime(timeline, atMs) {
  const rot = targetRotationDeg(timeline, atMs);
  return normalizeDeg(270 - rot);
}

/**
 * Resolve throw vs rotating rim: by default only **landing** is checked for occupied arc
 * (knife-hit timing). With `THROW_CHECK_PATH_COLLISION: true`, also samples along flight;
 * first occupied sample wins (crash). Apple is evaluated only at final landing if no crash.
 *
 * @param {{
 *   timeline: import('./timeline.js').Timeline,
 *   nowMs: number,
 *   flightMs: number,
 *   obstacleStickers: object[],
 *   stuckStickers: object[],
 *   ringApples: { angle: number }[],
 *   cfg: { THROW_CHECK_PATH_COLLISION?: boolean } & object,
 *   sampleCount?: number,
 * }} opts
 */
export function resolveThrowAgainstDisc(opts) {
  const {
    timeline,
    nowMs,
    flightMs,
    obstacleStickers,
    stuckStickers,
    ringApples,
    cfg,
    sampleCount: rawN,
  } = opts;

  const sampleCount = Math.max(2, Math.floor(Number(rawN) || 12));
  const ms = Math.max(0, Number(flightMs) || 0);
  const checkPath = cfg.THROW_CHECK_PATH_COLLISION === true;

  if (checkPath) {
    for (let i = 1; i <= sampleCount; i += 1) {
      const tMs = nowMs + (ms * i) / sampleCount;
      const impactAngle = impactAngleAtServerTime(timeline, tMs);
      if (collidesOccupiedStickerHit(impactAngle, obstacleStickers, stuckStickers, cfg)) {
        return { crash: true, impactAngle, appleIdx: -1 };
      }
    }
  }

  const finalMs = nowMs + ms;
  const impactAngle = impactAngleAtServerTime(timeline, finalMs);
  if (collidesOccupiedStickerHit(impactAngle, obstacleStickers, stuckStickers, cfg)) {
    return { crash: true, impactAngle, appleIdx: -1 };
  }

  const appleIdx = findRingAppleHitIndex(ringApples, impactAngle, cfg);
  return { crash: false, impactAngle, appleIdx };
}
