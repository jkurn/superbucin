import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DoodleGuessGameState, DOODLE_GAME_CONFIG } from './GameState.js';

function createGame(options = {}) {
  const events = [];
  const p1 = { id: 'p1', side: 'drawer' };
  const p2 = { id: 'p2', side: 'guesser' };
  const emit = (event, data) => events.push({ event, data });
  const game = new DoodleGuessGameState(p1, p2, emit, options);
  return { game, p1, p2, events };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

describe('Doodle Guess GameState', () => {
  let currentGame;
  let originalSetTimeout;

  beforeEach(() => {
    originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => (typeof cb === 'function' ? 1 : 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts game, builds prompt queue, and emits personalized state', () => {
    const { game, events, p1, p2 } = createGame({ customPrompts: ['Sun', 'Moon'] });
    currentGame = game;

    game.start();
    game.stopTimers();

    assert.equal(game.active, true);
    assert.equal(game.phase, 'drawing');
    assert.equal(game.promptQueue.length, DOODLE_GAME_CONFIG.TOTAL_ROUNDS);
    const state = lastEvent(events, 'doodle-state');
    assert.ok(state.byPlayer[p1.id]);
    assert.equal(state.byPlayer[p1.id].youAreDrawer, true);
    assert.equal(state.byPlayer[p2.id].youAreDrawer, false);
    assert.equal(typeof state.byPlayer[p1.id].prompt, 'string');
    assert.equal(state.byPlayer[p2.id].prompt, null);
  });

  it('supports custom-only fallback and migration of socket score', () => {
    const { game } = createGame({ doodlePackId: 'custom', customPrompts: [] });
    currentGame = game;

    game.start();
    game.stopTimers();
    assert.equal(game.promptQueue.length, DOODLE_GAME_CONFIG.TOTAL_ROUNDS);

    game.scores.p1 = 12;
    game.migrateSocketId('p1', 'p1-new');
    assert.equal(game.scores['p1-new'], 12);
    assert.equal(game.scores.p1, undefined);
  });

  it('appendStroke and clearCanvas are drawer-authorized only', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'drawing';
    game.drawer = p1;
    game.guesser = p2;

    game.appendStroke(p2.id, { x: 1, y: 2 });
    assert.equal(game.strokeHistory.length, 0);

    game.appendStroke(p1.id, { x: 1, y: 2 });
    assert.equal(game.strokeHistory.length, 1);
    assert.ok(lastEvent(events, 'doodle-draw'));

    game.clearCanvas(p2.id);
    assert.equal(game.strokeHistory.length, 1);
    game.clearCanvas(p1.id);
    assert.equal(game.strokeHistory.length, 0);
    assert.ok(lastEvent(events, 'doodle-clear'));
  });

  it('caps stroke history and returns guesser-only history', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'drawing';
    game.drawer = p1;
    game.guesser = p2;
    for (let i = 0; i < 900; i += 1) {
      game.appendStroke(p1.id, { x: i, y: i });
    }
    assert.equal(game.strokeHistory.length, 800);
    assert.equal(game.getStrokeHistoryFor(p1.id).length, 0);
    assert.equal(game.getStrokeHistoryFor(p2.id).length, 800);
  });

  it('handles wrong and correct guesses with scoring', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'drawing';
    game.drawer = p1;
    game.guesser = p2;
    game.currentPrompt = 'Coffee';
    game.roundEndsAt = Date.now() + DOODLE_GAME_CONFIG.ROUND_TIME_MS;

    game.submitGuess(p2.id, 'tea');
    const wrong = lastEvent(events, 'doodle-guess-wrong');
    assert.ok(wrong);

    game.submitGuess(p2.id, 'Coffee');
    const state = lastEvent(events, 'doodle-state');
    assert.equal(state.byPlayer[p2.id].phase, 'round_result');
    assert.equal(state.byPlayer[p2.id].lastResult.correct, true);
    assert.equal(game.scores[p2.id] > 0, true);
  });

  it('endRound and finishMatch emit timeout result and match-end', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'drawing';
    game.currentPrompt = 'Sunset';
    game.roundIndex = DOODLE_GAME_CONFIG.TOTAL_ROUNDS - 1;
    game.drawer = p1;
    game.guesser = p2;
    game.scores[p1.id] = 10;
    game.scores[p2.id] = 4;

    game.endRound(true);
    game.advanceRound();

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p1.id);
    assert.equal(end.tie, false);
  });
});
