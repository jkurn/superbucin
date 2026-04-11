import assert from 'node:assert/strict';
import test from 'node:test';
import { STICKER_HIT_GAME_CONFIG } from './gameConfig.js';
import {
  sanitizeStickerHitProgress,
  stickerHitPersistShapeFromPlayerState,
} from './stickerHitProgress.js';

test('sanitizeStickerHitProgress defaults empty / invalid', () => {
  const a = sanitizeStickerHitProgress(null);
  assert.equal(a.apples, 0);
  assert.deepEqual(a.ownedSkinIds, []);
  assert.equal(a.equippedSkinId, null);
  assert.equal(a.bossSkinUnlocked, false);
});

test('sanitizeStickerHitProgress clamps apples and filters unknown skin ids', () => {
  const a = sanitizeStickerHitProgress({
    apples: 200_000,
    ownedSkinIds: ['trail_pink', 'nope', 'trail_pink'],
    equippedSkinId: 'trail_pink',
    bossSkinUnlocked: false,
  });
  assert.equal(a.apples, 9999);
  assert.deepEqual(a.ownedSkinIds, ['trail_pink']);
  assert.equal(a.equippedSkinId, 'trail_pink');
});

test('sanitizeStickerHitProgress strips boss_glow when not unlocked', () => {
  const a = sanitizeStickerHitProgress({
    apples: 1,
    ownedSkinIds: [],
    equippedSkinId: 'boss_glow',
    bossSkinUnlocked: false,
  });
  assert.equal(a.equippedSkinId, null);
});

test('sanitizeStickerHitProgress keeps boss_glow when unlocked', () => {
  const a = sanitizeStickerHitProgress({
    apples: 0,
    ownedSkinIds: [],
    equippedSkinId: 'boss_glow',
    bossSkinUnlocked: true,
  });
  assert.equal(a.equippedSkinId, 'boss_glow');
});

test('sanitizeStickerHitProgress strips equip if not owned', () => {
  const a = sanitizeStickerHitProgress({
    apples: 5,
    ownedSkinIds: [],
    equippedSkinId: 'sparkle_blue',
    bossSkinUnlocked: false,
  });
  assert.equal(a.equippedSkinId, null);
});

test('stickerHitPersistShapeFromPlayerState maps player state', () => {
  const a = stickerHitPersistShapeFromPlayerState({
    apples: 4,
    ownedSkinIds: ['trail_pink'],
    equippedSkinId: 'trail_pink',
    bossSkinUnlocked: true,
  });
  assert.equal(a.apples, 4);
  assert.ok(a.ownedSkinIds.includes('trail_pink'));
  assert.equal(a.equippedSkinId, 'trail_pink');
  assert.equal(a.bossSkinUnlocked, true);
});

test('sanitize uses custom cfg skin list', () => {
  const cfg = { ...STICKER_HIT_GAME_CONFIG, SKINS: [{ id: 'only_one', cost: 1, label: 'One' }] };
  const a = sanitizeStickerHitProgress({ ownedSkinIds: ['only_one', 'trail_pink'] }, cfg);
  assert.deepEqual(a.ownedSkinIds, ['only_one']);
});
