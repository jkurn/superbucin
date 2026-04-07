import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

function createGame(roomOptions = {}) {
  const events = [];
  const p1 = { id: 'p1', side: 'left', socket: null };
  const p2 = { id: 'p2', side: 'right', socket: null };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit, roomOptions);
  return { game, events, p1, p2 };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

function singleQuestionGame() {
  return createGame({
    customQuestions: [
      {
        q: '2 + 2 = ?',
        a: ['3', '4', '5', '6'],
        correct: 1,
        category: 'math',
      },
    ],
  });
}

describe('Quiz Race GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts in countdown and emits initial state update', () => {
    const { game, events } = createGame();
    currentGame = game;

    game.start();
    game.clearTimers();

    assert.equal(game.phase, 'countdown');
    const state = lastEvent(events, 'state-update');
    assert.ok(state);
    assert.equal(state.gameType, 'quiz-race');
    assert.equal(state.phase, 'countdown');
  });

  it('accepts valid answers and scores first correct player with speed bonus', () => {
    const { game, p1, p2 } = singleQuestionGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1, category: 'math' }];
    game.currentIndex = 0;

    const originalNow = Date.now;
    let now = 1_000;
    Date.now = () => now;
    try {
      game.submitAnswer(p1.id, 1); // correct first
      now = 2_000;
      game.submitAnswer(p2.id, 1); // correct second
    } finally {
      Date.now = originalNow;
    }
    game.clearTimers();

    assert.equal(game.phase, 'reveal');
    assert.equal(game.scores[p1.id], GAME_CONFIG.POINTS_CORRECT + GAME_CONFIG.POINTS_SPEED_BONUS);
    assert.equal(game.scores[p2.id], GAME_CONFIG.POINTS_CORRECT);
  });

  it('rejects malformed/out-of-range answers and unknown players', () => {
    const { game, p1 } = singleQuestionGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1, category: 'math' }];
    game.currentIndex = 0;

    game.submitAnswer('intruder', 1);
    game.submitAnswer(p1.id, -1);
    game.submitAnswer(p1.id, 99);

    assert.equal(game.answers[p1.id], null);
  });

  it('prevents duplicate answer submit from same player', () => {
    const { game, p1 } = singleQuestionGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1, category: 'math' }];
    game.currentIndex = 0;

    game.submitAnswer(p1.id, 1);
    game.submitAnswer(p1.id, 0); // ignored (already answered)

    assert.equal(game.answers[p1.id], 1);
  });

  it('hides correct answer in question phase and reveals it in reveal phase', () => {
    const { game, events, p1, p2 } = singleQuestionGame();
    currentGame = game;

    game.active = true;
    game.phase = 'question';
    game.questions = [{ text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1, category: 'math' }];
    game.currentIndex = 0;

    game.broadcastState();
    const questionState = lastEvent(events, 'state-update');
    assert.equal(questionState.correct, -1);

    game.submitAnswer(p1.id, 1);
    game.submitAnswer(p2.id, 0);
    game.clearTimers();
    const revealState = lastEvent(events, 'state-update');
    assert.equal(revealState.phase, 'reveal');
    assert.equal(revealState.correct, 1);
  });

  it('emits match-end with winner when round completes', () => {
    const { game, events, p1, p2 } = singleQuestionGame();
    currentGame = game;

    game.active = true;
    game.questions = [{ text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correct: 1, category: 'math' }];
    game.currentIndex = 0;
    game.phase = 'question';

    game.submitAnswer(p1.id, 1); // p1 correct
    game.submitAnswer(p2.id, 0); // p2 wrong => reveal
    game.clearTimers();
    game.currentIndex = 1; // end of round
    game.startQuestion();

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p1.id);
    assert.equal(end.tie, false);
    assert.equal(end.scores[0] > end.scores[1], true);
  });

  it('migrates score/answer maps on reconnect identity swap', () => {
    const { game, p1 } = singleQuestionGame();
    currentGame = game;

    game.scores[p1.id] = 20;
    game.answers[p1.id] = 1;
    game.answerTimes[p1.id] = 1234;

    game.migratePlayer(p1.id, 'p1-new', { id: 'p1-new', side: p1.side });

    assert.equal(game.scores['p1-new'], 20);
    assert.equal(game.answers['p1-new'], 1);
    assert.equal(game.answerTimes['p1-new'], 1234);
    assert.equal(game.scores[p1.id], undefined);
  });
});
