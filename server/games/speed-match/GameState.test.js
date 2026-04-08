import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

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

describe('Speed Match GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts in countdown and emits speed-match-state', () => {
    const { game, events } = createGame();
    currentGame = game;

    game.start();
    game.clearTimers();

    assert.equal(game.active, true);
    assert.equal(game.phase, 'countdown');
    const state = lastEvent(events, 'speed-match-state');
    assert.ok(state);
    assert.equal(state.phase, 'countdown');
  });

  it('handles answer submission and reveal scoring for matched answers', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.questions = [{ text: 'Q', options: ['A', 'B'], isBonus: false }];
    game.currentIndex = 0;
    game.phase = 'question';

    game.handleAction(p1.id, { type: 'answer', answer: 1 });
    game.handleAction(p2.id, { type: 'answer', answer: 1 });
    game.clearTimers();

    assert.equal(game.phase, 'reveal');
    assert.equal(game.scores[p1.id], GAME_CONFIG.MATCH_POINTS);
    assert.equal(game.scores[p2.id], GAME_CONFIG.MATCH_POINTS);
    const state = lastEvent(events, 'speed-match-state');
    assert.equal(state.pointsEarned, GAME_CONFIG.MATCH_POINTS);
  });

  it('rejects invalid answers, duplicate submit, and unknown players', () => {
    const { game, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.questions = [{ text: 'Q', options: ['A', 'B'], isBonus: true }];
    game.currentIndex = 0;
    game.phase = 'question';

    game.submitAnswer('stranger', 0);
    game.submitAnswer(p1.id, -1);
    game.submitAnswer(p1.id, 99);
    assert.equal(game.answers[p1.id], null);

    game.submitAnswer(p1.id, 1);
    game.submitAnswer(p1.id, 0);
    assert.equal(game.answers[p1.id], 1);
  });

  it('tick transitions to reveal when timer expires', () => {
    const { game } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: 'Q', options: ['A', 'B'], isBonus: false }];
    game.currentIndex = 0;
    game.timerEndsAt = Date.now() - 1;

    game.tick();
    assert.equal(game.phase, 'reveal');
  });

  it('pause and resume preserve question timer', () => {
    const { game } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: 'Q', options: ['A', 'B'], isBonus: false }];
    game.currentIndex = 0;
    game.timerEndsAt = Date.now() + 5000;

    game.pause();
    assert.equal(game.pauseOffsetMs > 0, true);

    game.resume();
    assert.equal(game.timerEndsAt > Date.now(), true);
  });

  it('resume handles reveal/countdown branches and finish emits match-end', () => {
    const { game, events, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'reveal';
    game.resume();
    game.clearTimers();

    game.phase = 'countdown';
    game.resume();
    game.clearTimers();

    game.scores[p1.id] = 22;
    game.currentIndex = 999;
    game.questions = [];
    game.startQuestion();

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p1.id);
  });
});
