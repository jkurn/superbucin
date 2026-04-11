import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './RoomManager.js';
import { mockSocket, mockIo } from '../test-helpers/roomManagerTestKit.js';
import {
  assertRequiredKeys,
  assertAllowedKeysOnly,
} from '../test-helpers/payloadShape.js';
import {
  STICKER_HIT_STATE_VIEW_OPPONENT_KEYS,
  STICKER_HIT_STATE_VIEW_STAGE_KEYS,
  STICKER_HIT_STATE_VIEW_TOP_KEYS,
  STICKER_HIT_STATE_VIEW_YOU_KEYS,
} from '../../shared/sticker-hit/stickerHitStateViewKeys.js';

function mkStickerHitStageSlice(stageIndex) {
  return {
    stageIndex,
    isBoss: false,
    stickersTotal: 2,
    stickersRemaining: 2,
    obstacleStickers: [],
    stuckStickers: [],
    ringApples: [],
    timeline: { startedAt: 0, initialAngle: 0, segments: [{ atMs: 0, dps: 0 }] },
  };
}

function mkStickerHitWireSlice({ myStage, oppStage, myApples, oppApples }) {
  return {
    gameType: 'sticker-hit',
    phase: 'playing',
    serverNow: 1000,
    countdownMsRemaining: 0,
    totalStages: 5,
    collisionDegrees: 10,
    skins: [],
    you: {
      crashed: false,
      finished: false,
      stageIndex: myStage,
      apples: myApples,
      bossSkinUnlocked: false,
      stageBreakSeq: 0,
      throwFx: null,
      throwFxSeq: 0,
      ownedSkinIds: [],
      equippedSkinId: null,
      stage: mkStickerHitStageSlice(myStage),
    },
    opponent: {
      crashed: false,
      finished: false,
      stageIndex: oppStage,
      apples: oppApples,
      bossSkinUnlocked: false,
      stageBreakSeq: 0,
      equippedSkinId: null,
      stage: mkStickerHitStageSlice(oppStage),
    },
  };
}

describe('RoomManager — handleGameEvent contracts', () => {
  let rm, io;

  beforeEach(() => {
    io = mockIo();
    rm = new RoomManager(io);
  });

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
      assertRequiredKeys(host.lastEmit('memory-state'), ['secret'], 'host memory-state');
      assertAllowedKeysOnly(host.lastEmit('memory-state'), ['secret'], 'host memory-state');
      assertRequiredKeys(joiner.lastEmit('memory-state'), ['secret'], 'joiner memory-state');
      assertAllowedKeysOnly(joiner.lastEmit('memory-state'), ['secret'], 'joiner memory-state');
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
      assertAllowedKeysOnly(host.lastEmit('battleship-state'), ['hiddenShips'], 'host battleship-state');
      assertAllowedKeysOnly(joiner.lastEmit('battleship-state'), ['hiddenShips'], 'joiner battleship-state');
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
      assertAllowedKeysOnly(host.lastEmit('vending-state'), ['money'], 'host vending-state');
      assertAllowedKeysOnly(joiner.lastEmit('vending-state'), ['money'], 'joiner vending-state');
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
      assertAllowedKeysOnly(host.lastEmit('bonk-state'), ['hp'], 'host bonk-state');
      assertAllowedKeysOnly(joiner.lastEmit('bonk-state'), ['hp'], 'joiner bonk-state');
      assertAllowedKeysOnly(host.lastEmit('cute-aggression-state'), ['combo'], 'host cute-aggression-state');
      assertAllowedKeysOnly(joiner.lastEmit('cute-aggression-state'), ['combo'], 'joiner cute-aggression-state');
    });

    it('routes sticker-hit-state as per-player slices only', async () => {
      const host = mockSocket('host');
      rm.createRoom(host, { gameType: 'memory-match' });
      const code = host.lastEmit('room-created').roomCode;
      const joiner = mockSocket('joiner');
      rm.joinRoom(joiner, code);
      const room = rm.rooms.get(code);

      const hostSlice = mkStickerHitWireSlice({
        myStage: 2, oppStage: 1, myApples: 3, oppApples: 0,
      });
      const joinerSlice = mkStickerHitWireSlice({
        myStage: 1, oppStage: 2, myApples: 0, oppApples: 3,
      });

      await rm.handleGameEvent(room, 'sticker-hit-state', {
        byPlayer: {
          host: hostSlice,
          joiner: joinerSlice,
        },
      });

      assert.deepEqual(host.lastEmit('sticker-hit-state'), hostSlice);
      assert.deepEqual(joiner.lastEmit('sticker-hit-state'), joinerSlice);

      const assertStickerHitSliceShape = (slice, label) => {
        assertRequiredKeys(slice, STICKER_HIT_STATE_VIEW_TOP_KEYS, label);
        assertAllowedKeysOnly(slice, STICKER_HIT_STATE_VIEW_TOP_KEYS, label);
        assertRequiredKeys(slice.you, STICKER_HIT_STATE_VIEW_YOU_KEYS, `${label}.you`);
        assertAllowedKeysOnly(slice.you, STICKER_HIT_STATE_VIEW_YOU_KEYS, `${label}.you`);
        assertRequiredKeys(slice.opponent, STICKER_HIT_STATE_VIEW_OPPONENT_KEYS, `${label}.opponent`);
        assertAllowedKeysOnly(slice.opponent, STICKER_HIT_STATE_VIEW_OPPONENT_KEYS, `${label}.opponent`);
        assertRequiredKeys(slice.you.stage, STICKER_HIT_STATE_VIEW_STAGE_KEYS, `${label}.you.stage`);
        assertAllowedKeysOnly(slice.you.stage, STICKER_HIT_STATE_VIEW_STAGE_KEYS, `${label}.you.stage`);
        assertRequiredKeys(slice.opponent.stage, STICKER_HIT_STATE_VIEW_STAGE_KEYS, `${label}.opponent.stage`);
        assertAllowedKeysOnly(slice.opponent.stage, STICKER_HIT_STATE_VIEW_STAGE_KEYS, `${label}.opponent.stage`);
      };
      assertStickerHitSliceShape(host.lastEmit('sticker-hit-state'), 'host sticker-hit-state');
      assertStickerHitSliceShape(joiner.lastEmit('sticker-hit-state'), 'joiner sticker-hit-state');
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
});
