import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'p1' };
  const p2 = { id: 'p2', side: 'p2' };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, p1, p2, events };
}

function lastEvent(events, eventName) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].event === eventName) return events[i].data;
  }
  return null;
}

describe('Sticker Hit GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts in countdown and transitions to playing', () => {
    const { game } = createGame();
    currentGame = game;
    let countdownCb = null;

    const oldSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => {
      countdownCb = cb;
      return 1;
    };

    try {
      game.start();
      assert.equal(game.phase, 'countdown');
      assert.ok(countdownCb);

      countdownCb();
      assert.equal(game.phase, 'playing');
    } finally {
      globalThis.setTimeout = oldSetTimeout;
    }
  });

  it('lands sticker when no collision and decrements remaining', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };
    game.stateByPlayer[p2.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    game.handleAction(p1.id, { type: 'throw-sticker' });
    assert.equal(game.stateByPlayer[p1.id].stage.stickersRemaining, 1);
    assert.equal(game.stateByPlayer[p1.id].stage.stuckStickers.length, 1);
  });

  it('crash ends match and awards opponent win', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [{ angle: 270, stickerSeed: 1, kind: 'knife' }],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    game.handleAction(p1.id, { type: 'throw-sticker' });
    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p2.id);
    assert.equal(game.stateByPlayer[p1.id].crashed, true);
    assert.equal(game.phase, 'finished');
  });

  it('clearing stage advances to next stage', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].stageIndex = 0;
    game.stateByPlayer[p1.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 1,
      stickersRemaining: 1,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };
    game.stateByPlayer[p2.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 99,
      stickersRemaining: 99,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    game.handleAction(p1.id, { type: 'throw-sticker' });
    assert.equal(game.stateByPlayer[p1.id].finished, false);
    assert.equal(game.stateByPlayer[p1.id].stageIndex, 1);
    assert.equal(game.stateByPlayer[p1.id].stage.stickersTotal, GAME_CONFIG.STAGES[1].stickersToLand);
  });

  it('finishing final stage emits winner', () => {
    const { game, p1, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    const last = GAME_CONFIG.STAGES.length - 1;
    game.stateByPlayer[p1.id].stageIndex = last;
    game.stateByPlayer[p1.id].stage = {
      stageIndex: last,
      isBoss: !!GAME_CONFIG.STAGES[last]?.isBoss,
      stickersTotal: 1,
      stickersRemaining: 1,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    game.handleAction(p1.id, { type: 'throw-sticker' });
    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, p1.id);
    assert.equal(game.stateByPlayer[p1.id].finished, true);
  });

  it('collecting a ring apple increments apples and removes the apple', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].apples = 0;
    game.stateByPlayer[p1.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [],
      ringApples: [{ id: 1, angle: 270 }],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };
    game.stateByPlayer[p2.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 99,
      stickersRemaining: 99,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    game.handleAction(p1.id, { type: 'throw-sticker' });
    assert.equal(game.stateByPlayer[p1.id].apples, 1);
    assert.equal(game.stateByPlayer[p1.id].stage.ringApples.length, 0);
    assert.equal(game.stateByPlayer[p1.id].stage.stuckStickers.length, 1);
    assert.equal(game.stateByPlayer[p1.id].stage.stickersRemaining, 1);
  });

  it('spike obstacles use a wider collision arc than knives', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [{ angle: 0, stickerSeed: 1, kind: 'spike' }],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };
    game.stateByPlayer[p2.id].stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 99,
      stickersRemaining: 99,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline: {
        startedAt: Date.now(),
        initialAngle: 0,
        segments: [{ atMs: 0, dps: 0 }],
      },
    };

    const rot = 270 - 16;
    game.stateByPlayer[p1.id].stage.timeline = {
      startedAt: Date.now(),
      initialAngle: rot,
      segments: [{ atMs: 0, dps: 0 }],
    };
    game.handleAction(p1.id, { type: 'throw-sticker' });
    assert.equal(game.stateByPlayer[p1.id].crashed, true);
  });
});

