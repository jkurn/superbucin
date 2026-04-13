import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStickerHitKnifeFocusMode } from './knifeFocusMode.js';

describe('knifeFocusMode', () => {
  it('is false without query', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '' }), false);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?game=sticker-hit' }), false);
  });

  it('is true for knifeFocus=1, true, yes', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=1' }), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=true' }), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=yes' }), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?x=1&knifeFocus=1' }), true);
  });

  it('is false for other values', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=0' }), false);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=' }), false);
  });
});
