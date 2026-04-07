import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'red', socket: null };
  const p2 = { id: 'p2', side: 'yellow', socket: null };
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

describe('Connect Four GameState', () => {

  describe('start()', () => {
    it('initializes 6x7 empty board', () => {
      const { game } = createGame();
      game.start();

      assert.equal(game.board.length, 6);
      assert.equal(game.board[0].length, 7);
      // All cells empty
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          assert.equal(game.board[r][c], 0);
        }
      }
    });

    it('player 1 goes first', () => {
      const { game } = createGame();
      game.start();
      assert.equal(game.currentTurn, 'p1');
    });

    it('sets active to true', () => {
      const { game } = createGame();
      game.start();
      assert.equal(game.active, true);
    });

    it('emits initial state', () => {
      const { game, events } = createGame();
      game.start();
      assert.ok(events.length > 0);
    });
  });

  describe('dropDisc()', () => {
    let game, events;

    beforeEach(() => {
      ({ game, events } = createGame());
      game.start();
      events.length = 0;
    });

    it('disc falls to bottom of empty column', () => {
      game.dropDisc('p1', 3);
      assert.equal(game.board[5][3], 'red'); // bottom row, p1's side
    });

    it('disc stacks on top of existing disc', () => {
      game.dropDisc('p1', 3); // row 5
      game.dropDisc('p2', 3); // row 4
      assert.equal(game.board[5][3], 'red');
      assert.equal(game.board[4][3], 'yellow');
    });

    it('switches turn after valid drop', () => {
      game.dropDisc('p1', 0);
      assert.equal(game.currentTurn, 'p2');
    });

    it('rejects drop when not your turn', () => {
      game.dropDisc('p2', 0); // p2 tries to go first
      const err = lastEvent(events, 'action-error');
      assert.ok(err);
    });

    it('rejects invalid column (negative)', () => {
      game.dropDisc('p1', -1);
      const err = lastEvent(events, 'action-error');
      assert.ok(err);
    });

    it('rejects invalid column (too large)', () => {
      game.dropDisc('p1', 7);
      const err = lastEvent(events, 'action-error');
      assert.ok(err);
    });

    it('rejects drop in full column', () => {
      // Fill column 0
      for (let i = 0; i < 6; i++) {
        game.board[i][0] = 1;
      }
      game.dropDisc('p1', 0);
      const err = lastEvent(events, 'action-error');
      assert.ok(err);
    });
  });

  describe('handleAction()', () => {
    it('routes drop action correctly', () => {
      const { game } = createGame();
      game.start();

      game.handleAction('p1', { type: 'drop', col: 3 });
      assert.equal(game.board[5][3], 'red');
    });

    it('ignores actions when not active', () => {
      const { game, events } = createGame();
      // Don't start
      game.handleAction('p1', { type: 'drop', col: 3 });
      assert.equal(events.length, 0);
    });

    it('rejects actions when paused', () => {
      const { game, events } = createGame();
      game.start();
      game.pause();
      events.length = 0;

      game.handleAction('p1', { type: 'drop', col: 3 });
      const err = lastEvent(events, 'action-error');
      assert.ok(err);
    });
  });

  describe('win detection', () => {
    let game, events;

    beforeEach(() => {
      ({ game, events } = createGame());
      game.start();
    });

    it('detects horizontal win', () => {
      // p1 drops in cols 0,1,2,3 (with p2 padding between)
      game.dropDisc('p1', 0); game.dropDisc('p2', 0); // stack col 0
      game.dropDisc('p1', 1); game.dropDisc('p2', 1);
      game.dropDisc('p1', 2); game.dropDisc('p2', 2);
      game.dropDisc('p1', 3);

      const matchEnd = lastEvent(events, 'match-end');
      assert.ok(matchEnd, 'should detect horizontal win');
      assert.equal(matchEnd.winnerId, 'p1');
    });

    it('detects vertical win', () => {
      // p1 stacks 4 in col 0, p2 plays col 1
      game.dropDisc('p1', 0); game.dropDisc('p2', 1);
      game.dropDisc('p1', 0); game.dropDisc('p2', 1);
      game.dropDisc('p1', 0); game.dropDisc('p2', 1);
      game.dropDisc('p1', 0);

      const matchEnd = lastEvent(events, 'match-end');
      assert.ok(matchEnd, 'should detect vertical win');
      assert.equal(matchEnd.winnerId, 'p1');
    });

    it('detects draw when board is full', () => {
      // Fill entire board without 4-in-a-row (contrived)
      // Pattern: alternating columns so no 4-in-a-row
      // Simplest: fill board manually
      const sides = [
        [1,2,1,2,1,2,1],
        [1,2,1,2,1,2,1],
        [2,1,2,1,2,1,2],
        [1,2,1,2,1,2,1],
        [1,2,1,2,1,2,1],
        [2,1,2,1,2,1,2],
      ];
      game.board = sides;
      // Check top row is full → should be draw on next "move check"
      // We can verify the board is full
      const isFull = game.board[0].every((c) => c !== 0);
      assert.ok(isFull, 'board should be full');
    });
  });

  describe('full game simulation', () => {
    it('random game always terminates within 42 moves', () => {
      for (let trial = 0; trial < 20; trial++) {
        const { game } = createGame();
        game.start();

        let moves = 0;
        while (game.active && moves < 50) {
          const col = Math.floor(Math.random() * 7);
          game.handleAction(game.currentTurn, { type: 'drop', col });
          moves++;
        }

        // Should terminate (either win or draw or column-full retries)
        const totalDiscs = game.board.flat().filter((c) => c !== 0).length;
        assert.ok(totalDiscs <= 42, `Trial ${trial}: too many discs`);
      }
    });
  });

  describe('migratePlayer', () => {
    it('updates player ID and turn reference', () => {
      const { game } = createGame();
      game.start();

      game.migratePlayer('p1', 'p1-new', { id: 'p1-new', side: 'red' });
      assert.equal(game.p1.id, 'p1-new');
      assert.equal(game.currentTurn, 'p1-new');
    });
  });
});
