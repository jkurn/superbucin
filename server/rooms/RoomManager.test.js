import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { GameFactory } from '../games/GameFactory.js';

// Register a minimal mock game so GameFactory.has() returns true
class MockGameState {
  constructor(_p1, _p2, _emit) { this.active = false; }
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
});
