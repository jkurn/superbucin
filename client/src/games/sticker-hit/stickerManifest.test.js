import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
  fetchStickerManifest,
  toBackendAssetUrl,
} from './stickerManifest.js';

describe('fetchStickerManifest', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns stickers on 200 JSON with array', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        stickers: [
          { src: '/stickers/a.webp', durationMs: 500 },
          { src: '/stickers/b.webp' },
        ],
      }),
    });

    const { stickers, error } = await fetchStickerManifest({
      backendOrigin: 'http://localhost:3000',
      fetchImpl: globalThis.fetch,
      timeoutMs: 2000,
    });
    assert.equal(error, null);
    assert.equal(stickers.length, 2);
    assert.equal(stickers[0].src, 'http://localhost:3000/stickers/a.webp');
    assert.equal(stickers[0].durationMs, 500);
    assert.ok(stickers[1].durationMs >= 200);
  });

  it('returns http error when response not ok', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const { stickers, error } = await fetchStickerManifest({
      backendOrigin: 'http://localhost:3000',
      fetchImpl: globalThis.fetch,
    });
    assert.equal(error, 'http');
    assert.equal(stickers.length, 0);
  });

  it('returns parse error when stickers is not an array', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ stickers: null }),
    });
    const { error } = await fetchStickerManifest({
      backendOrigin: 'http://localhost:3000',
      fetchImpl: globalThis.fetch,
    });
    assert.equal(error, 'parse');
  });

  it('returns timeout on AbortError', async () => {
    globalThis.fetch = (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
    const { stickers, error } = await fetchStickerManifest({
      backendOrigin: 'http://localhost:3000',
      fetchImpl: globalThis.fetch,
      timeoutMs: 5,
    });
    assert.equal(error, 'timeout');
    assert.equal(stickers.length, 0);
  });

  it('returns network on generic throw', async () => {
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    const { error } = await fetchStickerManifest({
      backendOrigin: 'http://localhost:3000',
      fetchImpl: globalThis.fetch,
    });
    assert.equal(error, 'network');
  });

  it('uses default timeout constant', () => {
    assert.ok(DEFAULT_STICKER_MANIFEST_TIMEOUT_MS >= 1000);
  });
});

describe('toBackendAssetUrl', () => {
  it('joins origin and path', () => {
    assert.equal(toBackendAssetUrl('/x.png', 'https://ex.com'), 'https://ex.com/x.png');
  });
});
