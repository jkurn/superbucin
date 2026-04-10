export const GAME_CONFIG = {
  BOARD_SIZE: 8,
  TURN_TIME_MS: 10_000,
  TURN_STICKERS: [
    'mochiHappy',
    'mochiHeart',
    'coupleBlob',
    'pricyLaughing',
    'virtualHug',
    'pricyRocket',
    'pricyWine',
    'kangenKamu',
    'tanganBerat',
    'janganSenyum',
    'overthinking',
    'sayangilahPricy',
  ],
};

const TIMEOUT_FLAVOR_LINES = [
  'Tiny Toes says move it, cutie. Auto-move deployed.',
  'Hesitate too long and the paws take over. Auto-move!',
  'Cute aggression activated. Your turn got tiny-toed.',
  'Tick tock, sweet chaos. Tiny Toes moved for you.',
  'Too much overthinking, not enough placing. Auto-move.',
];

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.board = [];
    this.active = false;
    this.paused = false;
    this.currentTurn = null;
    this.validMoves = [];
    this.lastMove = null;
    this.scores = { black: 2, white: 2 };
    this.turnTimeMs = Number.isFinite(_roomOptions.turnTimeMs) && _roomOptions.turnTimeMs > 0
      ? _roomOptions.turnTimeMs
      : GAME_CONFIG.TURN_TIME_MS;
    this.turnDeadlineAt = null;
    this._turnTimeout = null;
    this._pausedTurnRemainingMs = null;
    this.turnStickerIndex = 0;
    this.turnStickerKey = GAME_CONFIG.TURN_STICKERS[0];
  }

  start() {
    this.active = true;
    this.paused = false;

    // Initialize 8x8 board
    this.board = Array.from({ length: 8 }, () => Array(8).fill(0));

    // Standard Othello opening: 4 discs in center
    this.board[3][3] = 'white';
    this.board[3][4] = 'black';
    this.board[4][3] = 'black';
    this.board[4][4] = 'white';

    // Black always goes first
    this.currentTurn = this.getPlayerBySide('black').id;
    this.validMoves = this.computeValidMoves('black');
    this.scores = this.countDiscs();
    this.lastMove = null;
    this.turnStickerIndex = 0;
    this.turnStickerKey = GAME_CONFIG.TURN_STICKERS[0];
    this.scheduleTurnTimer(this.turnTimeMs);

    this.emitState();
    console.log(`[Othello] Game started: black=${this.getPlayerBySide('black').id}, white=${this.getPlayerBySide('white').id}`);
  }

  stop() {
    this.active = false;
    this.clearTurnTimer();
    this.turnDeadlineAt = null;
  }

  pause() {
    this._pausedTurnRemainingMs = this.getTurnTimeLeftMs();
    this.clearTurnTimer();
    this.turnDeadlineAt = null;
    this.paused = true;
  }

  resume() {
    this.paused = false;
    const resumeMs = this._pausedTurnRemainingMs && this._pausedTurnRemainingMs > 0
      ? this._pausedTurnRemainingMs
      : this.turnTimeMs;
    this.scheduleTurnTimer(resumeMs);
    this._pausedTurnRemainingMs = null;
    // Re-emit state so reconnecting player gets current board
    this.emitState();
  }

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;
    if (this.currentTurn === oldId) this.currentTurn = newId;
  }

  handleAction(playerId, action) {
    if (!this.active) return;
    if (!action || typeof action !== 'object') return;

    if (this.paused) {
      this.emit('action-error', { playerId, code: 'GAME_PAUSED', message: 'Game is paused' });
      return;
    }

    if (action.type === 'place-disc') {
      if (!Number.isFinite(action.row) || !Number.isFinite(action.col)) {
        this.emit('action-error', { playerId, code: 'INVALID_INPUT', message: 'Invalid input' });
        return;
      }
      this.placeDisc(playerId, action.row, action.col);
    }
  }

  placeDisc(playerId, row, col) {
    if (playerId !== this.currentTurn) {
      this.emit('action-error', { playerId, code: 'WRONG_TURN', message: 'Not your turn' });
      return;
    }

    if (row < 0 || row > 7 || col < 0 || col > 7) {
      this.emit('action-error', { playerId, code: 'OUT_OF_BOUNDS', message: 'Invalid position' });
      return;
    }

    if (this.board[row][col] !== 0) {
      this.emit('action-error', { playerId, code: 'CELL_OCCUPIED', message: 'Cell is occupied' });
      return;
    }

    const side = this.getPlayerSide(playerId);
    const flipped = this.getFlippedDiscs(row, col, side);

    if (flipped.length === 0) {
      this.emit('action-error', { playerId, code: 'INVALID_MOVE', message: 'Invalid move' });
      return;
    }

    // Place disc and flip captured discs
    this.board[row][col] = side;
    for (const [fr, fc] of flipped) {
      this.board[fr][fc] = side;
    }

    this.lastMove = { row, col, side, flipped };
    this.scores = this.countDiscs();

    console.log(`[Othello] Move: ${side} places (${row},${col}), flipped ${flipped.length} discs`);

    this.advanceTurn(side);
  }

  advanceTurn(currentSide) {
    const nextSide = currentSide === 'black' ? 'white' : 'black';
    const nextMoves = this.computeValidMoves(nextSide);

    if (nextMoves.length > 0) {
      // Normal turn change
      this.currentTurn = this.getPlayerBySide(nextSide).id;
      this.validMoves = nextMoves;
      this.scheduleTurnTimer(this.turnTimeMs);
      this.emitState();
    } else {
      // Next player has no moves — check if current player can still play
      const currentMoves = this.computeValidMoves(currentSide);

      if (currentMoves.length > 0) {
        // Auto-pass: next player can't move, current player continues
        console.log(`[Othello] Auto-pass: ${nextSide} has no valid moves`);
        this.currentTurn = this.getPlayerBySide(currentSide).id;
        this.validMoves = currentMoves;
        this.scheduleTurnTimer(this.turnTimeMs);
        this.emitState(nextSide);
      } else {
        // Game over: neither player can move
        this.active = false;
        this.clearTurnTimer();
        this.turnDeadlineAt = null;
        this.validMoves = [];
        this.emitState();

        let winnerId = null;
        if (this.scores.black > this.scores.white) {
          winnerId = this.getPlayerBySide('black').id;
        } else if (this.scores.white > this.scores.black) {
          winnerId = this.getPlayerBySide('white').id;
        }

        console.log(`[Othello] Game over: black=${this.scores.black}, white=${this.scores.white}, winner=${winnerId ? this.getPlayerSide(winnerId) : 'draw'}`);

        this.emit('match-end', {
          winnerId,
          scores: [this.scores.black, this.scores.white],
        });
      }
    }
  }

  emitState(passedSide = null) {
    this.emit('state-update', {
      board: this.board.map((row) => [...row]),
      currentTurn: this.currentTurn,
      validMoves: this.validMoves,
      lastMove: this.lastMove,
      scores: this.scores,
      passed: passedSide,
      turnTimeMs: this.turnTimeMs,
      turnDeadlineAt: this.turnDeadlineAt,
      turnTimeLeftMs: this.getTurnTimeLeftMs(),
      turnStickerKey: this.turnStickerKey,
    });
  }

  getTurnTimeLeftMs() {
    if (!this.turnDeadlineAt) return 0;
    return Math.max(0, this.turnDeadlineAt - Date.now());
  }

  clearTurnTimer() {
    if (!this._turnTimeout) return;
    clearTimeout(this._turnTimeout);
    this._turnTimeout = null;
  }

  scheduleTurnTimer(durationMs) {
    this.clearTurnTimer();
    if (!this.active || this.paused || !this.currentTurn) return;
    this.turnStickerKey = GAME_CONFIG.TURN_STICKERS[this.turnStickerIndex % GAME_CONFIG.TURN_STICKERS.length];
    this.turnStickerIndex += 1;
    const clampedDuration = Math.max(1, Math.floor(durationMs));
    this.turnDeadlineAt = Date.now() + clampedDuration;
    this._turnTimeout = setTimeout(() => this.handleTurnTimeout(), clampedDuration);
    if (typeof this._turnTimeout.unref === 'function') {
      this._turnTimeout.unref();
    }
  }

  handleTurnTimeout() {
    this._turnTimeout = null;
    if (!this.active || this.paused || !this.currentTurn) return;

    const side = this.getPlayerSide(this.currentTurn);
    const timedOutPlayerId = this.currentTurn;
    const timeoutMoves = this.computeValidMoves(side);
    if (timeoutMoves.length === 0) {
      this.advanceTurn(side);
      return;
    }

    const [row, col] = timeoutMoves[0];
    console.log(`[Othello] Turn timeout: ${side} auto-plays (${row},${col})`);
    const stickerIdx = Math.floor(Math.random() * GAME_CONFIG.TURN_STICKERS.length);
    const lineIdx = Math.floor(Math.random() * TIMEOUT_FLAVOR_LINES.length);
    const timeoutStickerKey = GAME_CONFIG.TURN_STICKERS[stickerIdx];
    const timeoutFlavor = TIMEOUT_FLAVOR_LINES[lineIdx];
    this.emit('action-error', {
      playerId: timedOutPlayerId,
      code: 'TURN_TIMEOUT',
      message: timeoutFlavor,
      stickerKey: timeoutStickerKey,
      flavorText: timeoutFlavor,
    });
    this.placeDisc(timedOutPlayerId, row, col);
  }

  computeValidMoves(side) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === 0 && this.getFlippedDiscs(r, c, side).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  getFlippedDiscs(row, col, side) {
    const opponent = side === 'black' ? 'white' : 'black';
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];

    const allFlipped = [];

    for (const [dr, dc] of directions) {
      const lineFlipped = [];
      let r = row + dr;
      let c = col + dc;

      while (r >= 0 && r < 8 && c >= 0 && c < 8 && this.board[r][c] === opponent) {
        lineFlipped.push([r, c]);
        r += dr;
        c += dc;
      }

      if (lineFlipped.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && this.board[r][c] === side) {
        allFlipped.push(...lineFlipped);
      }
    }

    return allFlipped;
  }

  countDiscs() {
    let black = 0;
    let white = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === 'black') black++;
        else if (this.board[r][c] === 'white') white++;
      }
    }
    return { black, white };
  }

  getPlayerSide(playerId) {
    if (playerId === this.p1.id) return this.p1.side;
    return this.p2.side;
  }

  getPlayerBySide(side) {
    if (this.p1.side === side) return this.p1;
    return this.p2;
  }
}
