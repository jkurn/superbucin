import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLobbyDeepLinkSearch } from './lobbyDeepLink.js';

describe('parseLobbyDeepLinkSearch', () => {
  it('returns nulls for empty search', () => {
    assert.deepEqual(parseLobbyDeepLinkSearch(''), { challenge: null, raw_game: null });
    assert.deepEqual(parseLobbyDeepLinkSearch('?'), { challenge: null, raw_game: null });
  });

  it('parses challenge and game', () => {
    const r = parseLobbyDeepLinkSearch('?challenge=Bucin%20Akut&game=pig-vs-chick');
    assert.equal(r.challenge, 'Bucin Akut');
    assert.equal(r.raw_game, 'pig-vs-chick');
  });

  it('trims and truncates long challenge', () => {
    const long = 'x'.repeat(200);
    const r = parseLobbyDeepLinkSearch(`?challenge=${encodeURIComponent(long)}`);
    assert.equal(r.challenge.length, 120);
    assert.equal(r.raw_game, null);
  });

  it('treats blank game as null', () => {
    const r = parseLobbyDeepLinkSearch('?game=  &challenge=hi');
    assert.equal(r.raw_game, null);
    assert.equal(r.challenge, 'hi');
  });
});
