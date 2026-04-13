import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { mockSocket, mockIo } from '../test-helpers/roomManagerTestKit.js';

describe('RoomManager — reconnect & disconnect branches', () => {
  let rm, io;

  beforeEach(() => {
    io = mockIo();
    rm = new RoomManager(io);
  });

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

    it('rejoin sticker-hit playing invokes migrateReconnectSocket with old and new socket ids', () => {
      const host = mockSocket('host');
      const joiner = mockSocket('joiner');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.gameType = 'sticker-hit';
      room.state = 'playing';
      room.players[0].disconnected = true;
      const migrateCalls = [];
      room.game = {
        p1: room.players[0],
        p2: room.players[1],
        stateByPlayer: { host: { apples: 5 } },
        migrateReconnectSocket: (oldId, newId) => {
          migrateCalls.push([oldId, newId]);
        },
        resume: () => {},
      };

      const re = mockSocket('host-new');
      rm.rejoinRoom(re, code);
      assert.deepEqual(migrateCalls, [['host', 'host-new']]);
    });

    it('rejoin sticker-mash-duel playing invokes migrateReconnectSocket with old and new socket ids', () => {
      const host = mockSocket('host');
      const joiner = mockSocket('joiner');
      rm.createRoom(host, { gameType: 'othello' });
      const code = host.lastEmit('room-created').roomCode;
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);
      room.gameType = 'sticker-mash-duel';
      room.state = 'playing';
      room.players[0].disconnected = true;
      const migrateCalls = [];
      room.game = {
        p1: room.players[0],
        p2: room.players[1],
        stateByPlayer: { host: { score: 5 } },
        migrateReconnectSocket: (oldId, newId) => {
          migrateCalls.push([oldId, newId]);
        },
        resume: () => {},
      };

      const re = mockSocket('host-new');
      rm.rejoinRoom(re, code);
      assert.deepEqual(migrateCalls, [['host', 'host-new']]);
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
});
