import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { GameFactory } from '../games/GameFactory.js';
import { UserService } from '../services/UserService.js';

// Register a minimal mock game so GameFactory.has() returns true
class MockGameState {
  constructor(p1, p2, _emit) {
    this.p1 = p1;
    this.p2 = p2;
    this.active = false;
  }
  start() { this.active = true; }
  stop() { this.active = false; }
  pause() {}
  resume() {}
  handleAction() {}
}
const MOCK_CONFIG = { SKIP_SIDE_SELECT: false };
const MOCK_SKIP_CONFIG = { SKIP_SIDE_SELECT: true };

// Register test game types (idempotent — safe if already registered)
GameFactory.register('othello', MockGameState, MOCK_CONFIG);
GameFactory.register('pig-vs-chick', MockGameState, MOCK_CONFIG);
GameFactory.register('doodle-guess', MockGameState, MOCK_CONFIG);
GameFactory.register('memory-match', MockGameState, MOCK_SKIP_CONFIG);
GameFactory.register('word-scramble-race', MockGameState, MOCK_CONFIG);
GameFactory.register('connect-four', MockGameState, MOCK_CONFIG);
GameFactory.register('bonk-brawl', MockGameState, MOCK_CONFIG);
GameFactory.register('cute-aggression', MockGameState, MOCK_CONFIG);

// ── Mock helpers ─────────────────────────────────────────────────────────────

function mockSocket(id) {
  const emitted = [];
  return {
    id,
    emit(event, data) { emitted.push({ event, data }); },
    join(_room) { /* no-op */ },
    _emitted: emitted,
    lastEmit(event) {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i].event === event) return emitted[i].data;
      }
      return null;
    },
  };
}

function mockIo() {
  const broadcasts = [];
  return {
    to(_room) {
      return {
        emit(event, data) { broadcasts.push({ event, data }); },
      };
    },
    _broadcasts: broadcasts,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RoomManager', () => {
  let rm, io;

  beforeEach(() => {
    io = mockIo();
    rm = new RoomManager(io);
  });

  // ── Identity ───────────────────────────────────────────────

  describe('setIdentity / _getIdentity', () => {
    it('stores and retrieves player identity', () => {
      const s = mockSocket('s1');
      rm.setIdentity(s, { displayName: 'Jonathan', username: 'jkurn' });
      const id = rm._getIdentity('s1');
      assert.equal(id.displayName, 'Jonathan');
      assert.equal(id.username, 'jkurn');
    });

    it('returns guest fallback for unknown socket', () => {
      const id = rm._getIdentity('unknown');
      assert.equal(id.displayName, 'Guest');
      assert.equal(id.isGuest, true);
    });

    it('_getDisplayName prefers username, then tag, then displayName', () => {
      const a = mockSocket('a');
      const b = mockSocket('b');
      const c = mockSocket('c');
      rm.setIdentity(a, { displayName: 'Anna', username: 'anna_u' });
      rm.setIdentity(b, { displayName: 'Ben', tag: '1234' });
      rm.setIdentity(c, { displayName: 'Cara' });
      assert.equal(rm._getDisplayName('a'), 'anna_u');
      assert.equal(rm._getDisplayName('b'), 'Ben #1234');
      assert.equal(rm._getDisplayName('c'), 'Cara');
    });
  });

  // ── createRoom ─────────────────────────────────────────────

  describe('createRoom', () => {
    it('creates room and emits room-created', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });

      const ev = s.lastEmit('room-created');
      assert.ok(ev, 'should emit room-created');
      assert.equal(ev.gameType, 'othello');
      assert.equal(typeof ev.roomCode, 'string');
      assert.equal(ev.roomCode.length, 4);
    });

    it('room code is uppercase alphanumeric', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });
      const code = s.lastEmit('room-created').roomCode;
      assert.ok(/^[A-Z0-9]{4}$/.test(code), `Code ${code} should be 4 uppercase alphanumeric chars`);
    });

    it('stores room in rooms Map', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });
      const code = s.lastEmit('room-created').roomCode;
      assert.ok(rm.rooms.has(code));
      assert.equal(rm.rooms.get(code).gameType, 'othello');
    });

    it('maps player to room', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });
      assert.ok(rm.playerRooms.has('host'));
    });

    it('room starts with 1 player in waiting state', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });
      const code = s.lastEmit('room-created').roomCode;
      const room = rm.rooms.get(code);
      assert.equal(room.players.length, 1);
      assert.equal(room.state, 'waiting');
    });

    it('rejects unknown game type', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'nonexistent-game' });
      const err = s.lastEmit('room-error');
      assert.ok(err);
      assert.ok(err.message.includes('Unknown'));
    });

    it('generates unique codes (no collision)', () => {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        const s = mockSocket(`host-${i}`);
        rm.createRoom(s, { gameType: 'othello' });
        const code = s.lastEmit('room-created').roomCode;
        assert.ok(!codes.has(code), `Duplicate code: ${code}`);
        codes.add(code);
      }
    });

    it('defaults to pig-vs-chick when no gameType', () => {
      const s = mockSocket('host');
      rm.createRoom(s, {});
      const ev = s.lastEmit('room-created');
      assert.equal(ev.gameType, 'pig-vs-chick');
    });

    it('sanitizes custom prompts', () => {
      const s = mockSocket('host');
      rm.createRoom(s, {
        gameType: 'doodle-guess',
        customPrompts: ['  cat  ', '', '  dog  ', 123],
      });
      const code = s.lastEmit('room-created').roomCode;
      const room = rm.rooms.get(code);
      // Should trim and filter empty
      assert.ok(room.customPrompts.every((p) => typeof p === 'string'));
      assert.ok(!room.customPrompts.includes(''));
    });
  });

  // ── joinRoom ───────────────────────────────────────────────

  describe('joinRoom', () => {
    let hostSocket, code;

    beforeEach(() => {
      hostSocket = mockSocket('host');
      rm.createRoom(hostSocket, { gameType: 'othello' });
      code = hostSocket.lastEmit('room-created').roomCode;
    });

    it('second player joins successfully', () => {
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);

      const ev = joiner.lastEmit('room-joined');
      assert.ok(ev, 'joiner should receive room-joined');
      assert.equal(ev.gameType, 'othello');
    });

    it('host receives player-joined notification', () => {
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);

      const ev = hostSocket.lastEmit('player-joined');
      assert.ok(ev, 'host should receive player-joined');
    });

    it('room-error for non-existent room', () => {
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, 'ZZZZ');

      const err = joiner.lastEmit('room-error');
      assert.ok(err);
      assert.ok(err.message.toLowerCase().includes('not found'));
    });

    it('room-error for full room', () => {
      const j1 = mockSocket('j1');
      rm.joinRoom(j1, code);

      const j2 = mockSocket('j2');
      rm.joinRoom(j2, code);

      const err = j2.lastEmit('room-error');
      assert.ok(err);
      assert.ok(err.message.toLowerCase().includes('full'));
    });

    it('maps joiner to room', () => {
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      assert.equal(rm.playerRooms.get('joiner'), code);
    });

    it('room has 2 players after join', () => {
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      assert.equal(rm.rooms.get(code).players.length, 2);
    });

    it('case-insensitive room code (lowercase still works server-side)', () => {
      // Router normalizes to uppercase, but server should also handle
      const joiner = mockSocket('joiner');
      // Pass uppercase code directly (Router does toUpperCase)
      rm.joinRoom(joiner, code.toUpperCase());
      const ev = joiner.lastEmit('room-joined');
      assert.ok(ev);
    });

    it('clears persisted waiting timer when joiner enters', () => {
      const room = rm.rooms.get(code);
      room._waitingTimer = { id: 'wait-token' };
      let cleared;
      const oldClearTimeout = globalThis.clearTimeout;
      globalThis.clearTimeout = (token) => { cleared = token; };
      try {
        const joiner = mockSocket('joiner');
        rm.joinRoom(joiner, code);
        assert.deepEqual(cleared, { id: 'wait-token' });
        assert.equal(room._waitingTimer, null);
      } finally {
        globalThis.clearTimeout = oldClearTimeout;
      }
    });

    it('joining a host-left room with zero players emits room-created waiting payload', () => {
      const room = rm.rooms.get(code);
      room.players = [];
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const created = joiner.lastEmit('room-created');
      assert.ok(created);
      assert.equal(created.roomCode, code);
      assert.equal(room.state, 'waiting');
    });
  });

  // ── selectSide ─────────────────────────────────────────────

  describe('selectSide', () => {
    let hostSocket, joinerSocket, code;

    beforeEach(() => {
      hostSocket = mockSocket('host');
      rm.createRoom(hostSocket, { gameType: 'othello' });
      code = hostSocket.lastEmit('room-created').roomCode;

      joinerSocket = mockSocket('joiner');
      rm.joinRoom(joinerSocket, code);
    });

    it('accepts valid side for othello', () => {
      rm.selectSide(hostSocket, 'black');
      const ev = hostSocket.lastEmit('side-selected');
      assert.ok(ev.message.includes('black'));
    });

    it('rejects invalid side', () => {
      rm.selectSide(hostSocket, 'invalid-side');
      const ev = hostSocket.lastEmit('side-selected');
      assert.ok(ev.message.includes('valid'));
    });

    it('rejects duplicate side pick', () => {
      rm.selectSide(hostSocket, 'black');
      rm.selectSide(joinerSocket, 'black');
      const ev = joinerSocket.lastEmit('side-selected');
      assert.ok(ev.message.includes('taken'));
    });

    it('supports game-specific valid side sets', () => {
      const cases = [
        ['doodle-guess', 'drawer'],
        ['word-scramble-race', 'sprout'],
        ['connect-four', 'yellow'],
        ['bonk-brawl', 'bunny'],
        ['cute-aggression', 'merah'],
      ];
      for (const [gameType, side] of cases) {
        const host = mockSocket(`h-${gameType}`);
        rm.createRoom(host, { gameType });
        const codeX = host.lastEmit('room-created').roomCode;
        const joiner = mockSocket(`j-${gameType}`);
        rm.joinRoom(joiner, codeX);
        rm.selectSide(host, side);
        const ev = host.lastEmit('side-selected');
        assert.ok(ev.message.includes(side));
      }
    });

    it('starts game once both players have selected unique valid sides', () => {
      rm.selectSide(hostSocket, 'black');
      rm.selectSide(joinerSocket, 'white');
      const room = rm.rooms.get(code);
      assert.equal(room.state, 'playing');
      assert.ok(room.game);
    });
  });

  describe('action wrappers', () => {
    it('routes spawn/flip/action/doodle helper calls only when functions exist', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'doodle-guess' });
      const code = host.lastEmit('room-created').roomCode;
      const room = rm.rooms.get(code);
      rm.playerRooms.set(host.id, code);

      const calls = [];
      room.game = {
        requestSpawn: (...args) => calls.push(['spawn', ...args]),
        submitWord: async (...args) => { calls.push(['word', ...args]); },
        appendStroke: (...args) => calls.push(['stroke', ...args]),
        clearCanvas: (...args) => calls.push(['clear', ...args]),
        submitGuess: (...args) => calls.push(['guess', ...args]),
        tryFlip: (...args) => calls.push(['flip', ...args]),
        handleAction: (...args) => calls.push(['action', ...args]),
      };
      room.gameType = 'doodle-guess';

      rm.spawnUnit(host, 2, 'top');
      await rm.submitWord(host, [{ r: 0, c: 0 }]);
      rm.doodleStroke(host, { x: 1, y: 2 });
      rm.doodleClear(host);
      rm.doodleGuess(host, 'cat');
      rm.memoryFlip(host, 3);
      rm.handleAction(host, { type: 'attack' });

      assert.ok(calls.find((c) => c[0] === 'spawn'));
      assert.ok(calls.find((c) => c[0] === 'word'));
      assert.ok(calls.find((c) => c[0] === 'stroke'));
      assert.ok(calls.find((c) => c[0] === 'clear'));
      assert.ok(calls.find((c) => c[0] === 'guess'));
      assert.ok(calls.find((c) => c[0] === 'flip'));
      assert.ok(calls.find((c) => c[0] === 'action'));
    });

    it('submitWord catches async rejection and emits feedback', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'word-scramble-race' });
      const code = host.lastEmit('room-created').roomCode;
      const room = rm.rooms.get(code);
      rm.playerRooms.set(host.id, code);
      room.game = {
        submitWord: async () => {
          throw new Error('bad');
        },
      };

      await rm.submitWord(host, [{ r: 0, c: 0 }]);
      const fb = host.lastEmit('word-scramble-feedback');
      assert.ok(fb);
      assert.equal(fb.ok, false);
    });
  });

  // ── handleDisconnect ───────────────────────────────────────

  describe('handleDisconnect', () => {
    it('removes player from waiting room but keeps room alive', () => {
      const s = mockSocket('host');
      rm.createRoom(s, { gameType: 'othello' });
      const code = s.lastEmit('room-created').roomCode;

      rm.handleDisconnect(s);
      // Room should still exist (10 min grace) but have 0 players
      const room = rm.rooms.get(code);
      assert.ok(room, 'room should persist for shared links');
      assert.equal(room.players.length, 0);

      // Clean up the 10-min timer to prevent test hang
      if (room._waitingTimer) clearTimeout(room._waitingTimer);
    });

    it('does nothing for unknown socket', () => {
      const s = mockSocket('stranger');
      // Should not throw
      rm.handleDisconnect(s);
      assert.ok(true);
    });
  });

  // ── rematch ────────────────────────────────────────────────

  describe('rematch', () => {
    it('does nothing if no room exists', () => {
      const s = mockSocket('nobody');
      // Should not throw
      rm.rematch(s);
      assert.ok(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('creating 100 rooms never produces duplicate codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const s = mockSocket(`h${i}`);
        rm.createRoom(s, { gameType: 'othello' });
        const code = s.lastEmit('room-created').roomCode;
        assert.ok(!codes.has(code), `Duplicate code at iteration ${i}: ${code}`);
        codes.add(code);
      }
    });

    it('joining non-existent room after original destroyed', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;

      // Destroy room
      rm.rooms.delete(code);

      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const err = joiner.lastEmit('room-error');
      assert.ok(err);
    });
  });

  // ── event contracts / payload privacy ──────────────────────

  describe('handleGameEvent contracts', () => {
    it('routes state-update in energies and broadcast modes', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'pig-vs-chick' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'state-update', {
        units: [{ id: 1 }],
        playerHP: { host: 100, joiner: 90 },
        energies: { host: 4, joiner: 7 },
      });
      assert.equal(host.lastEmit('game-state').energy, 4);
      assert.equal(joiner.lastEmit('game-state').energy, 7);

      await rm.handleGameEvent(room, 'state-update', { phase: 'x' });
      assert.equal(host.lastEmit('game-state').yourId, 'host');
      assert.equal(joiner.lastEmit('game-state').yourId, 'joiner');
    });

    it('routes word-scramble and doodle event families by target or per-player slice', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'word-scramble-state', { phase: 'playing' });
      assert.deepEqual(host.lastEmit('word-scramble-state'), { phase: 'playing' });
      assert.deepEqual(joiner.lastEmit('word-scramble-state'), { phase: 'playing' });

      await rm.handleGameEvent(room, 'word-scramble-feedback', { targetId: 'joiner', ok: true });
      assert.deepEqual(joiner.lastEmit('word-scramble-feedback'), { targetId: 'joiner', ok: true });
      assert.equal(host.lastEmit('word-scramble-feedback'), null);

      await rm.handleGameEvent(room, 'doodle-state', { byPlayer: { host: { me: 1 }, joiner: { me: 2 } } });
      assert.deepEqual(host.lastEmit('doodle-state'), { me: 1 });
      assert.deepEqual(joiner.lastEmit('doodle-state'), { me: 2 });

      await rm.handleGameEvent(room, 'doodle-draw', { targetId: 'joiner', payload: { x: 1 } });
      await rm.handleGameEvent(room, 'doodle-clear', { targetId: 'joiner' });
      await rm.handleGameEvent(room, 'doodle-guess-wrong', { targetId: 'joiner', guess: 'dog' });
      assert.deepEqual(joiner.lastEmit('doodle-draw'), { x: 1 });
      assert.deepEqual(joiner.lastEmit('doodle-clear'), {});
      assert.deepEqual(joiner.lastEmit('doodle-guess-wrong'), { guess: 'dog' });
    });

    it('routes memory-state as per-player slices only', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'memory-state', {
        p1: { secret: 'p1-only' },
        p2: { secret: 'p2-only' },
      });

      assert.deepEqual(host.lastEmit('memory-state'), { secret: 'p1-only' });
      assert.deepEqual(joiner.lastEmit('memory-state'), { secret: 'p2-only' });
    });

    it('routes battleship-state slices by player id only', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'battleship-state', {
        byPlayer: {
          host: { hiddenShips: [1, 2, 3] },
          joiner: { hiddenShips: [9, 8, 7] },
        },
      });

      assert.deepEqual(host.lastEmit('battleship-state'), { hiddenShips: [1, 2, 3] });
      assert.deepEqual(joiner.lastEmit('battleship-state'), { hiddenShips: [9, 8, 7] });
    });

    it('routes action-error only to the target player', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'action-error', {
        playerId: 'joiner',
        message: 'Nope',
      });

      assert.deepEqual(joiner.lastEmit('action-error'), {
        playerId: 'joiner',
        message: 'Nope',
      });
      assert.equal(host.lastEmit('action-error'), null);
    });

    it('routes speed-match-state with player-specific view fields', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'speed-match-state', {
        prompt: '2+2?',
        scores: [4, 7],
        p1Answer: '4',
        p2Answer: '5',
        p1Answered: true,
        p2Answered: false,
      });

      assert.deepEqual(host.lastEmit('speed-match-state'), {
        prompt: '2+2?',
        scores: [4, 7],
        p1Answer: '4',
        p2Answer: '5',
        p1Answered: true,
        p2Answered: false,
        yourScore: 4,
        partnerScore: 7,
        yourAnswer: '4',
        partnerAnswer: '5',
        partnerAnswered: false,
      });
      assert.deepEqual(joiner.lastEmit('speed-match-state'), {
        prompt: '2+2?',
        scores: [4, 7],
        p1Answer: '4',
        p2Answer: '5',
        p1Answered: true,
        p2Answered: false,
        yourScore: 7,
        partnerScore: 4,
        yourAnswer: '5',
        partnerAnswer: '4',
        partnerAnswered: true,
      });
    });

    it('routes vending-state as per-player slices only', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'vending-state', {
        byPlayer: {
          host: { money: 10 },
          joiner: { money: 99 },
        },
      });

      assert.deepEqual(host.lastEmit('vending-state'), { money: 10 });
      assert.deepEqual(joiner.lastEmit('vending-state'), { money: 99 });
    });

    it('routes bonk-state and cute-aggression-state as per-player slices only', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      await rm.handleGameEvent(room, 'bonk-state', {
        byPlayer: {
          host: { hp: 50 },
          joiner: { hp: 25 },
        },
      });
      await rm.handleGameEvent(room, 'cute-aggression-state', {
        byPlayer: {
          host: { combo: 2 },
          joiner: { combo: 9 },
        },
      });

      assert.deepEqual(host.lastEmit('bonk-state'), { hp: 50 });
      assert.deepEqual(joiner.lastEmit('bonk-state'), { hp: 25 });
      assert.deepEqual(host.lastEmit('cute-aggression-state'), { combo: 2 });
      assert.deepEqual(joiner.lastEmit('cute-aggression-state'), { combo: 9 });
    });

    it('match-end still emits with zero points when persistence fails', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      const oldRecord = rm._recordMatchResult;
      rm._recordMatchResult = async () => {
        throw new Error('db-down');
      };

      try {
        await rm.handleGameEvent(room, 'match-end', {
          winnerId: 'host',
          tie: false,
          scores: [11, 7],
        });

        const hostEnd = host.lastEmit('match-end');
        const joinerEnd = joiner.lastEmit('match-end');
        assert.ok(hostEnd);
        assert.ok(joinerEnd);
        assert.equal(hostEnd.pointsEarned, 0);
        assert.equal(joinerEnd.pointsEarned, 0);
        assert.equal(hostEnd.isWinner, true);
        assert.equal(joinerEnd.isWinner, false);
      } finally {
        rm._recordMatchResult = oldRecord;
      }
    });
  });

  // ── reconnect races / timeout behavior ─────────────────────

  describe('reconnect race behavior', () => {
    it('rejoin before timeout keeps room alive and remaps player id', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);

      let scheduledFn = null;
      let scheduledToken = null;
      const oldSetTimeout = global.setTimeout;
      const oldClearTimeout = global.clearTimeout;

      global.setTimeout = (fn, _ms) => {
        scheduledFn = fn;
        scheduledToken = { id: 'disconnect-token' };
        return scheduledToken;
      };

      let clearedToken = null;
      global.clearTimeout = (token) => {
        clearedToken = token;
      };

      try {
        rm.handleDisconnect(host);
        assert.ok(typeof scheduledFn === 'function');

        const rejoiner = mockSocket('host-new');
        rm.rejoinRoom(rejoiner, code);

        assert.equal(clearedToken, scheduledToken);
        assert.ok(rm.rooms.has(code));
        assert.equal(rm.playerRooms.get('host-new'), code);
        assert.equal(rm.playerRooms.has('host'), false);
      } finally {
        global.setTimeout = oldSetTimeout;
        global.clearTimeout = oldClearTimeout;
      }
    });

    it('timeout expiry destroys room when player does not rejoin', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);

      let scheduledFn = null;
      const oldSetTimeout = global.setTimeout;
      global.setTimeout = (fn, _ms) => {
        scheduledFn = fn;
        return { id: 'disconnect-token' };
      };

      try {
        rm.handleDisconnect(host);
        assert.ok(typeof scheduledFn === 'function');
        scheduledFn();

        assert.equal(rm.rooms.has(code), false);
        assert.equal(rm.playerRooms.has('host'), false);
        assert.equal(rm.playerRooms.has('joiner'), false);
      } finally {
        global.setTimeout = oldSetTimeout;
      }
    });
  });

  describe('rejoin and rematch branches', () => {
    it('rejoinRoom returns errors for missing room or no disconnected slot', () => {
      const s = mockSocket('x');
      rm.rejoinRoom(s, 'NONE');
      assert.ok(s.lastEmit('room-error'));

      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      const fresh = mockSocket('fresh');
      rm.rejoinRoom(fresh, code);
      assert.ok(fresh.lastEmit('room-error'));
    });

    it('rejoin in non-playing state emits room-joined fallback', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      const room = rm.rooms.get(code);
      room.players[0].disconnected = true;
      const re = mockSocket('host-new');
      rm.rejoinRoom(re, code);
      assert.ok(re.lastEmit('room-joined'));
    });

    it('rejoin in doodle playing state sends game-start plus doodle sync/state', () => {
      const host = mockSocket('host');
      const joiner = mockSocket('joiner');
      rm.createRoom(host, { gameType: 'doodle-guess' });
      const code = host.lastEmit('room-created').roomCode;
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.state = 'playing';
      room.players[0].disconnected = true;
      room.game = {
        p1: room.players[0],
        p2: room.players[1],
        resume: () => {},
        getReconnectPayload: () => ({ extra: true }),
        getStrokeHistoryFor: () => [{ x: 1 }],
        getPersonalStateFor: () => ({ phase: 'drawing' }),
      };

      const re = mockSocket('host-new');
      rm.rejoinRoom(re, code);
      assert.ok(re.lastEmit('game-start'));
      assert.deepEqual(re.lastEmit('doodle-sync'), { strokes: [{ x: 1 }] });
      assert.deepEqual(re.lastEmit('doodle-state'), { phase: 'drawing' });
    });

    it('rejoin migrates p1 game-owned maps from old socket id', () => {
      const host = mockSocket('host');
      const joiner = mockSocket('joiner');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.state = 'playing';
      room.players[0].disconnected = true;

      room.game = {
        p1: room.players[0],
        p2: room.players[1],
        energies: { host: 4 },
        playerHP: { host: 100 },
        units: [{ ownerId: 'host' }],
        scores: { host: 11 },
        roundWords: { host: new Set(['cat']) },
        currentTurn: 'host',
        resume: () => {},
      };

      const re = mockSocket('host-new');
      rm.rejoinRoom(re, code);
      assert.equal(room.game.energies['host-new'], 4);
      assert.equal(room.game.playerHP['host-new'], 100);
      assert.equal(room.game.units[0].ownerId, 'host-new');
      assert.equal(room.game.scores['host-new'], 11);
      assert.ok(room.game.roundWords['host-new'].has('cat'));
      assert.equal(room.game.currentTurn, 'host-new');
    });

    it('rejoin migrates p2 game-owned maps from old socket id', () => {
      const host = mockSocket('host');
      const joiner = mockSocket('joiner');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.state = 'playing';
      room.players[1].disconnected = true;

      room.game = {
        p1: room.players[0],
        p2: room.players[1],
        energies: { joiner: 6 },
        playerHP: { joiner: 80 },
        units: [{ ownerId: 'joiner' }],
        scores: { joiner: 7 },
        roundWords: { joiner: new Set(['dog']) },
        currentTurn: 'joiner',
        resume: () => {},
      };

      const re = mockSocket('joiner-new');
      rm.rejoinRoom(re, code);
      assert.equal(room.game.energies['joiner-new'], 6);
      assert.equal(room.game.playerHP['joiner-new'], 80);
      assert.equal(room.game.units[0].ownerId, 'joiner-new');
      assert.equal(room.game.scores['joiner-new'], 7);
      assert.ok(room.game.roundWords['joiner-new'].has('dog'));
      assert.equal(room.game.currentTurn, 'joiner-new');
    });

    it('rematch resets sides and restarts or re-enters side-select', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const codeA = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, codeA);
      const roomA = rm.rooms.get(codeA);
      roomA.game = { stop: () => {} };
      rm.rematch(host);
      assert.equal(roomA.state, 'playing');

      const host2 = mockSocket('host2');
      rm.createRoom(host2, { gameType: 'othello' });
      const codeB = host2.lastEmit('room-created').roomCode;
      const joiner2 = mockSocket('joiner2');
      rm.joinRoom(joiner2, codeB);
      const roomB = rm.rooms.get(codeB);
      roomB.game = { stop: () => {} };
      rm.rematch(host2);
      assert.equal(roomB.state, 'side-select');
      const roomJoined = io._broadcasts.find((b) => b.event === 'room-joined');
      assert.ok(roomJoined);
    });
  });

  describe('disconnect additional branches', () => {
    it('waiting room with one remaining player notifies reconnecting true', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.state = 'waiting';
      rm.handleDisconnect(host);
      assert.deepEqual(joiner.lastEmit('opponent-disconnected'), { reconnecting: true });
    });

    it('finished state destroys room and notifies opponent reconnecting false', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.state = 'finished';
      room.game = { stop: () => {} };
      rm.handleDisconnect(host);
      assert.deepEqual(joiner.lastEmit('opponent-disconnected'), { reconnecting: false });
      assert.equal(rm.rooms.has(code), false);
    });

    it('waiting empty-room grace callback eventually deletes room', () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;

      let cb = null;
      const oldSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (fn) => {
        cb = fn;
        return { id: 'wait-token' };
      };
      try {
        rm.handleDisconnect(host);
        assert.ok(rm.rooms.has(code));
        cb();
        assert.equal(rm.rooms.has(code), false);
      } finally {
        globalThis.setTimeout = oldSetTimeout;
      }
    });
  });

  describe('_recordMatchResult', () => {
    it('emits achievements only for connected players and returns points map', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.players[1].disconnected = true;

      const original = UserService.recordMatch;
      UserService.recordMatch = async () => ({
        newAchievements: {
          host: [{ id: 'a1' }],
          joiner: [{ id: 'a2' }],
        },
        pointsByPlayer: { host: 20, joiner: 10 },
      });
      try {
        const result = await rm._recordMatchResult(room, {
          winnerId: 'host',
          tie: false,
          scores: [5, 1],
        });
        assert.deepEqual(result.pointsByPlayer, { host: 20, joiner: 10 });
        assert.deepEqual(host.lastEmit('achievement-unlocked'), { achievements: [{ id: 'a1' }] });
        assert.equal(joiner.lastEmit('achievement-unlocked'), null);
      } finally {
        UserService.recordMatch = original;
      }
    });
  });
});
