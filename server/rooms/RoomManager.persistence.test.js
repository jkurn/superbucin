import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { UserService } from '../services/UserService.js';
import { mockSocket, mockIo } from '../test-helpers/roomManagerTestKit.js';

describe('RoomManager — persistence', () => {
  let rm, io;

  beforeEach(() => {
    io = mockIo();
    rm = new RoomManager(io);
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
