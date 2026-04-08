import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';
import { generateGrid, randomGridSize } from './gridUtils.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'left' };
  const p2 = { id: 'p2', side: 'right' };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, p1, p2, events };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

function hasWordPath(grid, word) {
  const target = word.toLowerCase();
  const rows = grid.length;
  const cols = grid[0].length;
  const dirs = [-1, 0, 1];
  const used = new Set();

  function dfs(r, c, idx) {
    if (grid[r][c].toLowerCase() !== target[idx]) return false;
    if (idx === target.length - 1) return true;
    const key = `${r},${c}`;
    used.add(key);
    for (const dr of dirs) {
      for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nKey = `${nr},${nc}`;
        if (used.has(nKey)) continue;
        if (dfs(nr, nc, idx + 1)) {
          used.delete(key);
          return true;
        }
      }
    }
    used.delete(key);
    return false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dfs(r, c, 0)) return true;
    }
  }
  return false;
}

describe('Word Scramble Race GameState', () => {
  let currentGame;
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts active round and emits state', () => {
    const { game, events } = createGame();
    currentGame = game;

    game.start();
    game.clearTimers();

    assert.equal(game.active, true);
    assert.equal(game.phase, 'playing');
    const state = lastEvent(events, 'word-scramble-state');
    assert.ok(state);
    assert.equal(state.phase, 'playing');
  });

  it('validates invalid path and minimum word length', async () => {
    const { game, p1, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';
    game.grid = [
      ['A', 'B'],
      ['C', 'D'],
    ];

    await game.submitWord(p1.id, [{ r: 9, c: 9 }]);
    const invalidPath = lastEvent(events, 'word-scramble-feedback');
    assert.equal(invalidPath.ok, false);

    await game.submitWord(p1.id, [{ r: 0, c: 0 }, { r: 0, c: 1 }]); // "ab"
    const shortWord = lastEvent(events, 'word-scramble-feedback');
    assert.equal(shortWord.ok, false);
    assert.ok(shortWord.message.includes('at least'));
  });

  it('rejects dictionary 404 miss and accepts valid dictionary word with scoring', async () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';
    game.grid = [
      ['C', 'A'],
      ['T', 'S'],
    ];

    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await game.submitWord(p1.id, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }]); // cat
    const miss = lastEvent(events, 'word-scramble-feedback');
    assert.equal(miss.ok, false);
    assert.equal(miss.message, 'Not in dictionary.');

    game.grid = [
      ['C', 'A'],
      ['R', 'S'],
    ];
    globalThis.fetch = async () => ({ ok: true });
    await game.submitWord(p1.id, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }]); // car
    const hit = lastEvent(events, 'word-scramble-feedback');
    assert.equal(hit.ok, true);
    assert.equal(hit.multiplier, 2);

    await game.submitWord(p2.id, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }]); // car by opponent
    const hit2 = lastEvent(events, 'word-scramble-feedback');
    assert.equal(hit2.ok, true);
    assert.equal(hit2.multiplier, 1);
  });

  it('accepts words when dictionary service is temporarily unreachable', async () => {
    const { game, p1, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';
    game.grid = [
      ['C', 'A'],
      ['R', 'S'],
    ];
    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    await game.submitWord(p1.id, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }]); // car
    const hit = lastEvent(events, 'word-scramble-feedback');
    assert.equal(hit.ok, true);
    assert.equal(hit.word, 'car');
  });

  it('rejects duplicate word by same player in same round', async () => {
    const { game, p1, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';
    game.grid = [
      ['D', 'O'],
      ['G', 'S'],
    ];
    globalThis.fetch = async () => ({ ok: true });

    const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }]; // dog
    await game.submitWord(p1.id, path);
    await game.submitWord(p1.id, path);

    const dup = lastEvent(events, 'word-scramble-feedback');
    assert.equal(dup.ok, false);
    assert.ok(dup.message.includes('already'));
  });

  it('tick/endRound/intermission advances rounds and then finishes match', () => {
    const { game, p1, events } = createGame();
    currentGame = game;

    let intermissionCb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => {
      intermissionCb = cb;
      return 1;
    };
    try {
      game.active = true;
      game.phase = 'playing';
      game.round = GAME_CONFIG.NUM_ROUNDS - 1;
      game.roundEndsAt = Date.now() - 1;
      game.tick();
      intermissionCb();
      assert.equal(game.round, GAME_CONFIG.NUM_ROUNDS);

      game.scores[p1.id] = 5;
      game.roundEndsAt = Date.now() - 1;
      game.tick();
      const end = lastEvent(events, 'match-end');
      assert.ok(end);
      assert.equal(end.winnerId, p1.id);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('pause/resume keeps playing timer and ignores invalid submitters', async () => {
    const { game, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.roundEndsAt = Date.now() + 4000;
    game.pause();
    assert.equal(game.pauseOffsetMs > 0, true);
    game.resume();
    assert.equal(game.roundEndsAt > Date.now(), true);

    await game.submitWord('intruder', [{ r: 0, c: 0 }]);
    await game.submitWord(p1.id, []);
  });

  it('randomGridSize only returns 4 or 6', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomGridSize();
      assert.ok(s === 4 || s === 6);
    }
  });

  it('4x4 and 6x6 grids always embed at least one guaranteed word path', () => {
    const expectedWords = ['love', 'heart', 'hug', 'kiss', 'smile', 'spark', 'bloom', 'sweet'];
    for (const size of [4, 6]) {
      for (let i = 0; i < 20; i++) {
        const grid = generateGrid(size);
        const found = expectedWords.some((w) => hasWordPath(grid, w));
        assert.equal(found, true, `Expected at least one guaranteed word in ${size}x${size} grid`);
      }
    }
  });
});
