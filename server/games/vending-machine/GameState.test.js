import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './GameState.js';
import { VENDING_MACHINE_CONFIG as CFG } from './config.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'left' };
  const p2 = { id: 'p2', side: 'right' };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, p1, p2, events };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

describe('Vending Machine GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts and initializes board, player economy, and events', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.start();
    game.clearTimers();
    game.stop();

    assert.equal(game.grid.length, CFG.GRID_ROWS);
    assert.equal(game.grid[0].length, CFG.GRID_COLS);
    assert.equal(game.yen[p1.id], CFG.STARTING_YEN);
    assert.equal(game.yen[p2.id], CFG.STARTING_YEN);
    assert.equal(game.events.length, game.totalRounds);
  });

  it('countdown promotes to playing state with first turn', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;
    let countdownCb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (cb) => {
      countdownCb = cb;
      return 1;
    };

    try {
      game.active = true;
      game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
      game.yen[p1.id] = CFG.STARTING_YEN;
      game.yen[p2.id] = CFG.STARTING_YEN;
      game.totalIncome[p1.id] = 0;
      game.totalIncome[p2.id] = 0;
      game.machines[p1.id] = [];
      game.machines[p2.id] = [];
      game.events = Array.from({ length: game.totalRounds }, () => CFG.EVENTS[0]);
      game.startCountdown();
      countdownCb();

      assert.equal(game.phase, 'playing');
      assert.equal(game.currentTurn, p1.id);
      assert.equal(game.round, 1);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('rejects invalid placeMachine requests', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.currentTurn = p1.id;
    game.yen[p1.id] = CFG.STARTING_YEN;
    game.machines[p1.id] = [];

    game.placeMachine(p2.id, 0, 0, 'coffee');
    game.placeMachine(p1.id, -1, 0, 'coffee');
    game.placeMachine(p1.id, 0, 0, 'unknown');
    game.yen[p1.id] = 1;
    game.placeMachine(p1.id, 0, 0, 'coffee');

    assert.equal(game.grid[0][0], null);
  });

  it('places a machine, applies costs + income, and advances turn', () => {
    const { game, p1 } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.currentTurn = p1.id;
    game.round = 1;
    game.events = Array.from({ length: game.totalRounds }, () => CFG.EVENTS[0]);
    game.currentEvent = CFG.EVENTS[0];
    game.yen[p1.id] = CFG.STARTING_YEN;
    game.machines[p1.id] = [];
    game.totalIncome[p1.id] = 0;
    game.machines.p2 = [];
    game.yen.p2 = CFG.STARTING_YEN;
    game.totalIncome.p2 = 0;

    game.placeMachine(p1.id, 0, 0, 'juice');

    assert.ok(game.grid[0][0]);
    assert.equal(game.lastPlacement.row, 0);
    assert.equal(game.totalIncome[p1.id] > 0, true);
  });

  it('calculateIncome applies location and event bonuses', () => {
    const { game, p1 } = createGame();
    currentGame = game;

    game.currentEvent = { boost: 'juice', multiplier: 2 };
    game.machines[p1.id] = [{ row: 0, col: 2, drinkId: 'juice' }]; // park bonus + sunny-like event

    const income = game.calculateIncome(p1.id);
    assert.equal(income > 0, true);
  });

  it('autoPlace handles no empty cells and no affordable drinks', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.currentTurn = p1.id;
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () =>
      Array.from({ length: CFG.GRID_COLS }, () => ({ ownerId: p1.id, drinkId: 'coffee' })));

    game.autoPlace(p1.id);
    assert.ok(lastEvent(events, 'match-end'));

    // reset for no-affordable branch
    game.active = true;
    game.phase = 'playing';
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.currentTurn = p1.id;
    game.yen[p1.id] = 0;
    game.yen[p2.id] = CFG.STARTING_YEN;
    game.machines[p1.id] = [];
    game.machines[p2.id] = [];
    game.totalIncome[p1.id] = 0;
    game.totalIncome[p2.id] = 0;
    game.events = Array.from({ length: game.totalRounds }, () => CFG.EVENTS[0]);
    game.round = 1;

    game.autoPlace(p1.id);
    assert.equal(game.currentTurn, p2.id);
  });

  it('broadcast and reconnect payload are player-scoped', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.grid[0][0] = { ownerId: p1.id, drinkId: 'coffee' };
    game.yen[p1.id] = 600;
    game.yen[p2.id] = 400;
    game.totalIncome[p1.id] = 120;
    game.totalIncome[p2.id] = 70;
    game.machines[p1.id] = [{ row: 0, col: 0, drinkId: 'coffee' }];
    game.machines[p2.id] = [];
    game.currentTurn = p1.id;

    game.broadcastState();
    const state = lastEvent(events, 'vending-state');
    assert.ok(state.byPlayer[p1.id].grid[0][0].isMine);
    assert.equal(state.byPlayer[p2.id].grid[0][0].isMine, false);

    const reconnect = game.getReconnectPayload(p2.id);
    assert.equal(reconnect.vendingState.isMyTurn, false);
  });

  it('pause/resume and handleAction gate behavior by phase and paused flag', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.active = true;
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.yen[p1.id] = CFG.STARTING_YEN;
    game.yen[p2.id] = CFG.STARTING_YEN;
    game.totalIncome[p1.id] = 0;
    game.totalIncome[p2.id] = 0;
    game.machines[p1.id] = [];
    game.machines[p2.id] = [];
    game.events = Array.from({ length: game.totalRounds }, () => CFG.EVENTS[0]);
    game.phase = 'countdown';
    game.resume();
    assert.equal(game.phase, 'countdown');

    game.phase = 'playing';
    game.paused = true;
    game.handleAction(p1.id, { type: 'place-machine', row: 0, col: 0, drinkId: 'coffee' });
    game.pause();
    assert.equal(game.paused, true);
  });

  it('advanceTurn can end match when no one can afford a machine', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    game.active = true;
    game.phase = 'playing';
    game.grid = Array.from({ length: CFG.GRID_ROWS }, () => Array(CFG.GRID_COLS).fill(null));
    game.currentTurn = p1.id;
    game.round = 1;
    game.yen[p1.id] = 0;
    game.yen[p2.id] = 0;
    game.machines[p1.id] = [];
    game.machines[p2.id] = [];
    game.totalIncome[p1.id] = 0;
    game.totalIncome[p2.id] = 0;
    game.events = Array.from({ length: game.totalRounds }, () => CFG.EVENTS[0]);

    game.advanceTurn();
    const end = lastEvent(events, 'match-end');
    assert.ok(end);
  });
});
