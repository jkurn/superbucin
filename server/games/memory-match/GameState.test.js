import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryMatchGameState } from './GameState.js';

function createGame(options = {}) {
  const events = [];
  const p1 = { id: 'p1', side: 'left' };
  const p2 = { id: 'p2', side: 'right' };
  const emit = (event, data) => events.push({ event, data });
  const game = new MemoryMatchGameState(p1, p2, emit, options);
  return { game, p1, p2, events };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

describe('Memory Match GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts with initialized board and emits state', () => {
    const { game, events, p1 } = createGame({ gridSize: 4 });
    currentGame = game;

    game.start();
    game.stop();

    assert.equal(game.active, false);
    assert.equal(game.slots.length, 16);
    const payload = lastEvent(events, 'memory-state');
    assert.ok(payload);
    assert.equal(payload.p1.youAreHost, true);
    assert.equal(payload.p2.youAreHost, false);
    assert.equal(payload.p1.currentTurn, p1.id);
  });

  it('ignores invalid flips and non-turn player actions', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.active = true;
    game.slots = [{ pairId: 'a', face: 'A' }, { pairId: 'a', face: 'B' }];
    game.currentTurn = p1.id;

    game.tryFlip(p2.id, 0);
    game.tryFlip(p1.id, -1);
    game.tryFlip(p1.id, 99);
    game.tryFlip(p1.id, 0);
    game.tryFlip(p1.id, 0);

    assert.deepEqual(game.selection, [0]);
  });

  it('scores matches and ends game when all slots are matched', () => {
    const { game, events, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.slots = [{ pairId: 'a', face: 'A1' }, { pairId: 'a', face: 'A2' }];
    game.currentTurn = p1.id;

    game.tryFlip(p1.id, 0);
    game.tryFlip(p1.id, 1);

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p1.id);
    assert.equal(end.tie, false);
    assert.equal(end.scores[0], 1);
  });

  it('mismatch clears selection and hands turn over', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    let pendingCb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => {
      pendingCb = cb;
      return 1;
    };
    try {
      game.active = true;
      game.slots = [
        { pairId: 'a', face: 'A1' },
        { pairId: 'b', face: 'B1' },
      ];
      game.currentTurn = p1.id;

      game.tryFlip(p1.id, 0);
      game.tryFlip(p1.id, 1);
      assert.equal(game.pendingTimer, 1);
      assert.deepEqual(game.selection, [0, 1]);

      pendingCb();
      assert.equal(game.pendingTimer, null);
      assert.deepEqual(game.selection, []);
      assert.equal(game.currentTurn, p2.id);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('fuzz: each started board has every pairId exactly twice (playable invariant)', () => {
    const iterations = 50;
    for (let n = 0; n < iterations; n += 1) {
      for (const gridSize of [4, 6]) {
        const { game } = createGame({ gridSize });
        currentGame = game;
        try {
          game.start();
          const expected = gridSize * gridSize;
          assert.equal(game.slots.length, expected, `iter ${n} grid ${gridSize}`);
          const counts = {};
          for (const slot of game.slots) {
            assert.ok(Object.prototype.hasOwnProperty.call(slot, 'pairId'), `pairId set iter ${n}`);
            counts[slot.pairId] = (counts[slot.pairId] || 0) + 1;
          }
          for (const c of Object.values(counts)) {
            assert.equal(c, 2, `pair multiplicity iter ${n} grid ${gridSize}`);
          }
        } finally {
          game.stop();
          currentGame = null;
        }
      }
    }
  });

  it('pause and resume manage speed mode timer safely', () => {
    const { game } = createGame({ speedMode: true });
    currentGame = game;

    let intervalCb = null;
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = (cb) => {
      intervalCb = cb;
      return 123;
    };
    const originalClearInterval = globalThis.clearInterval;
    globalThis.clearInterval = () => {};
    try {
      game.start();
      assert.equal(game.speedTimer, 123);

      game.pause();
      assert.equal(game.speedTimer, null);

      game.resume();
      assert.equal(game.speedTimer, 123);
      assert.ok(intervalCb);
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });

  it('getReconnectPayload returns socket-specific view', () => {
    const { game, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.slots = [{ pairId: 'a', face: 'A1' }, { pairId: 'a', face: 'A2' }];
    game.matched.add(0);
    game.selection = [1];

    const payload = game.getReconnectPayload(p1.id);
    assert.ok(payload.memory);
    assert.equal(payload.memory.slots[0].state, 'matched');
    assert.equal(payload.memory.slots[1].state, 'faceup');
  });
});
