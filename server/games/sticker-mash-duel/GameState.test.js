import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

function mkPlayers() {
  return [{ id: 'p1' }, { id: 'p2' }];
}

describe('sticker-mash-duel/GameState', () => {
  it('ROUND_MS is 30 seconds', () => {
    assert.equal(GAME_CONFIG.ROUND_MS, 30_000);
  });

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
    assert.equal(gs.stateByPlayer[p1.id].score, 1);
    assert.equal(gs.stateByPlayer[p1.id].stuckSeeds.length, 1);
    gs.stop();
  });

  it('stuckSeeds accumulate on each tap', () => {
    const [p1, p2] = mkPlayers();
    const gs = new GameState(p1, p2, () => {});
    gs.start();
    gs.phase = 'playing';
    // Bypass cooldown by resetting tap timer between taps
    gs.handleAction(p1.id, { type: 'mash-tap' });
    gs.nextTapAtByPlayer[p1.id] = 0;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    gs.nextTapAtByPlayer[p1.id] = 0;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    assert.equal(gs.stateByPlayer[p1.id].stuckSeeds.length, 3);
    assert.equal(gs.stateByPlayer[p1.id].score, 3);
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

  it('view includes roundTotalMs', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    const stateEvent = events.find((e) => e.event === 'sticker-mash-duel-state');
    assert.equal(stateEvent.data.byPlayer[p1.id].roundTotalMs, 30_000);
    gs.stop();
  });

  it('view includes stuckSeeds for each player', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    gs.phase = 'playing';
    gs.handleAction(p1.id, { type: 'mash-tap' });
    const stateEvent = events.filter((e) => e.event === 'sticker-mash-duel-state').pop();
    assert.ok(Array.isArray(stateEvent.data.byPlayer[p1.id].you.stuckSeeds));
    assert.equal(stateEvent.data.byPlayer[p1.id].you.stuckSeeds.length, 1);
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

  it('emits observability metrics for cooldown drops and finish', () => {
    const [p1, p2] = mkPlayers();
    const events = [];
    const gs = new GameState(p1, p2, (event, data) => events.push({ event, data }));
    gs.start();
    gs.phase = 'playing';

    gs.nextTapAtByPlayer[p1.id] = Date.now() + 999;
    gs.handleAction(p1.id, { type: 'mash-tap' });
    assert.ok(events.some((e) => e.event === 'sticker-mash-duel-metric' && e.data.kind === 'tap_dropped_cooldown'));

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
