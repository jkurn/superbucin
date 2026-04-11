import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_HIT_GAME_CONFIG as CFG } from './gameConfig.js';
import { normalizeDeg, targetRotationDeg } from './timeline.js';
import { findRingAppleHitIndex, reboundHeadingDegFromImpact, resolveThrowAgainstDisc } from './throwResolve.js';

describe('throwResolve', () => {
  it('reboundHeadingDegFromImpact matches client rim tangent (-cos θ, sin θ)', () => {
    assert.equal(reboundHeadingDegFromImpact(0), 180);
    assert.ok(Math.abs(reboundHeadingDegFromImpact(90) - 90) < 1e-9);
    assert.equal(reboundHeadingDegFromImpact(270), 270);
  });

  it('detects mid-flight crash that final-only sampling would miss', () => {
    const nowMs = 1000;
    const timeline = {
      startedAt: nowMs,
      initialAngle: 0,
      segments: [{ atMs: 0, dps: 360 }],
    };
    const flightMs = 1000;
    const finalOnly = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs));
    assert.equal(finalOnly, 270);

    const resolved = resolveThrowAgainstDisc({
      timeline,
      nowMs,
      flightMs,
      obstacleStickers: [{ angle: 180, kind: 'knife' }],
      stuckStickers: [],
      ringApples: [],
      cfg: CFG,
      sampleCount: 4,
    });
    assert.equal(resolved.crash, true);
    assert.equal(resolved.impactAngle, 180);
    assert.notEqual(finalOnly, resolved.impactAngle);
  });

  it('ring apple counts only at final impact when path is clear', () => {
    const nowMs = 5000;
    const timeline = {
      startedAt: nowMs,
      initialAngle: 0,
      segments: [{ atMs: 0, dps: 180 }],
    };
    const flightMs = 500;
    const ringApples = [{ angle: 225 }];
    const midImpact = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs / 2));
    const finalImpact = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs));
    assert.ok(findRingAppleHitIndex(ringApples, midImpact, CFG) >= 0, 'sanity: apple along mid path');
    assert.equal(findRingAppleHitIndex(ringApples, finalImpact, CFG), -1, 'sanity: no apple at final');

    const resolved = resolveThrowAgainstDisc({
      timeline,
      nowMs,
      flightMs,
      obstacleStickers: [],
      stuckStickers: [],
      ringApples,
      cfg: CFG,
      sampleCount: 8,
    });
    assert.equal(resolved.crash, false);
    assert.equal(resolved.appleIdx, -1);
  });

  it('no rotation: stick at obstacle-free rim angle', () => {
    const nowMs = 0;
    const timeline = { startedAt: 0, initialAngle: 0, segments: [{ atMs: 0, dps: 0 }] };
    const resolved = resolveThrowAgainstDisc({
      timeline,
      nowMs,
      flightMs: 400,
      obstacleStickers: [],
      stuckStickers: [],
      ringApples: [],
      cfg: CFG,
      sampleCount: 12,
    });
    assert.equal(resolved.crash, false);
    assert.equal(resolved.impactAngle, 270);
  });
});
