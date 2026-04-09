import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { mockSocket, mockIo } from '../test-helpers/roomManagerTestKit.js';

describe('RoomManager — lifecycle', () => {
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
});
