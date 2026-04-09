import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameRegistry } from './GameRegistry.js';

describe('GameRegistry', () => {
  beforeEach(() => {
    GameRegistry.__clearForTests();
  });

  afterEach(() => {
    GameRegistry.__clearForTests();
  });

  it('register, has, get, and list round-trip', () => {
    assert.equal(GameRegistry.has('g1'), false);
    assert.equal(GameRegistry.get('g1'), null);

    GameRegistry.register('g1', {
      lobby: { name: 'One', icon: '1', badge: 'A' },
    });

    assert.equal(GameRegistry.has('g1'), true);
    assert.equal(GameRegistry.get('g1').lobby.name, 'One');

    const listed = GameRegistry.list();
    assert.ok(listed.some((g) => g.type === 'g1' && g.name === 'One'));
  });
});
