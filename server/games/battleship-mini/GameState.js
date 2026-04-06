/**
 * Mini Battleship ("Sink Squad") — Server-authoritative game state.
 *
 * Two-phase game:
 *   1. Placement: Each player places 3 ships on a 6×6 grid.
 *   2. Battle: Players take turns firing shots at the opponent's grid.
 *
 * Ship sizes: 3, 2, 2 cells.
 * First player to sink all opponent ships wins.
 *
 * Hidden information: each player only sees their own board + shots they've
 * taken against the opponent. The server emits per-player state slices.
 */

export const GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  GRID_SIZE: 6,
  SHIPS: [3, 2, 2],           // Ship lengths
  TURN_TIME_MS: 20_000,       // 20s per shot
  PLACEMENT_TIME_MS: 60_000,  // 60s to place all ships
  COUNTDOWN_MS: 3000,
};

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    // 'countdown' | 'placement' | 'battle' | 'finished'
    this.phase = 'countdown';
    this.currentTurn = null;

    // Per-player boards: 0=empty, 'S'=ship, 'H'=hit, 'M'=miss
    this.boards = {};
    // Per-player shot boards (what they've shot at opponent): 0=unknown, 'H'=hit, 'M'=miss
    this.shots = {};
    // Ship placements per player: array of { cells: [{r,c}...], sunk: false }
    this.ships = {};
    // Placement readiness
    this.placementReady = {};

    this.timerEndsAt = 0;
    this.phaseTimer = null;
    this.tickInterval = null;
  }

  start() {
    this.active = true;
    this.paused = false;
    const size = GAME_CONFIG.GRID_SIZE;

    for (const p of [this.p1, this.p2]) {
      this.boards[p.id] = Array.from({ length: size }, () => Array(size).fill(0));
      this.shots[p.id] = Array.from({ length: size }, () => Array(size).fill(0));
      this.ships[p.id] = [];
      this.placementReady[p.id] = false;
    }

    this.phase = 'countdown';
    this.clearTimers();
    this.startCountdown();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  pause() {
    if (!this.active) return;
    this.paused = true;
    this.clearTimers();
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    if (this.phase === 'placement') {
      this.broadcastState();
    } else if (this.phase === 'battle') {
      this.startTurnTimer();
      this.broadcastState();
    } else if (this.phase === 'countdown') {
      this.startCountdown();
    }
  }

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;

    for (const map of [this.boards, this.shots, this.ships, this.placementReady]) {
      if (map[oldId] !== undefined) {
        map[newId] = map[oldId];
        delete map[oldId];
      }
    }

    if (this.currentTurn === oldId) this.currentTurn = newId;
  }

  clearTimers() {
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
  }

  startCountdown() {
    this.phase = 'countdown';
    this.broadcastState();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.startPlacement();
    }, GAME_CONFIG.COUNTDOWN_MS);
  }

  startPlacement() {
    this.phase = 'placement';
    this.timerEndsAt = Date.now() + GAME_CONFIG.PLACEMENT_TIME_MS;
    this.broadcastState();

    // Auto-advance if both don't place in time
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      // Auto-place for anyone who hasn't placed
      for (const p of [this.p1, this.p2]) {
        if (!this.placementReady[p.id]) {
          this.autoPlace(p.id);
          this.placementReady[p.id] = true;
        }
      }
      this.startBattle();
    }, GAME_CONFIG.PLACEMENT_TIME_MS + 500);
  }

  handleAction(playerId, action) {
    if (!this.active || this.paused) return;
    if (!action || typeof action !== 'object') return;

    if (action.type === 'place-ships' && this.phase === 'placement') {
      this.placeShips(playerId, action.ships);
    } else if (action.type === 'fire' && this.phase === 'battle') {
      this.fireShot(playerId, action.row, action.col);
    }
  }

  placeShips(playerId, shipPlacements) {
    if (this.placementReady[playerId]) return; // already placed
    if (!Array.isArray(shipPlacements)) return;

    const size = GAME_CONFIG.GRID_SIZE;
    const expectedShips = GAME_CONFIG.SHIPS;

    if (shipPlacements.length !== expectedShips.length) return;

    // Validate each ship
    const occupied = new Set();
    const validShips = [];

    for (let i = 0; i < shipPlacements.length; i++) {
      const ship = shipPlacements[i];
      if (!Array.isArray(ship.cells) || ship.cells.length !== expectedShips[i]) return;

      // Validate cells are in-bounds, consecutive (horizontal or vertical), and non-overlapping
      const cells = ship.cells.map((c) => ({ r: c.r, c: c.c }));

      for (const cell of cells) {
        if (cell.r < 0 || cell.r >= size || cell.c < 0 || cell.c >= size) return;
        const key = `${cell.r},${cell.c}`;
        if (occupied.has(key)) return;
        occupied.add(key);
      }

      // Check linearity
      if (!this._isLinear(cells)) return;

      validShips.push({ cells, sunk: false });
    }

    // Apply to board
    this.ships[playerId] = validShips;
    const board = this.boards[playerId];
    for (const ship of validShips) {
      for (const cell of ship.cells) {
        board[cell.r][cell.c] = 'S';
      }
    }

    this.placementReady[playerId] = true;
    this.broadcastState();

    // If both ready, start battle
    if (this.placementReady[this.p1.id] && this.placementReady[this.p2.id]) {
      this.clearTimers();
      this.startBattle();
    }
  }

  _isLinear(cells) {
    if (cells.length <= 1) return true;

    const sameRow = cells.every((c) => c.r === cells[0].r);
    const sameCol = cells.every((c) => c.c === cells[0].c);
    if (!sameRow && !sameCol) return false;

    // Check consecutive
    if (sameRow) {
      const cols = cells.map((c) => c.c).sort((a, b) => a - b);
      for (let i = 1; i < cols.length; i++) {
        if (cols[i] !== cols[i - 1] + 1) return false;
      }
    } else {
      const rows = cells.map((c) => c.r).sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] !== rows[i - 1] + 1) return false;
      }
    }
    return true;
  }

  autoPlace(playerId) {
    const size = GAME_CONFIG.GRID_SIZE;
    const board = this.boards[playerId];
    const ships = [];

    for (const len of GAME_CONFIG.SHIPS) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 200) {
        attempts++;
        const horizontal = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horizontal ? size : size - len + 1));
        const c = Math.floor(Math.random() * (horizontal ? size - len + 1 : size));

        const cells = [];
        let valid = true;
        for (let i = 0; i < len; i++) {
          const cr = horizontal ? r : r + i;
          const cc = horizontal ? c + i : c;
          if (board[cr][cc] !== 0) { valid = false; break; }
          cells.push({ r: cr, c: cc });
        }

        if (valid) {
          for (const cell of cells) board[cell.r][cell.c] = 'S';
          ships.push({ cells, sunk: false });
          placed = true;
        }
      }
    }

    this.ships[playerId] = ships;
  }

  startBattle() {
    this.phase = 'battle';
    // P1 goes first
    this.currentTurn = this.p1.id;
    this.startTurnTimer();
    this.broadcastState();
  }

  startTurnTimer() {
    this.timerEndsAt = Date.now() + GAME_CONFIG.TURN_TIME_MS;
    this.clearTimers();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      // Auto-skip turn (fire at random empty cell)
      this.autoFire(this.currentTurn);
    }, GAME_CONFIG.TURN_TIME_MS + 500);
  }

  autoFire(playerId) {
    if (!this.active || this.phase !== 'battle') return;
    const opponent = playerId === this.p1.id ? this.p2 : this.p1;
    const shots = this.shots[playerId];
    const size = GAME_CONFIG.GRID_SIZE;

    // Find all unshot cells
    const available = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (shots[r][c] === 0) available.push({ r, c });
      }
    }

    if (available.length > 0) {
      const pick = available[Math.floor(Math.random() * available.length)];
      this._processShot(playerId, opponent, pick.r, pick.c);
    } else {
      this.switchTurn();
    }
  }

  fireShot(playerId, row, col) {
    if (this.phase !== 'battle') return;
    if (playerId !== this.currentTurn) return;
    const size = GAME_CONFIG.GRID_SIZE;
    if (row < 0 || row >= size || col < 0 || col >= size) return;

    // Can't fire at already-shot cell
    if (this.shots[playerId][row][col] !== 0) return;

    const opponent = playerId === this.p1.id ? this.p2 : this.p1;
    this._processShot(playerId, opponent, row, col);
  }

  _processShot(playerId, opponent, row, col) {
    const oppBoard = this.boards[opponent.id];
    const isHit = oppBoard[row][col] === 'S';

    this.shots[playerId][row][col] = isHit ? 'H' : 'M';
    if (isHit) {
      oppBoard[row][col] = 'H';
      // Check if any ship is sunk
      this._checkSunk(opponent.id);
    }

    this.clearTimers();

    // Check win condition
    if (this._allSunk(opponent.id)) {
      this.finishMatch(playerId);
      return;
    }

    this.switchTurn();
  }

  _checkSunk(playerId) {
    for (const ship of this.ships[playerId]) {
      if (ship.sunk) continue;
      const allHit = ship.cells.every(
        (cell) => this.boards[playerId][cell.r][cell.c] === 'H',
      );
      if (allHit) ship.sunk = true;
    }
  }

  _allSunk(playerId) {
    return this.ships[playerId].length > 0
      && this.ships[playerId].every((s) => s.sunk);
  }

  switchTurn() {
    this.currentTurn = this.currentTurn === this.p1.id ? this.p2.id : this.p1.id;
    this.startTurnTimer();
    this.broadcastState();
  }

  finishMatch(winnerId) {
    this.active = false;
    this.phase = 'finished';
    this.clearTimers();

    // Score: count remaining ship cells (non-hit) as points for the winner
    const winnerRemaining = this.ships[winnerId].reduce(
      (sum, s) => sum + s.cells.filter((c) => this.boards[winnerId][c.r][c.c] === 'S').length,
      0,
    );

    const winnerScore = 10 + winnerRemaining;
    const loserScore = 0;

    const scores = winnerId === this.p1.id
      ? [winnerScore, loserScore]
      : [loserScore, winnerScore];

    this.emit('match-end', {
      winnerId,
      tie: false,
      scores,
    });
  }

  broadcastState() {
    const size = GAME_CONFIG.GRID_SIZE;

    // Build per-player state slices (hidden information game)
    const buildSlice = (player, opponent) => {
      // Player's own board (show ships, hits, misses)
      const myBoard = this.boards[player.id].map((row) => row.map((cell) => {
        if (cell === 'S') return 'S'; // own ship
        if (cell === 'H') return 'H'; // hit on own ship
        return 0;
      }));

      // Opponent's board as seen by this player (only show shots taken)
      const oppBoard = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (__, c) => this.shots[player.id][r][c]),
      );

      // Ship status for the player's own fleet
      const myShips = this.ships[player.id].map((s) => ({
        length: s.cells.length,
        sunk: s.sunk,
      }));

      // Opponent ship status (only show sunk status, not positions)
      const oppShips = this.ships[opponent.id].map((s) => ({
        length: s.cells.length,
        sunk: s.sunk,
      }));

      // For sunk opponent ships, reveal their positions
      const sunkOppCells = [];
      for (const ship of this.ships[opponent.id]) {
        if (ship.sunk) {
          sunkOppCells.push(...ship.cells);
        }
      }

      return {
        gameType: 'battleship-mini',
        phase: this.phase,
        gridSize: size,
        myBoard,
        oppBoard,
        myShips,
        oppShips,
        sunkOppCells,
        isMyTurn: this.currentTurn === player.id,
        placementReady: this.placementReady[player.id],
        oppPlacementReady: this.placementReady[opponent.id],
        timerEndsAt: this.timerEndsAt,
        shipsToPlace: GAME_CONFIG.SHIPS,
      };
    };

    this.emit('battleship-state', {
      byPlayer: {
        [this.p1.id]: buildSlice(this.p1, this.p2),
        [this.p2.id]: buildSlice(this.p2, this.p1),
      },
    });
  }
}
