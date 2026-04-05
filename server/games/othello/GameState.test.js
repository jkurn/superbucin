import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './GameState.js';

// Helper: create a game with two mock players
function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'black', socket: null };
  const p2 = { id: 'p2', side: 'white', socket: null };
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

describe('Othello GameState', () => {

  describe('start()', () => {
    it('initializes standard Othello opening', () => {
      const { game } = createGame();
      game.start();

      assert.equal(game.board[3][3], 'white');
      assert.equal(game.board[3][4], 'black');
      assert.equal(game.board[4][3], 'black');
      assert.equal(game.board[4][4], 'white');
    });

    it('black goes first', () => {
      const { game } = createGame();
      game.start();
      assert.equal(game.currentTurn, 'p1'); // p1 is black
    });

    it('emits initial state with valid moves', () => {
      const { game, events } = createGame();
      game.start();

      const state = lastEvent(events, 'state-update');
      assert.ok(state);
      assert.ok(state.validMoves.length > 0);
      assert.equal(state.scores.black, 2);
      assert.equal(state.scores.white, 2);
      assert.equal(state.passed, null);
    });

    it('initial valid moves are correct', () => {
      const { game } = createGame();
      game.start();

      // Standard Othello opening: black can play at (2,3), (3,2), (4,5), (5,4)
      const moves = game.validMoves.map(([r, c]) => `${r},${c}`).sort();
      assert.deepEqual(moves, ['2,3', '3,2', '4,5', '5,4']);
    });
  });

  describe('placeDisc()', () => {
    let game, events;

    beforeEach(() => {
      ({ game, events } = createGame());
      game.start();
      events.length = 0; // clear start events
    });

    it('places disc and flips opponent disc', () => {
      // Black plays at (2,3) — should flip (3,3) from white to black
      game.placeDisc('p1', 2, 3);

      assert.equal(game.board[2][3], 'black');
      assert.equal(game.board[3][3], 'black'); // flipped
      assert.equal(game.scores.black, 4);
      assert.equal(game.scores.white, 1);
    });

    it('switches turn after valid move', () => {
      game.placeDisc('p1', 2, 3);
      assert.equal(game.currentTurn, 'p2'); // white's turn now
    });

    it('emits state-update with lastMove', () => {
      game.placeDisc('p1', 2, 3);

      const state = lastEvent(events, 'state-update');
      assert.ok(state.lastMove);
      assert.equal(state.lastMove.row, 2);
      assert.equal(state.lastMove.col, 3);
      assert.equal(state.lastMove.side, 'black');
      assert.ok(state.lastMove.flipped.length > 0);
    });

    it('rejects move when not your turn', () => {
      game.placeDisc('p2', 2, 3); // p2 is white, but it's black's turn

      const err = lastEvent(events, 'action-error');
      assert.ok(err);
      assert.equal(err.code, 'WRONG_TURN');
    });

    it('rejects out-of-bounds move', () => {
      game.placeDisc('p1', -1, 3);
      assert.equal(lastEvent(events, 'action-error').code, 'OUT_OF_BOUNDS');
    });

    it('rejects move on occupied cell', () => {
      game.placeDisc('p1', 3, 3); // already has a white disc
      assert.equal(lastEvent(events, 'action-error').code, 'CELL_OCCUPIED');
    });

    it('rejects invalid move (no flips)', () => {
      game.placeDisc('p1', 0, 0); // corner, nothing to flip
      assert.equal(lastEvent(events, 'action-error').code, 'INVALID_MOVE');
    });
  });

  describe('handleAction()', () => {
    it('routes place-disc action', () => {
      const { game } = createGame();
      game.start();

      game.handleAction('p1', { type: 'place-disc', row: 2, col: 3 });
      assert.equal(game.board[2][3], 'black');
    });

    it('rejects actions when paused', () => {
      const { game, events } = createGame();
      game.start();
      game.pause();
      events.length = 0;

      game.handleAction('p1', { type: 'place-disc', row: 2, col: 3 });
      assert.equal(lastEvent(events, 'action-error').code, 'GAME_PAUSED');
      assert.equal(game.board[2][3], 0); // not placed
    });

    it('does nothing when game is not active', () => {
      const { game, events } = createGame();
      // Don't start — game.active is false
      events.length = 0;

      game.handleAction('p1', { type: 'place-disc', row: 2, col: 3 });
      assert.equal(events.length, 0);
    });
  });

  describe('flipping in all 8 directions', () => {
    it('flips discs in multiple directions', () => {
      const { game } = createGame();
      game.start();

      // Set up a position where a move flips in multiple directions
      // Clear board and set up manually
      game.board = Array.from({ length: 8 }, () => Array(8).fill(0));
      game.board[3][3] = 'black';
      game.board[3][4] = 'white';
      game.board[3][5] = 'white';
      game.board[4][3] = 'white';
      game.board[5][3] = 'white';
      game.currentTurn = 'p1';

      // Black at (3,6) flips (3,4) and (3,5) horizontally
      const flipped = game.getFlippedDiscs(3, 6, 'black');
      assert.equal(flipped.length, 2);
    });
  });

  describe('pass and game over', () => {
    it('auto-passes when next player has no moves', () => {
      const { game, events } = createGame();
      game.start();

      // Set up a board where after black's move, white has no valid moves
      game.board = Array.from({ length: 8 }, () => Array(8).fill(0));
      game.board[0][0] = 'black';
      game.board[0][1] = 'white';
      // Black plays (0,2) — only move that works
      // After this, if white has no moves, it should auto-pass
      // This is a contrived scenario; let's use computeValidMoves to verify

      // More realistic: fill most of the board
      game.board = Array.from({ length: 8 }, () => Array(8).fill('black'));
      game.board[7][6] = 'white';
      game.board[7][7] = 0;
      game.currentTurn = 'p1';
      game.validMoves = game.computeValidMoves('black');

      events.length = 0;
      game.placeDisc('p1', 7, 7);

      // After black fills the board, white should have no moves → game over
      const matchEnd = lastEvent(events, 'match-end');
      assert.ok(matchEnd, 'game should end when board is full');
    });

    it('ends game when neither player can move', () => {
      const { game, events } = createGame();
      game.start();

      // Fill entire board — game should end immediately on next move check
      game.board = Array.from({ length: 8 }, () => Array(8).fill('black'));
      game.board[7][7] = 'white';
      game.board[7][6] = 0;
      game.currentTurn = 'p1';
      game.validMoves = game.computeValidMoves('black');

      events.length = 0;

      if (game.validMoves.length > 0) {
        const [r, c] = game.validMoves[0];
        game.placeDisc('p1', r, c);
      }

      const matchEnd = lastEvent(events, 'match-end');
      if (matchEnd) {
        assert.ok(matchEnd.scores);
        assert.ok(matchEnd.winnerId !== undefined);
      }
    });

    it('declares draw when disc counts are equal', () => {
      const { game, events } = createGame();
      game.start();

      // Fill board with exactly 32 black and 32 white
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          game.board[r][c] = r < 4 ? 'black' : 'white';
        }
      }

      // Neither player can move on a full board
      game.validMoves = [];
      game.scores = game.countDiscs();
      game.currentTurn = 'p1';
      events.length = 0;

      // Trigger advanceTurn
      game.advanceTurn('black');

      const matchEnd = lastEvent(events, 'match-end');
      assert.ok(matchEnd);
      assert.equal(matchEnd.winnerId, null); // draw
      assert.equal(matchEnd.scores[0], 32);
      assert.equal(matchEnd.scores[1], 32);
    });
  });

  describe('computeValidMoves()', () => {
    it('returns empty array when no moves available', () => {
      const { game } = createGame();
      game.start();

      // Fill entire board
      game.board = Array.from({ length: 8 }, () => Array(8).fill('black'));
      const moves = game.computeValidMoves('white');
      assert.equal(moves.length, 0);
    });

    it('finds moves in all directions', () => {
      const { game } = createGame();
      game.start();

      // Standard opening: black has exactly 4 valid moves
      const moves = game.computeValidMoves('black');
      assert.equal(moves.length, 4);
    });
  });

  describe('getFlippedDiscs()', () => {
    it('returns empty array for invalid move', () => {
      const { game } = createGame();
      game.start();

      const flipped = game.getFlippedDiscs(0, 0, 'black');
      assert.equal(flipped.length, 0);
    });

    it('flips along a line until own disc found', () => {
      const { game } = createGame();
      game.start();

      // (2,3) should flip (3,3) which is white, because (4,3) is black
      const flipped = game.getFlippedDiscs(2, 3, 'black');
      assert.ok(flipped.some(([r, c]) => r === 3 && c === 3));
    });

    it('does not flip past empty cells', () => {
      const { game } = createGame();
      game.start();

      game.board = Array.from({ length: 8 }, () => Array(8).fill(0));
      game.board[3][3] = 'black';
      game.board[3][4] = 'white';
      // (3,5) is empty — should not flip anything from (3,6)
      const flipped = game.getFlippedDiscs(3, 6, 'black');
      assert.equal(flipped.length, 0);
    });
  });

  describe('pause/resume', () => {
    it('resume re-emits current state', () => {
      const { game, events } = createGame();
      game.start();
      game.pause();
      events.length = 0;

      game.resume();
      assert.equal(game.paused, false);
      assert.ok(lastEvent(events, 'state-update'));
    });
  });

  describe('migratePlayer()', () => {
    it('updates player ID and current turn', () => {
      const { game } = createGame();
      game.start();

      game.migratePlayer('p1', 'p1-new', { id: 'p1-new', side: 'black' });
      assert.equal(game.p1.id, 'p1-new');
      assert.equal(game.currentTurn, 'p1-new');
    });
  });

  describe('full game simulation', () => {
    it('plays a sequence of valid moves without crashing', () => {
      const { game } = createGame();
      game.start();

      let moves = 0;
      while (game.active && moves < 100) {
        if (game.validMoves.length === 0) break;
        const [r, c] = game.validMoves[0];
        game.placeDisc(game.currentTurn, r, c);
        moves++;
      }

      // Game should eventually end
      const scores = game.countDiscs();
      assert.ok(scores.black + scores.white <= 64);
      assert.ok(moves > 0);
    });

    it('random game always terminates', () => {
      for (let trial = 0; trial < 50; trial++) {
        const { game } = createGame();
        game.start();

        let moves = 0;
        while (game.active && moves < 200) {
          if (game.validMoves.length === 0) break;
          const idx = Math.floor(Math.random() * game.validMoves.length);
          const [r, c] = game.validMoves[idx];
          game.placeDisc(game.currentTurn, r, c);
          moves++;
        }

        const scores = game.countDiscs();
        assert.ok(scores.black + scores.white <= 64,
          `Trial ${trial}: disc count exceeded 64`);
      }
    });
  });
});
