/**
 * Sticker Hit — acceptance criteria & backlog (server).
 *
 * "Passing" blocks lock current product definitions.
 * `describe.skip` blocks are executable specs for partial/missing work — unskip when implementing.
 */

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_HIT_GAME_CONFIG as CFG } from '../../../shared/sticker-hit/gameConfig.js';
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
    const cfg = CFG.STAGES[stage.stageIndex];
    const wantKnife = cfg.obstacles || 0;
    const wantSpike = cfg.spikes || 0;
    const knives = stage.obstacleStickers.filter((o) => o.kind === 'knife').length;
    const spikes = stage.obstacleStickers.filter((o) => o.kind === 'spike').length;
    assert.equal(knives, wantKnife);
    assert.equal(spikes, wantSpike);
  });
});

describe.skip('BACKLOG — AC: US01 server-simulated ballistic flight (Missing)', () => {
  it('resolves stick/crash only after sampling occupied arc along projectile path (multi-step)', () => {
    assert.fail('Unskip when server simulates flight path; assert segment hits or continuous sweep.');
  });
});

describe.skip('BACKLOG — AC: US04 server-authoritative rebound knife (Missing)', () => {
  it('emits rebound trajectory or rest state so client is not sole source of bounce truth', () => {
    assert.fail('Unskip when server models bounce; assert throwFx or state includes rebound payload.');
  });
});

describe.skip('BACKLOG — AC: US09 infinite marathon boss cadence (Missing)', () => {
  it('every fifth stage index (0-based: 4,9,14,…) is boss tier with scaled difficulty', () => {
    assert.fail('Unskip when STAGES becomes infinite or generated; assert boss predicate on indices.');
  });
});
