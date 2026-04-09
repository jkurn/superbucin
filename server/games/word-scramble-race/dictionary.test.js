import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEnglishWord,
  __clearDictionaryCacheForTests,
} from './dictionary.js';

describe('isValidEnglishWord (dictionary API degradation)', () => {
  let origFetch;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    __clearDictionaryCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    __clearDictionaryCacheForTests();
  });

  it('rejects short or empty input without calling fetch', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: true };
    };
    assert.equal(await isValidEnglishWord('ab'), false);
    assert.equal(await isValidEnglishWord(''), false);
    assert.equal(calls, 0);
  });

  it('rejects non-alphabetic words without calling fetch', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: true };
    };
    assert.equal(await isValidEnglishWord('ab2'), false);
    assert.equal(calls, 0);
  });

  it('normalizes case/trim before lookup', async () => {
    let seenUrl;
    globalThis.fetch = async (url) => {
      seenUrl = url;
      return { ok: true };
    };
    assert.equal(await isValidEnglishWord('  CaR '), true);
    assert.ok(String(seenUrl).includes('/en/car'));
  });

  it('treats 2xx as valid and caches (single fetch for repeat)', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: true, status: 200 };
    };
    const w = 'validwordcache';
    assert.equal(await isValidEnglishWord(w), true);
    assert.equal(await isValidEnglishWord(w), true);
    assert.equal(calls, 1);
  });

  it('treats 404 as invalid and caches false', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    const w = 'zzznotdict999';
    assert.equal(await isValidEnglishWord(w), false);
    assert.equal(await isValidEnglishWord(w), false);
  });

  it('fail-opens on 5xx so rounds stay playable', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return { ok: false, status: 503 };
    };
    const w = 'failopenfivexx';
    assert.equal(await isValidEnglishWord(w), true);
    assert.equal(calls, 1);
    assert.equal(await isValidEnglishWord(w), true);
    assert.equal(calls, 1);
  });

  it('fail-opens on non-404 client errors (e.g. 429)', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    assert.equal(await isValidEnglishWord('ratelimitword'), true);
  });

  it('fail-opens when fetch throws (network / timeout path)', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const w = 'networkoutagex';
    assert.equal(await isValidEnglishWord(w), true);
    assert.equal(await isValidEnglishWord(w), true);
  });
});
