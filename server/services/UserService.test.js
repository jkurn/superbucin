import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { UserService } from './UserService.js';

function makePlayer(id, { userId, isGuest = false, displayName = 'Player', avatarUrl = null } = {}) {
  return {
    id,
    identity: { userId: userId || null, isGuest, displayName, avatarUrl },
  };
}

function makeFakeClient({ singleDataByTable = {} } = {}) {
  const ops = [];

  return {
    ops,
    from(table) {
      ops.push({ op: 'from', table });
      const state = { table };
      const chain = {
        select(_cols) {
          ops.push({ op: 'select', table: state.table });
          return chain;
        },
        insert(payload) {
          ops.push({ op: 'insert', table: state.table, payload });
          return Promise.resolve({ data: payload, error: null });
        },
        update(payload) {
          ops.push({ op: 'update', table: state.table, payload });
          return chain;
        },
        eq(field, value) {
          ops.push({ op: 'eq', table: state.table, field, value });
          return chain;
        },
        or(expr) {
          ops.push({ op: 'or', table: state.table, expr });
          return chain;
        },
        order(field, opts) {
          ops.push({ op: 'order', table: state.table, field, opts });
          return chain;
        },
        limit(value) {
          ops.push({ op: 'limit', table: state.table, value });
          return Promise.resolve({
            data: singleDataByTable[state.table] ?? [],
            error: null,
          });
        },
        single() {
          ops.push({ op: 'single', table: state.table });
          return Promise.resolve({
            data: singleDataByTable[state.table] ?? null,
            error: null,
          });
        },
      };
      return chain;
    },
  };
}

const originalUpdateStats = UserService._updateStats;
const originalAddPoints = UserService._addPoints;
const originalCheckAchievements = UserService._checkAchievements;
const originalClient = UserService._getClient();

afterEach(() => {
  UserService._updateStats = originalUpdateStats;
  UserService._addPoints = originalAddPoints;
  UserService._checkAchievements = originalCheckAchievements;
  UserService._setClientForTests(originalClient);
});

describe('UserService.recordMatch', () => {
  it('returns early when DB client is unavailable', async () => {
    UserService._setClientForTests(null);

    const result = await UserService.recordMatch({
      gameType: 'othello',
      p1: makePlayer('p1', { isGuest: true }),
      p2: makePlayer('p2', { isGuest: true }),
      winnerId: null,
      scores: [0, 0],
      isTie: true,
    });

    assert.deepEqual(result, { newAchievements: {} });
  });

  it('awards points correctly for authenticated winner/loser and records match row', async () => {
    const fakeClient = makeFakeClient();
    UserService._setClientForTests(fakeClient);

    const calls = {
      updateStats: [],
      addPoints: [],
      checkAchievements: [],
    };

    UserService._updateStats = async (userId, gameType, isWinner, isTie, points) => {
      calls.updateStats.push({ userId, gameType, isWinner, isTie, points });
    };
    UserService._addPoints = async (userId, points) => {
      calls.addPoints.push({ userId, points });
    };
    UserService._checkAchievements = async (userId, gameType) => {
      calls.checkAchievements.push({ userId, gameType });
      return userId === 'u1' ? [{ id: 'first-win' }] : [];
    };

    const result = await UserService.recordMatch({
      gameType: 'othello',
      p1: makePlayer('p1', { userId: 'u1', displayName: 'A', avatarUrl: '/a.png' }),
      p2: makePlayer('p2', { userId: 'u2', displayName: 'B', avatarUrl: '/b.png' }),
      winnerId: 'p1',
      scores: [10, 3],
      isTie: false,
    });

    // Points: winner = 100 + score*2, loser = 25 + score*2
    assert.deepEqual(result.pointsByPlayer, { p1: 120, p2: 31 });
    assert.deepEqual(result.newAchievements, { p1: [{ id: 'first-win' }] });

    assert.equal(calls.updateStats.length, 2);
    assert.deepEqual(calls.updateStats[0], {
      userId: 'u1',
      gameType: 'othello',
      isWinner: true,
      isTie: false,
      points: 120,
    });
    assert.deepEqual(calls.updateStats[1], {
      userId: 'u2',
      gameType: 'othello',
      isWinner: false,
      isTie: false,
      points: 31,
    });

    const insertOp = fakeClient.ops.find((o) => o.op === 'insert' && o.table === 'match_history');
    assert.ok(insertOp, 'match_history insert should happen');
    assert.deepEqual(insertOp.payload, {
      game_type: 'othello',
      player1_id: 'u1',
      player2_id: 'u2',
      player1_name: 'A',
      player2_name: 'B',
      player1_avatar: '/a.png',
      player2_avatar: '/b.png',
      winner_id: 'u1',
      player1_score: 10,
      player2_score: 3,
      is_tie: false,
    });
  });

  it('skips guest players in points/stats updates and records null winner on tie', async () => {
    const fakeClient = makeFakeClient();
    UserService._setClientForTests(fakeClient);

    let updates = 0;
    UserService._updateStats = async () => { updates += 1; };
    UserService._addPoints = async () => { updates += 1; };
    UserService._checkAchievements = async () => [];

    const result = await UserService.recordMatch({
      gameType: 'connect-four',
      p1: makePlayer('p1', { isGuest: true, displayName: 'GuestA' }),
      p2: makePlayer('p2', { userId: 'u2', displayName: 'B' }),
      winnerId: null,
      scores: [4, 4],
      isTie: true,
    });

    assert.deepEqual(result.pointsByPlayer, { p2: 58 });
    assert.deepEqual(result.newAchievements, {});
    assert.equal(updates, 2, 'only one authenticated player should be updated');

    const insertOp = fakeClient.ops.find((o) => o.op === 'insert' && o.table === 'match_history');
    assert.ok(insertOp);
    assert.equal(insertOp.payload.player1_id, null);
    assert.equal(insertOp.payload.winner_id, null);
    assert.equal(insertOp.payload.is_tie, true);
  });
});

describe('UserService helpers', () => {
  it('_updateStats updates existing row when present', async () => {
    const fakeClient = makeFakeClient({
      singleDataByTable: {
        user_stats: {
          id: 'row-1',
          wins: 2,
          losses: 1,
          ties: 0,
          games_played: 3,
          total_points: 120,
        },
      },
    });
    UserService._setClientForTests(fakeClient);

    await UserService._updateStats('u1', 'othello', true, false, 20);

    const updateOp = fakeClient.ops.find((o) => o.op === 'update' && o.table === 'user_stats');
    assert.ok(updateOp);
    assert.deepEqual(updateOp.payload, {
      wins: 3,
      losses: 1,
      ties: 0,
      games_played: 4,
      total_points: 140,
    });
  });

  it('_addPoints updates profile points when profile exists', async () => {
    const fakeClient = makeFakeClient({
      singleDataByTable: {
        profiles: { points: 200 },
      },
    });
    UserService._setClientForTests(fakeClient);

    await UserService._addPoints('u1', 35);

    const updateOp = fakeClient.ops.find((o) => o.op === 'update' && o.table === 'profiles');
    assert.ok(updateOp);
    assert.deepEqual(updateOp.payload, { points: 235 });
  });

  it('_updateStats inserts new row when no existing stats are present', async () => {
    const fakeClient = makeFakeClient({
      singleDataByTable: {
        user_stats: null,
      },
    });
    UserService._setClientForTests(fakeClient);

    await UserService._updateStats('u2', 'memory-match', false, true, 42);
    const insertOp = fakeClient.ops.find((o) => o.op === 'insert' && o.table === 'user_stats');
    assert.ok(insertOp);
    assert.deepEqual(insertOp.payload, {
      user_id: 'u2',
      game_type: 'memory-match',
      wins: 0,
      losses: 0,
      ties: 1,
      games_played: 1,
      total_points: 42,
    });
  });

  it('_addPoints no-ops when profile row is absent', async () => {
    const fakeClient = makeFakeClient({
      singleDataByTable: {
        profiles: null,
      },
    });
    UserService._setClientForTests(fakeClient);
    await UserService._addPoints('u3', 50);
    const updateOp = fakeClient.ops.find((o) => o.op === 'update' && o.table === 'profiles');
    assert.equal(updateOp, undefined);
  });

  it('_checkWinStreak returns true only when enough recent wins exist', async () => {
    const winningClient = makeFakeClient({
      singleDataByTable: {
        match_history: [
          { winner_id: 'u1', is_tie: false },
          { winner_id: 'u1', is_tie: false },
          { winner_id: 'u1', is_tie: false },
        ],
      },
    });
    UserService._setClientForTests(winningClient);
    const ok = await UserService._checkWinStreak('u1', 3);
    assert.equal(ok, true);

    const mixedClient = makeFakeClient({
      singleDataByTable: {
        match_history: [
          { winner_id: 'u1', is_tie: false },
          { winner_id: 'u2', is_tie: false },
        ],
      },
    });
    UserService._setClientForTests(mixedClient);
    const notEnough = await UserService._checkWinStreak('u1', 3);
    assert.equal(notEnough, false);
  });

  it('_checkAchievements evaluates multiple condition types and inserts newly earned', async () => {
    const ops = [];
    const rows = {
      statsSingle: { wins: 3, games_played: 6 },
      allStats: [
        { wins: 3, games_played: 6 },
        { wins: 1, games_played: 2 },
      ],
      existing: [{ achievement_id: 'existing-ach' }],
      achievements: [
        { id: 'existing-ach', condition_type: 'total_wins', condition_value: 1, category: 'othello' },
        { id: 'tw', name: 'Total Wins', icon: '🏆', description: 'tw', condition_type: 'total_wins', condition_value: 4, category: 'othello' },
        { id: 'tg', name: 'Total Games', icon: '🎮', description: 'tg', condition_type: 'total_games', condition_value: 8, category: 'othello' },
        { id: 'gw', name: 'Game Wins', icon: '🥇', description: 'gw', condition_type: 'game_wins', condition_value: 3, category: 'othello' },
        { id: 'uw', name: 'Unique Wins', icon: '🌈', description: 'uw', condition_type: 'unique_game_wins', condition_value: 2, category: 'othello' },
        { id: 'ws', name: 'Streak', icon: '🔥', description: 'ws', condition_type: 'win_streak', condition_value: 2, category: 'othello' },
      ],
    };

    const client = {
      from(table) {
        const ctx = { table, filters: [] };
        const chain = {
          select() { return chain; },
          eq(field, value) { ctx.filters.push([field, value]); return chain; },
          single() {
            if (table === 'user_stats' && ctx.filters.some(([f]) => f === 'game_type')) {
              return Promise.resolve({ data: rows.statsSingle, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          insert(payload) {
            ops.push({ table, payload });
            return Promise.resolve({ data: payload, error: null });
          },
          then(resolve) {
            if (table === 'user_stats') return resolve({ data: rows.allStats, error: null });
            if (table === 'user_achievements') return resolve({ data: rows.existing, error: null });
            if (table === 'achievements') return resolve({ data: rows.achievements, error: null });
            return resolve({ data: [], error: null });
          },
        };
        return chain;
      },
    };

    const originalWinStreak = UserService._checkWinStreak;
    UserService._checkWinStreak = async () => true;
    UserService._setClientForTests(client);
    try {
      const earned = await UserService._checkAchievements('u1', 'othello');
      assert.equal(earned.length, 5);
      const insertedIds = ops
        .filter((o) => o.table === 'user_achievements')
        .map((o) => o.payload.achievement_id)
        .sort();
      assert.deepEqual(insertedIds, ['gw', 'tg', 'tw', 'uw', 'ws']);
    } finally {
      UserService._checkWinStreak = originalWinStreak;
    }
  });

  it('_checkAchievements returns empty when achievement/stat rows are unavailable', async () => {
    const client = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          single() { return Promise.resolve({ data: null, error: null }); },
          then(resolve) { return resolve({ data: null, error: null }); },
        };
      },
    };
    UserService._setClientForTests(client);
    const earned = await UserService._checkAchievements('u1', 'othello');
    assert.deepEqual(earned, []);
  });

  it('getProfile handles missing client and successful profile lookup', async () => {
    UserService._setClientForTests(null);
    const none = await UserService.getProfile('u1');
    assert.equal(none, null);

    const fakeClient = makeFakeClient({
      singleDataByTable: {
        profiles: { id: 'u1', display_name: 'Jonathan' },
      },
    });
    UserService._setClientForTests(fakeClient);
    const data = await UserService.getProfile('u1');
    assert.deepEqual(data, { id: 'u1', display_name: 'Jonathan' });
  });
});
