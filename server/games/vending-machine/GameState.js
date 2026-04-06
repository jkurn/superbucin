/**
 * Japanese Vending Machine Tycoon — Server-authoritative game state.
 *
 * Two players compete to earn the most yen by placing vending machines
 * on a shared Japanese street map. Each turn a player picks a cell,
 * chooses a drink to stock, then income is calculated for ALL their machines
 * based on location traffic, drink-location bonuses, and the current weather event.
 *
 * The game ends when all 12 cells are filled (6 per player).
 * Most yen wins.
 */

import { VENDING_MACHINE_CONFIG as CFG } from './config.js';

export const GAME_CONFIG = CFG;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    this.phase = 'countdown'; // 'countdown' | 'playing' | 'finished'
    this.currentTurn = null;

    // Grid: null = empty, { ownerId, drinkId } = placed machine
    this.grid = [];
    this.yen = {};
    this.totalIncome = {};
    this.machines = {}; // { [playerId]: [{row, col, drinkId}] }

    // Round tracking
    this.round = 0;
    this.totalRounds = CFG.GRID_ROWS * CFG.GRID_COLS; // 12 cells = 12 turns
    this.events = []; // shuffled weather events for each round
    this.currentEvent = null;
    this.lastPlacement = null; // { row, col, drinkId, income } for UI feedback

    this.timerEndsAt = 0;
    this.phaseTimer = null;
  }

  start() {
    this.active = true;
    this.paused = false;

    // Init grid
    const rows = CFG.GRID_ROWS;
    const cols = CFG.GRID_COLS;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));

    // Init player state
    for (const p of [this.p1, this.p2]) {
      this.yen[p.id] = CFG.STARTING_YEN;
      this.totalIncome[p.id] = 0;
      this.machines[p.id] = [];
    }

    // Shuffle weather events for each round
    this.events = [];
    while (this.events.length < this.totalRounds) {
      this.events.push(...shuffle(CFG.EVENTS));
    }
    this.events = this.events.slice(0, this.totalRounds);

    this.round = 0;
    this.currentEvent = this.events[0];
    this.lastPlacement = null;

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
    if (this.phase === 'playing') {
      this.startTurnTimer();
      this.broadcastState();
    } else if (this.phase === 'countdown') {
      this.startCountdown();
    }
  }

  clearTimers() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  startCountdown() {
    this.phase = 'countdown';
    this.broadcastState();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.phase = 'playing';
      this.currentTurn = this.p1.id;
      this.round = 1;
      this.currentEvent = this.events[0];
      this.startTurnTimer();
      this.broadcastState();
    }, CFG.COUNTDOWN_MS);
  }

  startTurnTimer() {
    this.timerEndsAt = Date.now() + CFG.TURN_TIME_MS;
    this.clearTimers();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.autoPlace(this.currentTurn);
    }, CFG.TURN_TIME_MS + 500);
  }

  handleAction(playerId, action) {
    if (!this.active || this.paused) return;
    if (!action || typeof action !== 'object') return;

    if (action.type === 'place-machine' && this.phase === 'playing') {
      this.placeMachine(playerId, action.row, action.col, action.drinkId);
    }
  }

  placeMachine(playerId, row, col, drinkId) {
    if (playerId !== this.currentTurn) return;
    if (row < 0 || row >= CFG.GRID_ROWS || col < 0 || col >= CFG.GRID_COLS) return;
    if (this.grid[row][col] !== null) return;

    const drink = CFG.DRINKS.find((d) => d.id === drinkId);
    if (!drink) return;

    // Check if player can afford (machine + stocking)
    const totalCost = CFG.MACHINE_COST + drink.cost;
    if (this.yen[playerId] < totalCost) return;

    // Place the machine
    this.yen[playerId] -= totalCost;
    this.grid[row][col] = { ownerId: playerId, drinkId };
    this.machines[playerId].push({ row, col, drinkId });

    // Calculate income from ALL player's machines this turn
    const income = this.calculateIncome(playerId);
    this.yen[playerId] += income;
    this.totalIncome[playerId] += income;

    this.lastPlacement = { row, col, drinkId, income, playerId };

    this.clearTimers();
    this.advanceTurn();
  }

  calculateIncome(playerId) {
    let total = 0;
    const event = this.currentEvent;

    for (const machine of this.machines[playerId]) {
      const locType = CFG.MAP_LAYOUT[machine.row][machine.col];
      const loc = CFG.LOCATIONS[locType];
      const drink = CFG.DRINKS.find((d) => d.id === machine.drinkId);
      if (!drink || !loc) continue;

      let revenue = drink.price;

      // Traffic multiplier (customers = traffic level)
      const customers = loc.traffic;
      revenue *= customers;

      // Location bonus: if location's bonus drink matches, +40%
      if (loc.bonus === machine.drinkId) {
        revenue *= 1.4;
      }

      // Weather/event bonus
      if (event && event.boost === machine.drinkId) {
        revenue *= event.multiplier;
      }

      total += Math.floor(revenue);
    }

    return total;
  }

  autoPlace(playerId) {
    if (!this.active || this.phase !== 'playing') return;

    // Find empty cells
    const empty = [];
    for (let r = 0; r < CFG.GRID_ROWS; r++) {
      for (let c = 0; c < CFG.GRID_COLS; c++) {
        if (this.grid[r][c] === null) empty.push({ r, c });
      }
    }

    if (empty.length === 0) {
      this.finishMatch();
      return;
    }

    // Pick random empty cell and random affordable drink
    const cell = empty[Math.floor(Math.random() * empty.length)];
    const affordable = CFG.DRINKS.filter((d) => this.yen[playerId] >= CFG.MACHINE_COST + d.cost);

    if (affordable.length === 0) {
      // Can't afford anything — skip turn
      this.clearTimers();
      this.advanceTurn();
      return;
    }

    const drink = affordable[Math.floor(Math.random() * affordable.length)];
    this.placeMachine(playerId, cell.r, cell.c, drink.id);
  }

  advanceTurn() {
    this.round++;

    // Check if board is full or all rounds done
    const emptyCells = this.grid.flat().filter((c) => c === null).length;
    if (emptyCells === 0 || this.round > this.totalRounds) {
      this.finishMatch();
      return;
    }

    // Check if next player can afford anything
    const nextPlayer = this.currentTurn === this.p1.id ? this.p2.id : this.p1.id;
    const cheapest = Math.min(...CFG.DRINKS.map((d) => CFG.MACHINE_COST + d.cost));

    // Switch turn
    this.currentTurn = nextPlayer;
    this.currentEvent = this.events[Math.min(this.round - 1, this.events.length - 1)];

    // If next player can't afford anything, skip their turn
    if (this.yen[nextPlayer] < cheapest) {
      // Check if current player (who just went) can still afford
      const currentPlayer = this.currentTurn === this.p1.id ? this.p2.id : this.p1.id;
      if (this.yen[currentPlayer] < cheapest) {
        // Neither can afford — end game
        this.finishMatch();
        return;
      }
      // Skip broke player
      this.currentTurn = currentPlayer;
    }

    this.startTurnTimer();
    this.broadcastState();
  }

  finishMatch() {
    this.active = false;
    this.phase = 'finished';
    this.clearTimers();

    const s1 = this.yen[this.p1.id];
    const s2 = this.yen[this.p2.id];

    let winnerId = null;
    let tie = false;
    if (s1 > s2) winnerId = this.p1.id;
    else if (s2 > s1) winnerId = this.p2.id;
    else tie = true;

    this.emit('match-end', {
      winnerId,
      tie,
      scores: [s1, s2],
    });
  }

  broadcastState() {
    const buildSlice = (player, opponent) => ({
      gameType: 'vending-machine',
      phase: this.phase,
      grid: this.grid.map((row) => row.map((cell) => {
        if (!cell) return null;
        return {
          ownerId: cell.ownerId,
          drinkId: cell.drinkId,
          isMine: cell.ownerId === player.id,
        };
      })),
      mapLayout: CFG.MAP_LAYOUT,
      myYen: this.yen[player.id],
      oppYen: this.yen[opponent.id],
      myIncome: this.totalIncome[player.id],
      oppIncome: this.totalIncome[opponent.id],
      myMachines: this.machines[player.id].length,
      oppMachines: this.machines[opponent.id].length,
      isMyTurn: this.currentTurn === player.id,
      round: this.round,
      totalRounds: this.totalRounds,
      currentEvent: this.currentEvent,
      timerEndsAt: this.timerEndsAt,
      lastPlacement: this.lastPlacement,
    });

    this.emit('vending-state', {
      byPlayer: {
        [this.p1.id]: buildSlice(this.p1, this.p2),
        [this.p2.id]: buildSlice(this.p2, this.p1),
      },
    });
  }

  getReconnectPayload(socketId) {
    const player = socketId === this.p1.id ? this.p1 : this.p2;
    const opponent = socketId === this.p1.id ? this.p2 : this.p1;
    return {
      vendingState: {
        gameType: 'vending-machine',
        phase: this.phase,
        grid: this.grid.map((row) => row.map((cell) => {
          if (!cell) return null;
          return {
            ownerId: cell.ownerId,
            drinkId: cell.drinkId,
            isMine: cell.ownerId === player.id,
          };
        })),
        mapLayout: CFG.MAP_LAYOUT,
        myYen: this.yen[player.id],
        oppYen: this.yen[opponent.id],
        myIncome: this.totalIncome[player.id],
        oppIncome: this.totalIncome[opponent.id],
        myMachines: this.machines[player.id].length,
        oppMachines: this.machines[opponent.id].length,
        isMyTurn: this.currentTurn === player.id,
        round: this.round,
        totalRounds: this.totalRounds,
        currentEvent: this.currentEvent,
        timerEndsAt: this.timerEndsAt,
        lastPlacement: this.lastPlacement,
      },
    };
  }
}
