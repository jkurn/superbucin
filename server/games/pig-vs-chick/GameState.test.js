import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'pig' };
  const p2 = { id: 'p2', side: 'chicken' };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, events, p1, p2 };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

describe('Pig vs Chick GameState requirements', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts and resets core state', () => {
    const { game } = createGame();
    currentGame = game;

    game.energies.p1 = 1;
    game.playerHP.p2 = 3;
    game.start();
    game.stop();

    assert.equal(game.active, false);
    assert.equal(game.energies.p1, GAME_CONFIG.STARTING_ENERGY);
    assert.equal(game.energies.p2, GAME_CONFIG.STARTING_ENERGY);
    assert.equal(game.playerHP.p1, GAME_CONFIG.PLAYER_HP);
    assert.equal(game.playerHP.p2, GAME_CONFIG.PLAYER_HP);
  });

  it('pause and resume control tick loop safely', () => {
    const { game } = createGame();
    currentGame = game;

    game.start();
    const startedInterval = game.interval;
    assert.ok(startedInterval);
    game.pause();
    assert.equal(game.interval, null);
    game.resume();
    assert.ok(game.interval);
    game.stop();
  });

  it('spawns units server-authoritatively with cost + lane validation', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    game.requestSpawn('p1', 1, 2);
    assert.equal(game.units.length, 1);
    assert.equal(game.units[0].lane, 2);
    assert.equal(game.units[0].direction, 1);
    assert.equal(game.energies.p1, GAME_CONFIG.STARTING_ENERGY - GAME_CONFIG.UNITS[0].cost);

    const count = game.units.length;
    game.requestSpawn('p1', 0, 2); // invalid tier
    game.requestSpawn('p1', 2, -1); // invalid lane
    game.energies.p1 = 0;
    game.requestSpawn('p1', 4, 1); // insufficient energy
    assert.equal(game.units.length, count);
  });

  it('regens energy each tick and caps at max', () => {
    const { game, events } = createGame();
    currentGame = game;
    game.active = true;
    game.energies.p1 = GAME_CONFIG.MAX_ENERGY - 0.1;
    game.energies.p2 = 0;

    game.tick(1);

    assert.equal(game.energies.p1, GAME_CONFIG.MAX_ENERGY);
    assert.equal(game.energies.p2, GAME_CONFIG.ENERGY_REGEN);
    assert.ok(lastEvent(events, 'state-update'));
  });

  it('marches units toward enemy base and applies base damage', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;
    game.requestSpawn('p1', 1, 0);
    const unit = game.units[0];

    // Force just before enemy base boundary for p1 direction.
    unit.z = -GAME_CONFIG.LANE_HEIGHT / 2 + 0.01;
    game.tick(1 / GAME_CONFIG.TICK_RATE);

    assert.equal(unit.state, 'dead');
    assert.equal(game.playerHP.p2, GAME_CONFIG.PLAYER_HP - GAME_CONFIG.BASE_DAMAGE[0]);
  });

  it('heavier tiers deal more base damage than lighter tiers', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    const t1 = { id: 1, ownerId: 'p1', tier: 1, state: 'march' };
    const t4 = { id: 4, ownerId: 'p1', tier: 4, state: 'march' };
    game.playerHP.p2 = 100;
    game.onUnitReachedBase(t1);
    const d1 = 100 - game.playerHP.p2;
    game.playerHP.p2 = 100;
    game.onUnitReachedBase(t4);
    const d4 = 100 - game.playerHP.p2;

    assert.ok(d4 > d1);
  });

  it('locks collisions into push state and prevents pass-through on overshoot', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: 0.06, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'march', targetId: null,
    });
    game.units.push({
      id: 2, ownerId: 'p2', side: 'chicken', tier: 1, direction: -1, lane: 0,
      z: -0.06, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'march', targetId: null,
    });

    // One big tick causes potential crossover if not clamped.
    game.updateUnits(0.2);
    const [a, b] = game.units;

    assert.equal(a.state, 'push');
    assert.equal(b.state, 'push');
    assert.ok(a.z >= b.z, 'direction-1 unit should remain ahead of direction-(-1) unit');
    assert.ok(Math.abs(a.z - b.z) <= GAME_CONFIG.COLLISION_DIST + 0.001);
  });

  it('heavier unit pushes and damages weaker unit during push', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    const heavy = {
      id: 1, ownerId: 'p1', side: 'pig', tier: 4, direction: 1, lane: 1,
      z: 0.5, hp: 200, maxHp: 200, weight: 70, speed: 0.7, state: 'push', targetId: 2,
    };
    const light = {
      id: 2, ownerId: 'p2', side: 'chicken', tier: 1, direction: -1, lane: 1,
      z: -0.5, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'push', targetId: 1,
    };
    game.units.push(heavy, light);

    const beforeZ = heavy.z;
    const beforeWeakHp = light.hp;
    game.updateUnits(1);

    assert.ok(heavy.z < beforeZ, 'heavy unit should advance in its march direction');
    assert.ok(light.hp < beforeWeakHp, 'weaker unit should take push damage');
  });

  it('equal-weight push causes mutual attrition without movement advantage', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    const a = {
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 2,
      z: 0.5, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'push', targetId: 2,
    };
    const b = {
      id: 2, ownerId: 'p2', side: 'chicken', tier: 1, direction: -1, lane: 2,
      z: -0.5, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'push', targetId: 1,
    };
    game.units.push(a, b);

    game.updateUnits(1);
    assert.ok(a.hp < 40);
    assert.ok(b.hp < 40);
    assert.equal(a.z, 0.5);
    assert.equal(b.z, -0.5);
  });

  it('dead targets release opponents back to march', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: 0.5, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'push', targetId: 2,
    });
    game.units.push({
      id: 2, ownerId: 'p2', side: 'chicken', tier: 1, direction: -1, lane: 0,
      z: -0.5, hp: 0, maxHp: 40, weight: 10, speed: 1.8, state: 'dead', targetId: null,
    });

    game.updateUnits(1 / GAME_CONFIG.TICK_RATE);
    assert.equal(game.units[0].state, 'march');
    assert.equal(game.units[0].targetId, null);
  });

  it('removes dead units after decay window', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;
    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: 0, hp: 0, maxHp: 40, weight: 10, speed: 1.8, state: 'dead', targetId: null, deadTimer: 0,
    });

    game.tick(0.6);
    assert.equal(game.units.length, 0);
  });

  it('emits match-end and winner when player HP reaches zero', () => {
    const { game, events } = createGame();
    currentGame = game;
    game.active = true;
    game.playerHP.p1 = 0;

    game.tick(1 / GAME_CONFIG.TICK_RATE);

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, 'p2');
    assert.equal(game.active, false);
  });

  it('migratePlayer preserves state ownership and mappings', () => {
    const { game } = createGame();
    currentGame = game;
    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: 0, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'march', targetId: null,
    });

    game.migratePlayer('p1', 'p1-new', { id: 'p1-new', side: 'pig' });

    assert.equal(game.p1.id, 'p1-new');
    assert.equal(game.units[0].ownerId, 'p1-new');
    assert.equal(game.energies['p1-new'], GAME_CONFIG.STARTING_ENERGY);
    assert.equal(game.playerHP['p1-new'], GAME_CONFIG.PLAYER_HP);
    assert.equal(game.energies.p1, undefined);
  });

  it('serializes alive unit fields in state-update payload', () => {
    const { game, events } = createGame();
    currentGame = game;
    game.active = true;
    game.requestSpawn('p1', 2, 3);

    game.tick(1 / GAME_CONFIG.TICK_RATE);
    const state = lastEvent(events, 'state-update');
    assert.ok(state);
    assert.ok(state.units.length > 0);
    const u = state.units[0];
    assert.equal(typeof u.id, 'number');
    assert.equal(u.lane, 3);
    assert.equal(u.tier, 2);
    assert.equal(typeof u.weight, 'number');
    assert.equal(typeof u.maxHp, 'number');
  });

  it('findClosestOpponent ignores same-side, dead, and other-lane units', () => {
    const { game } = createGame();
    currentGame = game;
    const subject = { id: 1, direction: 1, lane: 1, z: 2, state: 'march' };
    const candidates = [
      { id: 2, direction: 1, lane: 1, z: 1, state: 'march' }, // same direction
      { id: 3, direction: -1, lane: 0, z: 1, state: 'march' }, // other lane
      { id: 4, direction: -1, lane: 1, z: 1, state: 'dead' }, // dead
      { id: 5, direction: -1, lane: 1, z: 1.2, state: 'march' }, // valid and ahead
    ];
    const found = game.findClosestOpponent(subject, [subject, ...candidates]);
    assert.equal(found.id, 5);
  });

  it('returns no opponent when all candidates are behind', () => {
    const { game } = createGame();
    currentGame = game;
    const subject = { id: 1, direction: 1, lane: 1, z: 0, state: 'march' };
    const behind = [{ id: 2, direction: -1, lane: 1, z: 1, state: 'march' }];
    const found = game.findClosestOpponent(subject, [subject, ...behind]);
    assert.equal(found, null);
  });

  it('kills unit pushed past its own base boundary', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: GAME_CONFIG.LANE_HEIGHT / 2 + 0.49, hp: 40, maxHp: 40, weight: 10, speed: 1.8,
      state: 'push', targetId: 2,
    });
    game.units.push({
      id: 2, ownerId: 'p2', side: 'chicken', tier: 4, direction: -1, lane: 0,
      z: GAME_CONFIG.LANE_HEIGHT / 2 - 0.2, hp: 200, maxHp: 200, weight: 70, speed: 0.7,
      state: 'push', targetId: 1,
    });

    game.updateUnits(1);
    assert.equal(game.units[0].state, 'dead');
    assert.equal(game.units[0].deadTimer, 10);
  });

  it('applies base-hit check while units are pushing', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;
    game.playerHP.p2 = 100;

    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 3, direction: 1, lane: 2,
      z: -GAME_CONFIG.LANE_HEIGHT / 2 - 0.05, hp: 130, maxHp: 130, weight: 50, speed: 1.0,
      state: 'push', targetId: 2,
    });
    game.units.push({
      id: 2, ownerId: 'p2', side: 'chicken', tier: 1, direction: -1, lane: 2,
      z: -GAME_CONFIG.LANE_HEIGHT / 2 + 0.5, hp: 40, maxHp: 40, weight: 10, speed: 1.8,
      state: 'push', targetId: 1,
    });

    game.updateUnits(1 / GAME_CONFIG.TICK_RATE);
    assert.ok(game.playerHP.p2 < 100);
  });

  it('resets pushing unit when target no longer exists in alive list', () => {
    const { game } = createGame();
    currentGame = game;
    game.active = true;

    game.units.push({
      id: 1, ownerId: 'p1', side: 'pig', tier: 1, direction: 1, lane: 0,
      z: 0, hp: 40, maxHp: 40, weight: 10, speed: 1.8, state: 'push', targetId: 99,
    });

    game.updateUnits(1 / GAME_CONFIG.TICK_RATE);
    assert.equal(game.units[0].state, 'march');
    assert.equal(game.units[0].targetId, null);
  });
});
