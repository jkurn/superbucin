export const GAME_CONFIG = {
  ROWS: 6,
  COLS: 7,
};

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.board = [];
    this.active = false;
    this.paused = false;
    this.currentTurn = null;
    this.lastMove = null;
    this.winLine = null;
  }

  start() {
    this.active = true;
    this.paused = false;
    this.board = Array.from({ length: GAME_CONFIG.ROWS }, () =>
      Array(GAME_CONFIG.COLS).fill(0),
    );
    this.currentTurn = this.p1.id;
    this.lastMove = null;
    this.winLine = null;
    this.emitState();
  }

  stop() {
    this.active = false;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
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

    if (action.type === 'drop') {
      this.dropDisc(playerId, action.col);
    }
  }

  dropDisc(playerId, col) {
    if (playerId !== this.currentTurn) {
      this.emit('action-error', { playerId, code: 'WRONG_TURN', message: 'Not your turn' });
      return;
    }

    if (!Number.isFinite(col) || col < 0 || col >= GAME_CONFIG.COLS) {
      this.emit('action-error', { playerId, code: 'INVALID_COL', message: 'Invalid column' });
      return;
    }

    // Find lowest empty row in column (gravity)
    let row = -1;
    for (let r = GAME_CONFIG.ROWS - 1; r >= 0; r--) {
      if (this.board[r][col] === 0) {
        row = r;
        break;
      }
    }

    if (row === -1) {
      this.emit('action-error', { playerId, code: 'COLUMN_FULL', message: 'Column is full!' });
      return;
    }

    const side = this.getPlayerSide(playerId);
    this.board[row][col] = side;
    this.lastMove = { row, col, side };

    // Check for win
    const win = this.checkWin(row, col, side);
    if (win) {
      this.winLine = win;
      this.active = false;
      this.emitState();
      this.emit('match-end', {
        winnerId: playerId,
        scores: [
          playerId === this.p1.id ? 1 : 0,
          playerId === this.p2.id ? 1 : 0,
        ],
      });
      return;
    }

    // Check for draw (board full)
    const isFull = this.board[0].every((cell) => cell !== 0);
    if (isFull) {
      this.active = false;
      this.emitState();
      this.emit('match-end', {
        winnerId: null,
        tie: true,
        scores: [0, 0],
      });
      return;
    }

    // Switch turn
    this.currentTurn = playerId === this.p1.id ? this.p2.id : this.p1.id;
    this.emitState();
  }

  checkWin(row, col, side) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1],  // diagonal down-left
    ];

    for (const [dr, dc] of directions) {
      const line = [{ row, col }];

      // Scan positive direction
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= GAME_CONFIG.ROWS || c < 0 || c >= GAME_CONFIG.COLS) break;
        if (this.board[r][c] !== side) break;
        line.push({ row: r, col: c });
      }

      // Scan negative direction
      for (let i = 1; i < 4; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r < 0 || r >= GAME_CONFIG.ROWS || c < 0 || c >= GAME_CONFIG.COLS) break;
        if (this.board[r][c] !== side) break;
        line.push({ row: r, col: c });
      }

      if (line.length >= 4) return line;
    }

    return null;
  }

  emitState() {
    this.emit('state-update', {
      board: this.board.map((row) => [...row]),
      currentTurn: this.currentTurn,
      lastMove: this.lastMove,
      winLine: this.winLine,
    });
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
