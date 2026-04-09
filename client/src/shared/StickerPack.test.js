import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordMatchResult } from './StickerPack.js';

describe('StickerPack recordMatchResult', () => {
  let store;

  beforeEach(() => {
    store = Object.create(null);
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('clears loss streak in localStorage on win', () => {
    store.superbucin_loss_streak = '4';
    recordMatchResult(true);
    assert.equal('superbucin_loss_streak' in store, false);
  });

  it('increments loss streak on loss', () => {
    recordMatchResult(false);
    assert.equal(store.superbucin_loss_streak, '1');
    recordMatchResult(false);
    assert.equal(store.superbucin_loss_streak, '2');
  });
});
