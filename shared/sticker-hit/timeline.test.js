import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDeg, targetRotationDeg } from './timeline.js';

test('normalizeDeg wraps negatives and >360', () => {
  assert.equal(normalizeDeg(0), 0);
  assert.equal(normalizeDeg(360), 0);
  assert.equal(normalizeDeg(-90), 270);
  assert.equal(normalizeDeg(450), 90);
});

test('targetRotationDeg integrates constant dps over one segment', () => {
  const timeline = {
    startedAt: 1000,
    initialAngle: 0,
    segments: [
      { atMs: 0, dps: 360 },
      { atMs: 1000, dps: 0 },
    ],
  };
  assert.equal(targetRotationDeg(timeline, 1000), 0);
  assert.equal(targetRotationDeg(timeline, 1500), 180);
});
