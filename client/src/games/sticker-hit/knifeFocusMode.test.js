import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isStickerHitKnifeFocusMode } from './knifeFocusMode.js';

/** Tiny in-memory Storage stand-in for tests. */
function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
}

describe('knifeFocusMode', () => {
  it('is false without query', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '' }, makeStorage()), false);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?game=sticker-hit' }, makeStorage()), false);
  });

  it('is true for knifeFocus=1, true, yes', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=1' }, makeStorage()), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=true' }, makeStorage()), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=yes' }, makeStorage()), true);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?x=1&knifeFocus=1' }, makeStorage()), true);
  });

  it('is false for other unknown values when no session cache', () => {
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=' }, makeStorage()), false);
    assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=maybe' }, makeStorage()), false);
  });

  // Regression for QA ISSUE-001: Router strips ?knifeFocus=1 on `/` → `/room/{code}`.
  // The first call with the flag in URL must persist it so subsequent calls
  // (after navigation, with empty search) still return true.
  describe('session persistence (QA ISSUE-001 regression)', () => {
    it('persists across calls when set once via query string', () => {
      const storage = makeStorage();
      assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=1' }, storage), true);
      // Subsequent navigation strips the query — flag should still apply.
      assert.equal(isStickerHitKnifeFocusMode({ search: '' }, storage), true);
      assert.equal(isStickerHitKnifeFocusMode({ search: '?other=1' }, storage), true);
    });

    it('clears persisted flag when knifeFocus=0 / false / no is passed', () => {
      const storage = makeStorage({ stickerHitKnifeFocus: '1' });
      assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=0' }, storage), false);
      assert.equal(isStickerHitKnifeFocusMode({ search: '' }, storage), false);
      // Verify storage was actually cleared so a refresh stays off.
      assert.equal(storage.getItem('stickerHitKnifeFocus'), null);
    });

    it('respects pre-existing session cache when no query present', () => {
      const storage = makeStorage({ stickerHitKnifeFocus: '1' });
      assert.equal(isStickerHitKnifeFocusMode({ search: '' }, storage), true);
    });

    it('survives a noop unknown query value', () => {
      const storage = makeStorage({ stickerHitKnifeFocus: '1' });
      // Unknown value should not toggle the cache.
      assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=maybe' }, storage), true);
    });

    it('handles missing storage gracefully', () => {
      // Should fall back to URL-only behaviour.
      assert.equal(isStickerHitKnifeFocusMode({ search: '?knifeFocus=1' }, null), true);
      assert.equal(isStickerHitKnifeFocusMode({ search: '' }, null), false);
    });
  });
});
