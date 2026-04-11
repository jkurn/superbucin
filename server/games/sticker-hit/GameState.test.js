import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateStickerHitStageLayout } from '../../../shared/sticker-hit/stageLayoutInvariants.js';
import { normalizeDeg } from '../../../shared/sticker-hit/timeline.js';
import {
  STICKER_HIT_STATE_VIEW_OPPONENT_KEYS,
  STICKER_HIT_STATE_VIEW_STAGE_KEYS,
  STICKER_HIT_STATE_VIEW_TOP_KEYS,
  STICKER_HIT_STATE_VIEW_YOU_KEYS,
} from '../../../shared/sticker-hit/stickerHitStateViewKeys.js';
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
    const fx = game.stateByPlayer[p1.id].throwFx;
    assert.equal(fx?.type, 'crash');
    assert.equal(fx?.reboundTangentDeg, normalizeDeg((fx?.impactAngle ?? 0) + 90));
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
    assert.equal(game.stateByPlayer[p1.id].stage.stickersTotal, game.stageDefinitions[1].stickersToLand);
  });

  it('finishing final stage emits winner', () => {
    const { game, p1, events } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    const last = game.stageDefinitions.length - 1;
    game.stateByPlayer[p1.id].stageIndex = last;
    game.stateByPlayer[p1.id].stage = {
      stageIndex: last,
      isBoss: !!game.stageDefinitions[last]?.isBoss,
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

  it('throwFx persists across repeated broadcastState (tick replay)', () => {
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
    const seq = game.stateByPlayer[p1.id].throwFx?.seq;
    assert.ok(seq);
    game.broadcastState();
    assert.equal(game.stateByPlayer[p1.id].throwFx?.seq, seq);
    assert.equal(game.stateByPlayer[p1.id].throwFx?.type, 'stick');
  });

  it('sticker-buy-skin deducts apples; sticker-equip-skin requires ownership', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';

    game.stateByPlayer[p1.id].apples = 10;
    game.stateByPlayer[p1.id].stage = {
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

    game.handleAction(p1.id, { type: 'sticker-buy-skin', skinId: 'trail_pink' });
    assert.equal(game.stateByPlayer[p1.id].apples, 7);
    assert.ok(game.stateByPlayer[p1.id].ownedSkinIds.includes('trail_pink'));

    game.handleAction(p1.id, { type: 'sticker-equip-skin', skinId: 'trail_pink' });
    assert.equal(game.stateByPlayer[p1.id].equippedSkinId, 'trail_pink');

    game.handleAction(p1.id, { type: 'sticker-equip-skin', skinId: 'sparkle_blue' });
    assert.equal(game.stateByPlayer[p1.id].equippedSkinId, 'trail_pink');
  });

  it('hydrates apples/skins from stickerHitHydration room option', () => {
    const p1 = { id: 'sock1', side: 'p1' };
    const p2 = { id: 'sock2', side: 'p2' };
    const hydro = {
      sock1: {
        apples: 11,
        ownedSkinIds: ['trail_pink'],
        equippedSkinId: 'trail_pink',
        bossSkinUnlocked: true,
      },
    };
    const game = new GameState(p1, p2, () => {}, { stickerHitHydration: hydro });
    currentGame = game;
    assert.equal(game.stateByPlayer.sock1.apples, 11);
    assert.deepEqual(game.stateByPlayer.sock1.ownedSkinIds, ['trail_pink']);
    assert.equal(game.stateByPlayer.sock1.equippedSkinId, 'trail_pink');
    assert.equal(game.stateByPlayer.sock1.bossSkinUnlocked, true);
    assert.equal(game.stateByPlayer.sock2.apples, 0);
  });

  it('match-end payload includes stickerHitPersist for both players', () => {
    const events = [];
    const p1 = { id: 'a1', side: 'p1' };
    const p2 = { id: 'a2', side: 'p2' };
    const game = new GameState(p1, p2, (event, data) => events.push({ event, data }), {});
    currentGame = game;
    game.active = true;
    game.stateByPlayer.a1.apples = 4;
    game.stateByPlayer.a1.ownedSkinIds = ['sparkle_blue'];
    game.stateByPlayer.a1.equippedSkinId = 'sparkle_blue';
    game.stateByPlayer.a1.bossSkinUnlocked = false;
    game._finishMatch(p2.id, false);
    const end = events.find((e) => e.event === 'match-end');
    assert.ok(end?.data?.stickerHitPersist);
    assert.equal(end.data.stickerHitPersist.a1.apples, 4);
    assert.ok(end.data.stickerHitPersist.a1.ownedSkinIds.includes('sparkle_blue'));
    assert.equal(end.data.stickerHitPersist.a2.apples, 0);
  });

  it('_buildView keys match sticker-hit public wire contract', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    game.active = true;
    game.phase = 'playing';
    const timeline = { startedAt: Date.now(), initialAngle: 0, segments: [{ atMs: 0, dps: 0 }] };
    const stage = {
      stageIndex: 0,
      isBoss: false,
      stickersTotal: 2,
      stickersRemaining: 2,
      obstacleStickers: [],
      ringApples: [],
      stuckStickers: [],
      timeline,
    };
    game.stateByPlayer[p1.id].stage = stage;
    game.stateByPlayer[p2.id].stage = { ...stage };
    const view = game._buildView(p1.id);
    assert.deepEqual(new Set(Object.keys(view)), new Set(STICKER_HIT_STATE_VIEW_TOP_KEYS));
    assert.deepEqual(new Set(Object.keys(view.you)), new Set(STICKER_HIT_STATE_VIEW_YOU_KEYS));
    assert.deepEqual(new Set(Object.keys(view.opponent)), new Set(STICKER_HIT_STATE_VIEW_OPPONENT_KEYS));
    assert.deepEqual(new Set(Object.keys(view.you.stage)), new Set(STICKER_HIT_STATE_VIEW_STAGE_KEYS));
    assert.deepEqual(new Set(Object.keys(view.opponent.stage)), new Set(STICKER_HIT_STATE_VIEW_STAGE_KEYS));
  });

  it('fuzz: _createStage layouts satisfy ring + obstacle angular invariants', () => {
    const { game } = createGame();
    currentGame = game;
    const createStage = game._createStage.bind(game);
    const iterations = 400;
    for (let n = 0; n < iterations; n += 1) {
      for (let stageIndex = 0; stageIndex < game.stageDefinitions.length; stageIndex += 1) {
        const stage = createStage(stageIndex);
        const violations = validateStickerHitStageLayout(stage, GAME_CONFIG);
        assert.deepEqual(
          violations,
          [],
          `iteration ${n} stage ${stageIndex}: ${violations.join('; ')}`,
        );
      }
    }
  });

  it('migrateReconnectSocket moves stateByPlayer entry to new socket id', () => {
    const { game, p1 } = createGame();
    currentGame = game;
    const oldId = p1.id;
    const newId = 'sock_after_rejoin';
    game.stateByPlayer[oldId].apples = 42;
    p1.id = newId;
    game.migrateReconnectSocket(oldId, newId);
    assert.equal(game.stateByPlayer[newId].apples, 42);
    assert.equal(game.stateByPlayer[oldId], undefined);
  });
});

