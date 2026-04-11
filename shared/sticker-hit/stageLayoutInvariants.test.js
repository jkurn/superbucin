import assert from 'node:assert/strict';
import test from 'node:test';
import { STICKER_HIT_GAME_CONFIG } from './gameConfig.js';
import {
  angularDistanceDeg,
  validateStickerHitStageLayout,
} from './stageLayoutInvariants.js';

test('angularDistanceDeg is symmetric and handles wrap', () => {
  assert.equal(angularDistanceDeg(0, 180), 180);
  assert.equal(angularDistanceDeg(350, 10), 20);
  assert.equal(angularDistanceDeg(10, 350), 20);
});

test('validateStickerHitStageLayout passes empty obstacles and apples', () => {
  assert.deepEqual(
    validateStickerHitStageLayout({ obstacleStickers: [], ringApples: [] }),
    [],
  );
});

test('validateStickerHitStageLayout flags apple overlapping obstacle', () => {
  const cfg = STICKER_HIT_GAME_CONFIG;
  const errs = validateStickerHitStageLayout(
    {
      obstacleStickers: [{ angle: 0, kind: 'knife' }],
      ringApples: [{ angle: 0.5, id: 1 }],
    },
    cfg,
  );
  assert.ok(errs.some((e) => e.includes('apple 0 vs obstacle')));
});

test('validateStickerHitStageLayout flags two apples too close', () => {
  const errs = validateStickerHitStageLayout(
    {
      obstacleStickers: [],
      ringApples: [{ angle: 0, id: 1 }, { angle: 1, id: 2 }],
    },
    STICKER_HIT_GAME_CONFIG,
  );
  assert.ok(errs.some((e) => e.includes('apple 0 vs apple 1')));
});

test('validateStickerHitStageLayout flags obstacles under min gap', () => {
  const errs = validateStickerHitStageLayout(
    {
      obstacleStickers: [
        { angle: 0, kind: 'knife' },
        { angle: 10, kind: 'knife' },
      ],
      ringApples: [],
    },
    STICKER_HIT_GAME_CONFIG,
  );
  assert.ok(errs.some((e) => e.includes('obstacle 0 vs 1')));
});
