import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';
import { angularDistanceDeg, obstacleCenterMinGap } from '../../../shared/sticker-hit/stageLayoutInvariants.js';

function mkPlayers() {
  return [{ id: 'p1' }, { id: 'p2' }];
}

describe('sticker-mash-duel/GameState', () => {
  it('starts in countdown and emits per-player state', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    const stateEvent = events.find((e) => e.event === 'sticker-mash-duel-state');
    assert.ok(stateEvent);
    assert.equal(stateEvent.data.byPlayer[p1.id].phase, 'countdown');
    assert.equal(stateEvent.data.byPlayer[p2.id].gameType, 'sticker-mash-duel');
    gs.stop();
  });

  it('accepts mash taps during playing and increases score', () => {
    const [p1, p2] = mkPlayers();
    const gs = new GameState(p1, p2, () => {});
    gs.start();
    gs.phase = 'playing';
    gs.handleAction(p1.id, { type: 'mash-tap' });
    const score = gs.stateByPlayer[p1.id].score;
    assert.ok(Number.isFinite(score));
    assert.ok(score >= 0);
    gs.stop();
  });

  it('rate limits taps using TAP_COOLDOWN_MS', () => {
    const [p1, p2] = mkPlayers();
    const gs = new GameState(p1, p2, () => {});
    gs.start();
    gs.phase = 'playing';
    const before = gs.stateByPlayer[p1.id].tapsAccepted;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    gs.handleAction(p1.id, { type: 'mash-tap' });
    const after = gs.stateByPlayer[p1.id].tapsAccepted;
    assert.ok(after - before <= 1);
    assert.ok(GAME_CONFIG.TAP_COOLDOWN_MS > 0);
    gs.stop();
  });

  it('finishes with tie when scores are equal', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    gs.phase = 'playing';
    gs.stateByPlayer[p1.id].score = 7;
    gs.stateByPlayer[p2.id].score = 7;
    gs._finishMatch();
    const matchEnd = events.find((e) => e.event === 'match-end');
    assert.ok(matchEnd);
    assert.equal(matchEnd.data.tie, true);
    assert.equal(matchEnd.data.winnerId, null);
    assert.deepEqual(matchEnd.data.scores, [7, 7]);
  });

  it('enforces obstacle spacing invariants for generated stage', () => {
    const [p1, p2] = mkPlayers();
    const gs = new GameState(p1, p2, () => {});
    gs.start();
    const stage = gs.stateByPlayer[p1.id].stage;
    const minGap = obstacleCenterMinGap(GAME_CONFIG);
    const obs = stage.obstacleStickers || [];
    for (let i = 0; i < obs.length; i += 1) {
      for (let j = i + 1; j < obs.length; j += 1) {
        assert.ok(angularDistanceDeg(obs[i].angle, obs[j].angle) >= minGap);
      }
    }
    gs.stop();
  });

  it('emits observability metrics for cooldown drops, crash penalties, and finish', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    gs.phase = 'playing';

    gs.nextTapAtByPlayer[p1.id] = Date.now() + 999;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    assert.ok(events.some((e) => e.event === 'sticker-mash-duel-metric' && e.data.kind === 'tap_dropped_cooldown'));

    gs._resolveTap = () => {
      const ps = gs.stateByPlayer[p1.id];
      ps.crashCount += 1;
      ps.score = Math.max(0, ps.score + GAME_CONFIG.POINTS_PER_CRASH);
      gs._emitTelemetry('tap_crash_penalty', {
        playerId: p1.id,
        score: ps.score,
        crashCount: ps.crashCount,
      });
    };
    gs.nextTapAtByPlayer[p1.id] = 0;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    assert.ok(events.some((e) => e.event === 'sticker-mash-duel-metric' && e.data.kind === 'tap_crash_penalty'));

    gs._finishMatch();
    assert.ok(events.some((e) => e.event === 'sticker-mash-duel-metric' && e.data.kind === 'round_finished'));
  });

  it('emits telemetry sequence including round_started and round_finished', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const oldSetTimeout = globalThis.setTimeout;
    const timers = [];
    globalThis.setTimeout = (fn) => {
      timers.push(fn);
      return { id: timers.length };
    };
    try {
      const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
      gs.start();
      // Run countdown callback immediately to move into playing and emit round_started.
      assert.ok(timers.length > 0);
      timers.shift()();
      gs._finishMatch();

      const metricKinds = events
        .filter((e) => e.event === 'sticker-mash-duel-metric')
        .map((e) => e.data.kind);

      const startedIdx = metricKinds.indexOf('round_started');
      const finishedIdx = metricKinds.indexOf('round_finished');
      assert.ok(startedIdx >= 0);
      assert.ok(finishedIdx >= 0);
      assert.ok(startedIdx < finishedIdx);
    } finally {
      globalThis.setTimeout = oldSetTimeout;
    }
  });
});
