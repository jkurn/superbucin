import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'bunny', socket: null };
  const p2 = { id: 'p2', side: 'kitty', socket: null };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, events, p1, p2 };
}

function _lastEvent(events, type) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === type) return events[i].data;
  }
  return null;
}

/**
 * Fast-forward the countdown phase and start fighting.
 */
function skipToFighting(game) {
  game.clearTimers();
  game.initFighters();
  game.phase = 'fighting';
  game.actionQueue = [];
  game.hitEvents = [];
  // Don't start the tick loop — we'll call tick() manually in tests
}

describe('Bonk Brawl GameState', () => {
  let game, _events;

  afterEach(() => {
    if (game?.active) game.stop();
  });

  describe('lifecycle', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
    });

    it('starts with active=true', () => {
      game.start();
      assert.equal(game.active, true);
    });

    it('initializes round wins at 0', () => {
      game.start();
      assert.equal(game.roundWins.p1, 0);
      assert.equal(game.roundWins.p2, 0);
    });

    it('starts in countdown phase', () => {
      game.start();
      assert.equal(game.phase, 'countdown');
    });

    it('stop() clears everything', () => {
      game.start();
      game.stop();
      assert.equal(game.active, false);
    });

    it('pause/resume works', () => {
      game.start();
      game.pause();
      assert.equal(game.paused, true);
      game.resume();
      assert.equal(game.paused, false);
    });

    it('countdown timer transitions into fighting phase', () => {
      let countdownCb = null;
      const originalSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (cb) => {
        countdownCb = cb;
        return 1;
      };
      try {
        game.start();
        assert.equal(game.phase, 'countdown');
        countdownCb();
        assert.equal(game.phase, 'fighting');
      } finally {
        globalThis.setTimeout = originalSetTimeout;
      }
    });
  });

  describe('handleAction', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
    });

    it('ignores actions during countdown', () => {
      game.handleAction('p1', { type: 'attack' });
      // Should not crash, fighters may not exist yet
      assert.equal(game.phase, 'countdown');
    });

    it('ignores actions when paused', () => {
      game.pause();
      game.handleAction('p1', { type: 'attack' });
      assert.equal(game.paused, true);
    });

    it('ignores null actions', () => {
      game.handleAction('p1', null);
      // Should not crash
      assert.ok(true);
    });
  });

  describe('fighting mechanics', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
      skipToFighting(game);
    });

    it('fighters start with full HP (100)', () => {
      const f1 = game.fighters.p1;
      const f2 = game.fighters.p2;
      assert.equal(f1.hp, 100);
      assert.equal(f2.hp, 100);
    });

    it('fighters start in idle state', () => {
      assert.equal(game.fighters.p1.state, 'idle');
      assert.equal(game.fighters.p2.state, 'idle');
    });

    it('attack action queues correctly', () => {
      game.handleAction('p1', { type: 'attack' });
      assert.ok(game.actionQueue.length > 0);
    });

    it('block-start enters blocking state after tick', () => {
      game.handleAction('p1', { type: 'block-start' });
      game.tick();
      assert.equal(game.fighters.p1.state, 'blocking');
    });

    it('block-end returns to idle', () => {
      game.fighters.p1.state = 'blocking';
      game.handleAction('p1', { type: 'block-end' });
      game.tick();
      assert.equal(game.fighters.p1.state, 'idle');
    });
  });

  describe('damage and win', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
      skipToFighting(game);
    });

    it('attack reduces opponent HP', () => {
      const startHP = game.fighters.p2.hp;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';

      game.handleAction('p1', { type: 'attack' });
      game.tick(); // process queue → attack executes

      // p2 should have taken damage
      assert.ok(game.fighters.p2.hp < startHP,
        `p2 HP should drop from ${startHP}, got ${game.fighters.p2.hp}`);
    });

    it('killing blow ends the round', () => {
      game.fighters.p2.hp = 1;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';

      game.handleAction('p1', { type: 'attack' });
      game.tick();

      assert.ok(
        game.phase === 'round-end' || game.roundWins.p1 > 0,
        `Expected round-end, got phase=${game.phase}`
      );
    });

    it('winning enough rounds ends match', () => {
      game.roundWins.p1 = 1; // One round away from winning (need 2)
      game.fighters.p2.hp = 1;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';

      game.handleAction('p1', { type: 'attack' });
      game.tick();

      // Should have won 2nd round
      assert.equal(game.roundWins.p1, 2);
      // Match may end immediately or after timer
      assert.ok(
        game.phase === 'round-end' || game.phase === 'finished' || !game.active,
        `Expected round-end/finished, got phase=${game.phase}, active=${game.active}`
      );
    });

    it('blocking shield can break and stun defender', () => {
      game.fighters.p2.state = 'blocking';
      game.fighters.p2.shieldHP = 1;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';

      game.doAttack('p1');
      assert.equal(game.fighters.p2.state, 'hurt');
      assert.equal(game.fighters.p2.shieldHP, 0);
    });

    it('charging defender takes vulnerable bonus damage', () => {
      game.fighters.p2.state = 'charging';
      game.fighters.p2.chargeStartedAt = Date.now() - 500;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';

      const hp = game.fighters.p2.hp;
      game.doAttack('p1');
      assert.equal(game.fighters.p2.hp < hp, true);
      assert.equal(game.fighters.p2.chargeStartedAt, 0);
    });
  });

  describe('special attacks', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
      skipToFighting(game);
    });

    it('special requires full meter', () => {
      game.fighters.p1.specialMeter = 0;
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';
      game.handleAction('p1', { type: 'special' });
      game.tick();
      // Should not enter special state with empty meter
      assert.notEqual(game.fighters.p1.state, 'special');
    });

    it('special works with full meter', () => {
      game.fighters.p1.specialMeter = 100; // SPECIAL_METER_MAX
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';
      game.handleAction('p1', { type: 'special' });
      game.tick();
      // Special should have triggered — meter consumed or in special state
      assert.ok(
        game.fighters.p1.state === 'special' || game.fighters.p1.specialMeter === 0,
        `Special should trigger: state=${game.fighters.p1.state}, meter=${game.fighters.p1.specialMeter}`
      );
    });
  });

  describe('cubit (charge attack)', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
      skipToFighting(game);
    });

    it('cubit-start enters charging state', () => {
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';
      game.handleAction('p1', { type: 'cubit-start' });
      game.tick();
      assert.equal(game.fighters.p1.state, 'charging');
    });

    it('cubit-release triggers attack after charging', () => {
      game.fighters.p1.attackCooldown = 0;
      game.fighters.p1.state = 'idle';
      game.handleAction('p1', { type: 'cubit-start' });
      game.tick();
      assert.equal(game.fighters.p1.state, 'charging');

      // Release
      game.handleAction('p1', { type: 'cubit-release' });
      game.tick();

      // Should no longer be charging
      assert.notEqual(game.fighters.p1.state, 'charging');
    });

    it('cubit can be partially blocked below break threshold', () => {
      const originalNow = Date.now;
      let now = 10_000;
      Date.now = () => now;
      try {
        game.fighters.p1.attackCooldown = 0;
        game.fighters.p1.state = 'idle';
        game.fighters.p2.state = 'blocking';
        game.fighters.p2.shieldHP = 100;

        game.handleAction('p1', { type: 'cubit-start' });
        game.tick();
        now += 100; // low charge ratio
        game.handleAction('p1', { type: 'cubit-release' });
        game.tick();

        assert.equal(game.fighters.p2.shieldHP < 100, true);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('state shaping and reconnect payload', () => {
    beforeEach(() => {
      ({ game, events: _events } = createGame());
      game.start();
      skipToFighting(game);
    });

    it('state timers decay and transient states return to idle', () => {
      game.fighters.p1.state = 'hurt';
      game.fighters.p1.stateTimer = 10;
      game.fighters.p1.attackCooldown = 10;
      game.tick();
      assert.equal(game.fighters.p1.state, 'idle');
      assert.equal(game.fighters.p1.attackCooldown, 0);
    });

    it('getReconnectPayload returns normalized bonk state slices', () => {
      const payload = game.getReconnectPayload('p1');
      assert.ok(payload.bonkState);
      assert.equal(payload.bonkState.gameType, 'bonk-brawl');
      assert.ok(payload.bonkState.me);
      assert.ok(payload.bonkState.opp);
      assert.equal(Array.isArray(payload.bonkState.hitEvents), true);
    });
  });
});
