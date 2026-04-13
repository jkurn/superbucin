/**
 * Sticker Hit — acceptance criteria & backlog (server).
 *
 * "Passing" blocks lock current product definitions; backlog items graduate here when implemented.
 */

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_HIT_GAME_CONFIG as CFG } from '../../../shared/sticker-hit/gameConfig.js';
import { buildExpandedStageDefinitions } from '../../../shared/sticker-hit/marathonStages.js';
import { reboundHeadingDegFromImpact, resolveThrowAgainstDisc } from '../../../shared/sticker-hit/throwResolve.js';
import { normalizeDeg, targetRotationDeg } from '../../../shared/sticker-hit/timeline.js';
import { GameState } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'p1' };
  const p2 = { id: 'p2', side: 'p2' };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, p1, p2, events };
}

function startPlaying(game) {
  let countdownCb = null;
  const oldSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (cb) => {
    countdownCb = cb;
    return 1;
  };
  try {
    game.start();
    assert.ok(countdownCb);
    countdownCb();
    assert.equal(game.phase, 'playing');
  } finally {
    globalThis.setTimeout = oldSetTimeout;
  }
}

describe('Sticker Hit acceptance — config contracts (Done)', () => {
  it('AC US09 (fixed ladder): exactly five stages; final index is boss with harder counts', () => {
    assert.equal(CFG.STAGES.length, 5);
    assert.equal(CFG.STAGES[4].isBoss, true);
    assert.ok(CFG.STAGES[4].stickersToLand >= CFG.STAGES[3].stickersToLand);
    assert.ok((CFG.STAGES[4].spikes || 0) >= (CFG.STAGES[3].spikes || 0));
  });

  it('AC US04 (partial): spike hazard uses wider angular threshold than knife', () => {
    assert.ok(Number.isFinite(CFG.SPIKE_EXTRA_DEGREES));
    assert.ok(CFG.SPIKE_EXTRA_DEGREES > 0);
    assert.ok(CFG.COLLISION_DEGREES > 0);
  });

  it('AC US01 (partial): throw flight duration is bounded for client/server agreement', () => {
    assert.ok(CFG.THROW_FLIGHT_MS > 0);
    assert.ok(CFG.THROW_FLIGHT_MAX_MS >= CFG.THROW_FLIGHT_MS);
  });

  it('AC US12–13: ring apple spawn count is bounded per config', () => {
    assert.ok(CFG.APPLES_MIN >= 0);
    assert.ok(CFG.APPLES_MAX >= CFG.APPLES_MIN);
  });
});

describe('Sticker Hit acceptance — runtime invariants after start (Done)', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('AC US12–13: each player stage has APPLES_MIN..APPLES_MAX ring apples after countdown', () => {
    const { game, p1 } = createGame();
    currentGame = game;
    startPlaying(game);
    for (const pid of [p1.id, 'p2']) {
      const n = game.stateByPlayer[pid].stage.ringApples.length;
      assert.ok(n >= CFG.APPLES_MIN && n <= CFG.APPLES_MAX, `ring apples for ${pid}`);
    }
  });

  it('AC US07: obstacle slots match stage recipe (knives + spikes)', () => {
    const { game, p1 } = createGame();
    currentGame = game;
    startPlaying(game);
    const stage = game.stateByPlayer[p1.id].stage;
    const cfg = game.stageDefinitions[stage.stageIndex];
    const wantKnife = cfg.obstacles || 0;
    const wantSpike = cfg.spikes || 0;
    const knives = stage.obstacleStickers.filter((o) => o.kind === 'knife').length;
    const spikes = stage.obstacleStickers.filter((o) => o.kind === 'spike').length;
    assert.equal(knives, wantKnife);
    assert.equal(spikes, wantSpike);
  });
});

describe('Sticker Hit acceptance — US01 knife-hit throw (Done)', () => {
  it('default config uses landing-only collision (rim at impact)', () => {
    assert.equal(CFG.THROW_CHECK_PATH_COLLISION, false);
  });

  it('path collision optional: mid-arc hit when THROW_CHECK_PATH_COLLISION true', () => {
    const nowMs = 2000;
    const timeline = {
      startedAt: nowMs,
      initialAngle: 0,
      segments: [{ atMs: 0, dps: 360 }],
    };
    const flightMs = 1000;
    const finalOnlyClear = normalizeDeg(270 - targetRotationDeg(timeline, nowMs + flightMs));
    const resolved = resolveThrowAgainstDisc({
      timeline,
      nowMs,
      flightMs,
      obstacleStickers: [{ angle: 180, kind: 'knife' }],
      stuckStickers: [],
      ringApples: [],
      cfg: { ...CFG, THROW_CHECK_PATH_COLLISION: true },
      sampleCount: 4,
    });
    assert.equal(resolved.crash, true);
    assert.equal(resolved.impactAngle, 180);
    assert.equal(finalOnlyClear, 270);
  });
});

describe('Sticker Hit acceptance — US04 crash payload (Done)', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('throwFx crash includes reboundTangentDeg for client debris alignment', () => {
    const { game, p1 } = createGame();
    currentGame = game;
    startPlaying(game);
    const ps = game.stateByPlayer[p1.id];
    ps.stage = {
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
    const fx = ps.throwFx;
    assert.equal(fx?.type, 'crash');
    assert.equal(typeof fx?.impactAngle, 'number');
    assert.equal(fx?.reboundTangentDeg, reboundHeadingDegFromImpact(fx.impactAngle));
  });
});

describe('Sticker Hit acceptance — US09 marathon ladder (Done)', () => {
  it('expanded ladder marks boss every fifth index and scales with rounds', () => {
    const twoRounds = buildExpandedStageDefinitions({ ...CFG, MARATHON_ROUNDS: 2 });
    assert.equal(twoRounds.length, CFG.STAGES.length * 2);
    for (let i = 0; i < twoRounds.length; i += 1) {
      assert.equal(twoRounds[i].isBoss, i % 5 === 4);
    }
    assert.ok(twoRounds[5].stickersToLand >= CFG.STAGES[0].stickersToLand);
  });
});
