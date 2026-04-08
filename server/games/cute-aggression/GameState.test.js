import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './GameState.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'merah', socket: null };
  const p2 = { id: 'p2', side: 'biru', socket: null };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, events, p1, p2 };
}

function lastEvent(events, type) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === type) return events[i].data;
  }
  return null;
}

function lastState(events) {
  const ev = lastEvent(events, 'cute-aggression-state');
  return ev?.byPlayer?.p1 || null;
}

function lastStateFor(events, playerId) {
  const ev = lastEvent(events, 'cute-aggression-state');
  return ev?.byPlayer?.[playerId] || null;
}

/**
 * Fast-forward the ready handshake: both players hold until countdown completes.
 * Uses fake timers by manually ticking the ready interval.
 */
function skipReadyPhase(game) {
  // Simulate both players holding
  game.handleAction('p1', { type: 'hold', pressed: true });
  game.handleAction('p2', { type: 'hold', pressed: true });
  // Fast-forward: set countdown start to 4 seconds ago (well past 3s threshold)
  game.readyState.countdownStart = Date.now() - 4000;
  // Trigger one tick to detect completion
  game._clearTimers();
  // Manually check and launch
  if (game.phase === 'ready') {
    game._launchMiniGame();
  }
}

/**
 * Fast-forward the roulette phase.
 */
function skipRoulette(game) {
  game._clearTimers();
  if (game.phase === 'roulette') {
    game._startReady();
  }
}

/**
 * Skip roulette + ready to get directly into a specific mini-game.
 */
function startMiniGame(game, miniGame) {
  game.currentMiniGame = miniGame;
  skipRoulette(game);
  skipReadyPhase(game);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Virus vs Virus — GameState', () => {
  let game, events, _p1, _p2;

  afterEach(() => {
    if (game?.active) game.stop();
  });

  // ── Lifecycle ────────────────────────────────────────────────

  describe('lifecycle', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('starts in roulette phase', () => {
      game.start();
      assert.equal(game.phase, 'roulette');
      assert.equal(game.active, true);
      assert.equal(game.roundNum, 1);
    });

    it('initializes match scores to 0', () => {
      game.start();
      assert.equal(game.matchScore.p1, 0);
      assert.equal(game.matchScore.p2, 0);
    });

    it('picks a valid mini-game', () => {
      game.start();
      assert.ok(['mash', 'color', 'memory'].includes(game.currentMiniGame));
    });

    it('emits state on start', () => {
      game.start();
      const state = lastState(events);
      assert.ok(state);
      assert.equal(state.phase, 'roulette');
      assert.equal(state.gameType, 'cute-aggression');
    });

    it('stop() clears active flag', () => {
      game.start();
      game.stop();
      assert.equal(game.active, false);
    });

    it('pause/resume cycle works', () => {
      game.start();
      game.pause();
      assert.equal(game.paused, true);
      game.resume();
      assert.equal(game.paused, false);
    });
  });

  // ── Per-player state slices ──────────────────────────────────

  describe('per-player state slices', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('each player gets their own slice', () => {
      game.start();
      const ev = lastEvent(events, 'cute-aggression-state');
      assert.ok(ev.byPlayer.p1);
      assert.ok(ev.byPlayer.p2);
    });

    it('me/opp characters are correct for each player', () => {
      game.start();
      const ev = lastEvent(events, 'cute-aggression-state');
      assert.equal(ev.byPlayer.p1.me.side, 'merah');
      assert.equal(ev.byPlayer.p1.opp.side, 'biru');
      assert.equal(ev.byPlayer.p2.me.side, 'biru');
      assert.equal(ev.byPlayer.p2.opp.side, 'merah');
    });

    it('matchScore is from each player perspective', () => {
      game.start();
      game.matchScore = { p1: 2, p2: 1 };
      game._broadcastState();
      const ev = lastEvent(events, 'cute-aggression-state');
      assert.equal(ev.byPlayer.p1.matchScore.me, 2);
      assert.equal(ev.byPlayer.p1.matchScore.opp, 1);
      assert.equal(ev.byPlayer.p2.matchScore.me, 1);
      assert.equal(ev.byPlayer.p2.matchScore.opp, 2);
    });
  });

  // ── Ready handshake ──────────────────────────────────────────

  describe('ready handshake', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
      game.start();
      skipRoulette(game);
    });

    it('enters ready phase after roulette', () => {
      assert.equal(game.phase, 'ready');
    });

    it('tracks player hold states', () => {
      game.handleAction('p1', { type: 'hold', pressed: true });
      assert.equal(game.readyState.holding.p1, true);
      assert.equal(game.readyState.holding.p2, false);
    });

    it('starts countdown when both hold', () => {
      game.handleAction('p1', { type: 'hold', pressed: true });
      game.handleAction('p2', { type: 'hold', pressed: true });
      assert.ok(game.readyState.countdownStart);
    });

    it('resets countdown when one releases', () => {
      game.handleAction('p1', { type: 'hold', pressed: true });
      game.handleAction('p2', { type: 'hold', pressed: true });
      assert.ok(game.readyState.countdownStart);

      game.handleAction('p1', { type: 'hold', pressed: false });
      assert.equal(game.readyState.countdownStart, null);
    });

    it('broadcasts ready slice with holding states', () => {
      game.handleAction('p1', { type: 'hold', pressed: true });
      const state = lastStateFor(events, 'p1');
      assert.equal(state.ready.meHolding, true);
      assert.equal(state.ready.oppHolding, false);
    });

    it('ignores non-hold actions during ready phase', () => {
      events.length = 0;
      game.handleAction('p1', { type: 'mash' });
      // Should not crash, and state shouldn't change to playing
      assert.equal(game.phase, 'ready');
    });
  });

  // ── Mash (Tug-of-War) ───────────────────────────────────────

  describe('mash mini-game', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
      game.start();
      startMiniGame(game, 'mash');
      events.length = 0;
    });

    it('enters playing phase with mash', () => {
      assert.equal(game.phase, 'playing');
      assert.equal(game.currentMiniGame, 'mash');
    });

    it('initializes offset at 0', () => {
      assert.equal(game.miniGameState.offset, 0);
    });

    it('p1 tap increases offset', () => {
      game.handleAction('p1', { type: 'mash' });
      assert.equal(game.miniGameState.offset, 1);
    });

    it('p2 tap decreases offset', () => {
      game.handleAction('p2', { type: 'mash' });
      assert.equal(game.miniGameState.offset, -1);
    });

    it('emits state with per-player perspective', () => {
      game.handleAction('p1', { type: 'mash' });
      const ev = lastEvent(events, 'cute-aggression-state');
      // p1 sees positive offset (winning)
      assert.equal(ev.byPlayer.p1.mini.offset, 1);
      // p2 sees negative offset (losing)
      assert.equal(ev.byPlayer.p2.mini.offset, -1);
    });

    it('p1 wins at +50 threshold', () => {
      game.miniGameState.offset = 49;
      game.handleAction('p1', { type: 'mash' });

      assert.equal(game.phase, 'mini-result');
      assert.equal(game.matchScore.p1, 1);
      assert.equal(game.lastMiniResult.winnerId, 'p1');
    });

    it('p2 wins at -50 threshold', () => {
      game.miniGameState.offset = -49;
      game.handleAction('p2', { type: 'mash' });

      assert.equal(game.phase, 'mini-result');
      assert.equal(game.matchScore.p2, 1);
      assert.equal(game.lastMiniResult.winnerId, 'p2');
    });

    it('ignores actions after winner determined', () => {
      game.miniGameState.offset = 49;
      game.handleAction('p1', { type: 'mash' }); // p1 wins
      game.handleAction('p2', { type: 'mash' }); // should be ignored

      assert.equal(game.matchScore.p2, 0);
    });

    it('rejects wrong action type', () => {
      game.handleAction('p1', { type: 'dot', index: 0 });
      // offset should not change
      assert.equal(game.miniGameState.offset, 0);
    });
  });

  // ── Color Match ──────────────────────────────────────────────

  describe('color match mini-game', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
      game.start();
      startMiniGame(game, 'color');
      events.length = 0;
    });

    it('initializes with 5 dots', () => {
      assert.equal(game.miniGameState.dots.length, 5);
    });

    it('dots have at least one of each color', () => {
      const dots = game.miniGameState.dots;
      assert.ok(dots.includes('merah'), 'should have at least one merah');
      assert.ok(dots.includes('biru'), 'should have at least one biru');
    });

    it('tapping opponent dot flips to your color', () => {
      // Set up known state: first dot is biru (opponent of p1)
      game.miniGameState.dots = ['biru', 'merah', 'biru', 'merah', 'biru'];

      game.handleAction('p1', { type: 'dot', index: 0 });
      assert.equal(game.miniGameState.dots[0], 'merah');
    });

    it('tapping own dot is a BLUNDER — flips to opponent', () => {
      game.miniGameState.dots = ['merah', 'biru', 'biru', 'biru', 'biru'];

      game.handleAction('p1', { type: 'dot', index: 0 }); // merah taps merah = blunder!
      assert.equal(game.miniGameState.dots[0], 'biru');
    });

    it('p2 blunder flips biru dot to merah', () => {
      game.miniGameState.dots = ['merah', 'biru', 'merah', 'merah', 'merah'];

      game.handleAction('p2', { type: 'dot', index: 1 }); // biru taps own biru = blunder
      assert.equal(game.miniGameState.dots[1], 'merah');
    });

    it('all dots same color = win for that player', () => {
      game.miniGameState.dots = ['merah', 'merah', 'merah', 'merah', 'biru'];

      game.handleAction('p1', { type: 'dot', index: 4 }); // flip last biru to merah
      assert.equal(game.phase, 'mini-result');
      assert.equal(game.lastMiniResult.winnerId, 'p1');
    });

    it('blunder can cause opponent to win', () => {
      game.miniGameState.dots = ['merah', 'biru', 'biru', 'biru', 'biru'];

      game.handleAction('p1', { type: 'dot', index: 0 }); // blunder: merah→biru
      // Now all dots are biru → p2 wins!
      assert.equal(game.phase, 'mini-result');
      assert.equal(game.lastMiniResult.winnerId, 'p2');
    });

    it('rejects out-of-bounds dot index', () => {
      game.handleAction('p1', { type: 'dot', index: 99 });
      assert.equal(game.phase, 'playing'); // no change
    });

    it('rejects negative dot index', () => {
      game.handleAction('p1', { type: 'dot', index: -1 });
      assert.equal(game.phase, 'playing');
    });

    it('rejects non-number dot index', () => {
      game.handleAction('p1', { type: 'dot', index: 'abc' });
      assert.equal(game.phase, 'playing');
    });

    it('both players can compete on same dots', () => {
      game.miniGameState.dots = ['merah', 'biru', 'merah', 'biru', 'merah'];

      // p2 flips dot 0 (merah→biru)
      game.handleAction('p2', { type: 'dot', index: 0 });
      assert.equal(game.miniGameState.dots[0], 'biru');

      // p1 flips it back (biru→merah)
      game.handleAction('p1', { type: 'dot', index: 0 });
      assert.equal(game.miniGameState.dots[0], 'merah');
    });

    it('state slice includes dots and mySide', () => {
      game._broadcastState();
      const ev = lastEvent(events, 'cute-aggression-state');
      assert.equal(ev.byPlayer.p1.mini.mySide, 'merah');
      assert.equal(ev.byPlayer.p2.mini.mySide, 'biru');
      assert.ok(Array.isArray(ev.byPlayer.p1.mini.dots));
    });
  });

  // ── Memory (Virus Counting) ──────────────────────────────────

  describe('memory mini-game', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
      game.start();
      startMiniGame(game, 'memory');
      events.length = 0;
    });

    it('initializes in display phase', () => {
      assert.equal(game.miniGameState.memoryPhase, 'display');
    });

    it('generates sequence of 10 viruses', () => {
      assert.equal(game.miniGameState.sequence.length, 10);
    });

    it('sequence has both colors', () => {
      const seq = game.miniGameState.sequence;
      assert.ok(seq.includes('merah'));
      assert.ok(seq.includes('biru'));
    });

    it('generates valid answer options including correct answer', () => {
      const ms = game.miniGameState;
      assert.ok(ms.options.includes(ms.correctAnswer));
      assert.equal(ms.options.length, 4);
    });

    it('options are sorted ascending', () => {
      const opts = game.miniGameState.options;
      for (let i = 1; i < opts.length; i++) {
        assert.ok(opts[i] >= opts[i - 1], `options[${i}] should be >= options[${i - 1}]`);
      }
    });

    it('correct answer matches actual sequence count', () => {
      const ms = game.miniGameState;
      const count = ms.sequence.filter((c) => c === ms.askColor).length;
      assert.equal(ms.correctAnswer, count);
    });

    it('ignores answers during display phase', () => {
      game.handleAction('p1', { type: 'answer', value: 5 });
      assert.equal(game.miniGameState.answers.p1, null); // unchanged
    });

    it('correct answer wins immediately', () => {
      // Fast-forward to prompt phase
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      const correct = game.miniGameState.correctAnswer;
      game.handleAction('p1', { type: 'answer', value: correct });

      assert.equal(game.phase, 'mini-result');
      assert.equal(game.lastMiniResult.winnerId, 'p1');
    });

    it('wrong answer locks player out', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      const wrong = game.miniGameState.correctAnswer + 99;
      game.handleAction('p1', { type: 'answer', value: wrong });

      assert.equal(game.miniGameState.locked.p1, true);
      assert.equal(game.miniGameState.answers.p1, wrong);
      assert.equal(game.phase, 'playing'); // game continues for p2
    });

    it('locked player cannot answer again', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      const wrong = game.miniGameState.correctAnswer + 99;
      game.handleAction('p1', { type: 'answer', value: wrong });
      assert.equal(game.miniGameState.locked.p1, true);

      // Try to answer again with correct
      const correct = game.miniGameState.correctAnswer;
      game.handleAction('p1', { type: 'answer', value: correct });
      // p1 is still locked, shouldn't win
      assert.notEqual(game.lastMiniResult?.winnerId, 'p1');
    });

    it('p2 can still answer after p1 is locked', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      // p1 answers wrong
      game.handleAction('p1', { type: 'answer', value: -1 });
      assert.equal(game.miniGameState.locked.p1, true);

      // p2 answers correctly
      const correct = game.miniGameState.correctAnswer;
      game.handleAction('p2', { type: 'answer', value: correct });
      assert.equal(game.lastMiniResult.winnerId, 'p2');
    });

    it('both wrong triggers random winner', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      game.handleAction('p1', { type: 'answer', value: -1 });
      game.handleAction('p2', { type: 'answer', value: -2 });

      assert.equal(game.phase, 'mini-result');
      assert.ok(['p1', 'p2'].includes(game.lastMiniResult.winnerId));
    });

    it('state slice hides correct answer until resolved', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._broadcastState();

      const state = lastStateFor(events, 'p1');
      // Before answering, no correct answer visible
      assert.equal(state.mini.correctAnswer, undefined);
    });

    it('state slice reveals correct answer after player is locked', () => {
      game.miniGameState.memoryPhase = 'prompt';
      game._clearTimers();

      game.handleAction('p1', { type: 'answer', value: -1 });

      const state = lastStateFor(events, 'p1');
      assert.equal(state.mini.correctAnswer, game.miniGameState.correctAnswer);
    });
  });

  // ── Match flow ───────────────────────────────────────────────

  describe('match flow', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('mini-result phase shows correct winner info', () => {
      game.start();
      startMiniGame(game, 'mash');
      game.miniGameState.offset = 49;
      game.handleAction('p1', { type: 'mash' });

      const p1State = lastStateFor(events, 'p1');
      const p2State = lastStateFor(events, 'p2');
      assert.equal(p1State.lastMiniResult.iWon, true);
      assert.equal(p2State.lastMiniResult.iWon, false);
    });

    it('match ends when WIN_SCORE reached', () => {
      game.start();
      game.matchScore = { p1: 2, p2: 0 }; // One away from winning (WIN_SCORE=3)
      startMiniGame(game, 'mash');
      game.miniGameState.offset = 49;
      events.length = 0;

      game.handleAction('p1', { type: 'mash' }); // p1 reaches 3
      assert.equal(game.matchScore.p1, 3);
      assert.equal(game.phase, 'mini-result');

      // Fast-forward mini-result timer
      game._clearTimers();
      game._finishMatch('p1');

      const matchEnd = lastEvent(events, 'match-end');
      assert.ok(matchEnd);
      assert.equal(matchEnd.winnerId, 'p1');
      assert.equal(game.active, false);
      assert.equal(game.phase, 'finished');
    });

    it('advances to roulette after mini-result (not match win)', () => {
      game.start();
      game.matchScore = { p1: 0, p2: 0 };
      startMiniGame(game, 'mash');
      game.miniGameState.offset = 49;
      game.handleAction('p1', { type: 'mash' });

      assert.equal(game.phase, 'mini-result');
      // Fast-forward to roulette
      game._clearTimers();
      game._startRoulette();

      assert.equal(game.phase, 'roulette');
      assert.equal(game.roundNum, 2);
    });
  });

  // ── Player migration ─────────────────────────────────────────

  describe('migratePlayer', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('migrates player ID in match score', () => {
      game.start();
      game.matchScore.p1 = 2;
      game.migratePlayer('p1', 'p1-new', { id: 'p1-new', side: 'merah' });

      assert.equal(game.matchScore['p1-new'], 2);
      assert.equal(game.matchScore.p1, undefined);
    });

    it('resets hold state for migrated player', () => {
      game.start();
      skipRoulette(game);
      game.readyState.holding.p1 = true;

      game.migratePlayer('p1', 'p1-new', { id: 'p1-new', side: 'merah' });
      assert.equal(game.readyState.holding['p1-new'], false);
      assert.equal(game.readyState.countdownStart, null);
    });

    it('migrates p2 mini-game lock/answer maps and updates player reference', () => {
      game.start();
      startMiniGame(game, 'memory');
      game.miniGameState.memoryPhase = 'prompt';
      game.miniGameState.locked.p2 = true;
      game.miniGameState.answers.p2 = 7;

      game.migratePlayer('p2', 'p2-new', { id: 'p2-new', side: 'biru' });
      assert.equal(game.p2.id, 'p2-new');
      assert.equal(game.miniGameState.locked['p2-new'], true);
      assert.equal(game.miniGameState.answers['p2-new'], 7);
      assert.equal(game.miniGameState.locked.p2, undefined);
    });
  });

  // ── Reconnect payload ────────────────────────────────────────

  describe('getReconnectPayload', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('returns cuteAggressionState with all fields', () => {
      game.start();
      const payload = game.getReconnectPayload('p1');

      assert.ok(payload.cuteAggressionState);
      const s = payload.cuteAggressionState;
      assert.equal(s.gameType, 'cute-aggression');
      assert.equal(s.phase, 'roulette');
      assert.ok(s.me);
      assert.ok(s.opp);
      assert.ok(s.ready);
      assert.ok(typeof s.matchScore.me === 'number');
      assert.ok(typeof s.winScore === 'number');
    });

    it('me/opp are correct per player', () => {
      game.start();
      const p1Payload = game.getReconnectPayload('p1').cuteAggressionState;
      const p2Payload = game.getReconnectPayload('p2').cuteAggressionState;

      assert.equal(p1Payload.me.side, 'merah');
      assert.equal(p2Payload.me.side, 'biru');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      ({ game, events, p1: _p1, p2: _p2 } = createGame());
    });

    it('ignores actions when paused', () => {
      game.start();
      startMiniGame(game, 'mash');
      game.pause();

      game.handleAction('p1', { type: 'mash' });
      assert.equal(game.miniGameState.offset, 0);
    });

    it('ignores actions when not active', () => {
      // Don't start the game
      game.handleAction('p1', { type: 'mash' });
      assert.equal(events.length, 0);
    });

    it('ignores null/undefined actions', () => {
      game.start();
      game.handleAction('p1', null);
      game.handleAction('p1', undefined);
      game.handleAction('p1', 'string');
      // Should not crash
      assert.ok(true);
    });

    it('handles rapid tapping without issues', () => {
      game.start();
      startMiniGame(game, 'mash');

      for (let i = 0; i < 200; i++) {
        if (!game.active || game.phase !== 'playing') break;
        game.handleAction(i % 2 === 0 ? 'p1' : 'p2', { type: 'mash' });
      }

      // Game should still be in a valid state
      assert.ok(['playing', 'mini-result'].includes(game.phase));
    });

    it('color match: all dots random generates valid board', () => {
      // Run 50 times to test randomness
      for (let trial = 0; trial < 50; trial++) {
        const g = createGame();
        g.game.start();
        startMiniGame(g.game, 'color');
        const dots = g.game.miniGameState.dots;

        assert.equal(dots.length, 5, `Trial ${trial}: should have 5 dots`);
        assert.ok(dots.includes('merah'), `Trial ${trial}: must have merah`);
        assert.ok(dots.includes('biru'), `Trial ${trial}: must have biru`);

        g.game.stop();
      }
    });

    it('memory: answer options always include correct answer', () => {
      for (let trial = 0; trial < 50; trial++) {
        const g = createGame();
        g.game.start();
        startMiniGame(g.game, 'memory');
        const ms = g.game.miniGameState;

        assert.ok(ms.options.includes(ms.correctAnswer),
          `Trial ${trial}: options ${ms.options} missing correct ${ms.correctAnswer}`);
        assert.equal(ms.options.length, 4,
          `Trial ${trial}: should have 4 options`);

        g.game.stop();
      }
    });

    it('returns empty mini slice for unknown mini-game type', () => {
      game.start();
      game.currentMiniGame = 'unknown-mini';
      const slice = game._buildMiniSlice(game.p1, game.p2);
      assert.deepEqual(slice, {});
    });
  });
});
