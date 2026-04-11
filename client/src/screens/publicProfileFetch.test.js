import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicProfile, DEFAULT_PUBLIC_PROFILE_TIMEOUT_MS } from './publicProfileFetch.js';

describe('fetchPublicProfile', () => {
  it('returns ok with data on 200 JSON with profile', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        profile: { username: 'x', display_name: 'X', avatar_url: '', bio: '', points: 1 },
        stats: [],
        achievements: [],
      }),
    });
    const r = await fetchPublicProfile('x', { fetchImpl, timeoutMs: 5000 });
    assert.equal(r.ok, true);
    assert.equal(r.data.profile.username, 'x');
  });

  it('returns http kind when response not ok', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const r = await fetchPublicProfile('missing', { fetchImpl });
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'http');
    assert.equal(r.status, 404);
  });

  it('returns timeout when request aborts', async () => {
    const fetchImpl = (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
    const r = await fetchPublicProfile('slow', { fetchImpl, timeoutMs: 20 });
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'timeout');
  });

  it('returns network on thrown fetch', async () => {
    const fetchImpl = async () => {
      throw new Error('offline');
    };
    const r = await fetchPublicProfile('x', { fetchImpl });
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'network');
  });

  it('returns parse when JSON ok but missing profile', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ stats: [] }),
    });
    const r = await fetchPublicProfile('x', { fetchImpl });
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'parse');
  });

  it('exports a sensible default timeout', () => {
    assert.ok(DEFAULT_PUBLIC_PROFILE_TIMEOUT_MS >= 5000);
  });
});
