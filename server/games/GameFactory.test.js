import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameFactory } from './GameFactory.js';

class DummyGameState {
  constructor(p1, p2, emit, roomOptions) {
    this.p1 = p1;
    this.p2 = p2;
    this.emit = emit;
    this.roomOptions = roomOptions;
  }
}

const baseConfig = {
  SKIP_SIDE_SELECT: false,
  NUM_LANES: 5,
  LANE_HEIGHT: 10,
  PLAYER_HP: 100,
  MAX_ENERGY: 100,
  STARTING_ENERGY: 20,
  ENERGY_REGEN: 3,
  BASE_DAMAGE: [10, 8, 6, 4],
  UNITS: [{ tier: 1, hp: 10, atk: 2, speed: 1, cost: 1, attackRate: 1 }],
};

describe('GameFactory', () => {
  it('creates registered game instances and returns null for unknown type', () => {
    GameFactory.register('factory-test', DummyGameState, baseConfig);
    const p1 = { id: 'p1' };
    const p2 = { id: 'p2' };
    const game = GameFactory.create('factory-test', p1, p2, () => {}, { fast: true });
    assert.ok(game instanceof DummyGameState);
    assert.deepEqual(game.roomOptions, { fast: true });
    assert.equal(GameFactory.create('missing-game', p1, p2, () => {}), null);
  });

  it('skipSideSelect reflects registered config', () => {
    GameFactory.register('skip-yes', DummyGameState, { ...baseConfig, SKIP_SIDE_SELECT: true });
    GameFactory.register('skip-no', DummyGameState, { ...baseConfig, SKIP_SIDE_SELECT: false });
    assert.equal(GameFactory.skipSideSelect('skip-yes'), true);
    assert.equal(GameFactory.skipSideSelect('skip-no'), false);
    assert.equal(GameFactory.skipSideSelect('unknown'), false);
  });

  it('getConfig returns branch-specific shape for each supported game family', () => {
    GameFactory.register('memory-match', DummyGameState, { ...baseConfig, SKIP_SIDE_SELECT: true });
    GameFactory.register('vending-machine', DummyGameState, { ...baseConfig, SKIP_SIDE_SELECT: true });
    GameFactory.register('bonk-brawl', DummyGameState, {
      ...baseConfig,
      CHARACTERS: { bunny: { emoji: '🐰' } },
    });
    GameFactory.register('cute-aggression', DummyGameState, {
      ...baseConfig,
      CHARACTERS: { merah: { emoji: '🦠' } },
    });
    GameFactory.register('speed-match', DummyGameState, {
      ...baseConfig,
      QUESTIONS_PER_ROUND: 5,
      BONUS_QUESTIONS: 1,
      TIME_PER_QUESTION_MS: 10_000,
      MATCH_POINTS: 3,
      BONUS_MATCH_POINTS: 2,
      REVEAL_DURATION_MS: 1200,
      COUNTDOWN_MS: 3000,
    });
    GameFactory.register('othello', DummyGameState, {
      ...baseConfig,
      BOARD_SIZE: 8,
      TURN_TIME_MS: 10000,
      TURN_STICKERS: ['mochiHappy', 'mochiHeart'],
    });
    GameFactory.register('connect-four', DummyGameState, { ...baseConfig, ROWS: 6, COLS: 7 });
    GameFactory.register('quiz-race', DummyGameState, {
      ...baseConfig,
      QUESTIONS_PER_ROUND: 8,
      TIME_PER_QUESTION_MS: 9000,
    });
    GameFactory.register('battleship-mini', DummyGameState, {
      ...baseConfig,
      GRID_SIZE: 6,
      SHIPS: [3, 2, 2],
      TURN_TIME_MS: 20000,
      PLACEMENT_TIME_MS: 20000,
    });
    GameFactory.register('word-scramble-race', DummyGameState, {
      ...baseConfig,
      ROUND_DURATION_MS: 45000,
      NUM_ROUNDS: 3,
      MIN_WORD_LENGTH: 3,
      INTERMISSION_MS: 1500,
    });
    GameFactory.register('sticker-hit', DummyGameState, {
      ...baseConfig,
      COUNTDOWN_MS: 2500,
      TICK_MS: 100,
      COLLISION_DEGREES: 14,
      STAGES: [{ stickersToLand: 6, obstacles: 1 }],
    });
    GameFactory.register('doodle-guess', DummyGameState, {
      ...baseConfig,
      ROUND_TIME_MS: 45000,
      TOTAL_ROUNDS: 3,
      MAX_POINTS_PER_ROUND: 100,
      MIN_POINTS_CORRECT: 10,
    });
    GameFactory.register('pig-vs-chick', DummyGameState, baseConfig);

    const memory = GameFactory.getConfig('memory-match', {
      packId: 'animals',
      gridSize: 6,
      speedMode: true,
    });
    assert.equal(memory.skipSideSelect, true);
    assert.equal(memory.defaultPack, 'animals');
    assert.equal(memory.defaultGrid, 6);
    assert.equal(memory.speedMode, true);

    const vending = GameFactory.getConfig('vending-machine');
    assert.equal(vending.skipSideSelect, true);
    assert.equal(Array.isArray(vending.drinks), true);

    const bonk = GameFactory.getConfig('bonk-brawl');
    assert.deepEqual(bonk, { CHARACTERS: { bunny: { emoji: '🐰' } } });

    const cute = GameFactory.getConfig('cute-aggression');
    assert.deepEqual(cute, { CHARACTERS: { merah: { emoji: '🦠' } } });

    const speed = GameFactory.getConfig('speed-match');
    assert.equal(speed.QUESTIONS_PER_ROUND, 5);
    assert.equal(speed.BONUS_MATCH_POINTS, 2);

    const othello = GameFactory.getConfig('othello');
    assert.deepEqual(othello, {
      BOARD_SIZE: 8,
      TURN_TIME_MS: 10000,
      TURN_STICKERS: ['mochiHappy', 'mochiHeart'],
    });

    const c4 = GameFactory.getConfig('connect-four');
    assert.deepEqual(c4, { ROWS: 6, COLS: 7 });

    const quiz = GameFactory.getConfig('quiz-race');
    assert.equal(quiz.QUESTIONS_PER_ROUND, 8);

    const battleship = GameFactory.getConfig('battleship-mini');
    assert.deepEqual(battleship.SHIPS, [3, 2, 2]);

    const word = GameFactory.getConfig('word-scramble-race');
    assert.equal(word.MIN_WORD_LENGTH, 3);

    const sticker = GameFactory.getConfig('sticker-hit');
    assert.equal(sticker.COLLISION_DEGREES, 14);
    assert.equal(Array.isArray(sticker.STAGES), true);

    const doodle = GameFactory.getConfig('doodle-guess');
    assert.equal(typeof doodle.defaultPackId, 'string');
    assert.equal(Array.isArray(doodle.packs), true);

    const fallback = GameFactory.getConfig('pig-vs-chick');
    assert.equal(fallback.NUM_LANES, 5);
    assert.equal(Array.isArray(fallback.UNITS), true);
    assert.equal(fallback.UNITS[0].attackRate, 1);

    assert.equal(GameFactory.getConfig('nonexistent-game'), null);
  });

  it('has reflects registration state', () => {
    GameFactory.register('has-check-game', DummyGameState, baseConfig);
    assert.equal(GameFactory.has('has-check-game'), true);
    assert.equal(GameFactory.has('still-missing'), false);
  });
});

