import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GAME_CONFIG } from './GameState.js';

function createGame() {
  const events = [];
  const p1 = { id: 'p1', side: 'blue', socket: null };
  const p2 = { id: 'p2', side: 'red', socket: null };
  const emit = (event, data) => events.push({ event, data });
  const game = new GameState(p1, p2, emit);
  return { game, events, p1, p2 };
}

function lastEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].event === name) return events[i].data;
  }
  return null;
}

function validPlacementsA() {
  return [
    { cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] }, // len 3
    { cells: [{ r: 2, c: 0 }, { r: 3, c: 0 }] }, // len 2
    { cells: [{ r: 4, c: 2 }, { r: 4, c: 3 }] }, // len 2
  ];
}

function validPlacementsB() {
  return [
    { cells: [{ r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }] }, // len 3
    { cells: [{ r: 0, c: 4 }, { r: 0, c: 5 }] }, // len 2
    { cells: [{ r: 5, c: 3 }, { r: 5, c: 4 }] }, // len 2
  ];
}

function startBattle(game) {
  game.start();
  game.clearTimers(); // skip waiting for countdown timer
  game.startPlacement();
  game.clearTimers(); // skip placement timeout auto-fill
  game.placeShips(game.p1.id, validPlacementsA());
  game.placeShips(game.p2.id, validPlacementsB());
  game.clearTimers(); // stop turn timer for deterministic tests
}

describe('Mini Battleship GameState', () => {
  let currentGame;

  afterEach(() => {
    if (currentGame) currentGame.stop();
    currentGame = null;
  });

  it('starts with initialized 6x6 boards and emits countdown state', () => {
    const { game, events } = createGame();
    currentGame = game;

    game.start();
    game.clearTimers();

    assert.equal(game.phase, 'countdown');
    assert.equal(game.boards.p1.length, GAME_CONFIG.GRID_SIZE);
    assert.equal(game.boards.p1[0].length, GAME_CONFIG.GRID_SIZE);
    assert.equal(game.shots.p2.length, GAME_CONFIG.GRID_SIZE);

    const state = lastEvent(events, 'battleship-state');
    assert.ok(state);
    assert.ok(state.byPlayer.p1);
    assert.ok(state.byPlayer.p2);
  });

  it('rejects invalid ship placements and keeps player unready', () => {
    const { game } = createGame();
    currentGame = game;
    game.start();
    game.clearTimers();
    game.startPlacement();
    game.clearTimers();

    const invalid = [
      { cells: [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }] }, // diagonal
      { cells: [{ r: 4, c: 0 }, { r: 4, c: 1 }] }, // len 2
      { cells: [{ r: 5, c: 0 }, { r: 5, c: 1 }] }, // len 2
    ];

    game.placeShips('p1', invalid);
    assert.equal(game.placementReady.p1, false);
    assert.equal(game.ships.p1.length, 0);
  });

  it('enters battle when both players submit valid placements', () => {
    const { game } = createGame();
    currentGame = game;

    startBattle(game);

    assert.equal(game.phase, 'battle');
    assert.equal(game.currentTurn, 'p1');
    assert.equal(game.placementReady.p1, true);
    assert.equal(game.placementReady.p2, true);
  });

  it('enforces turn ownership for fire actions', () => {
    const { game } = createGame();
    currentGame = game;

    startBattle(game);
    game.fireShot('p2', 0, 0); // not p2 turn yet

    const untouched = game.shots.p2.flat().every((cell) => cell === 0);
    assert.equal(untouched, true);
  });

  it('broadcasts per-player hidden state slices without leaking opponent board', () => {
    const { game, events } = createGame();
    currentGame = game;
    startBattle(game);
    events.length = 0;

    game.fireShot('p1', 1, 1); // hit known p2 ship cell
    game.clearTimers();

    const state = lastEvent(events, 'battleship-state');
    assert.ok(state);

    const p1Slice = state.byPlayer.p1;
    const p2Slice = state.byPlayer.p2;

    // p1 sees own shot result on opponent board.
    assert.equal(p1Slice.oppBoard[1][1], 'H');
    // p2 does not see p1's shot history in their own oppBoard slice.
    assert.equal(p2Slice.oppBoard[1][1], 0);
    // Opponent unsunk ship cells are not revealed by default.
    assert.deepEqual(p1Slice.sunkOppCells, []);
  });

  it('emits match-end when all opponent ships are sunk', () => {
    const { game, events } = createGame();
    currentGame = game;
    startBattle(game);
    events.length = 0;

    const targetCells = validPlacementsB().flatMap((ship) => ship.cells);
    for (const cell of targetCells) {
      game.currentTurn = 'p1'; // keep deterministic; isolate sink/win behavior
      game.fireShot('p1', cell.r, cell.c);
      game.clearTimers();
    }

    const end = lastEvent(events, 'match-end');
    assert.ok(end);
    assert.equal(end.winnerId, 'p1');
    assert.equal(end.tie, false);
    assert.equal(Array.isArray(end.scores), true);
    assert.equal(end.scores.length, 2);
  });

  it('pause/resume handle countdown, placement, and battle branches', () => {
    const { game } = createGame();
    currentGame = game;

    game.start();
    game.pause();
    assert.equal(game.paused, true);

    game.phase = 'countdown';
    game.resume();
    assert.equal(game.paused, false);

    game.phase = 'placement';
    game.resume();
    assert.equal(game.phase, 'placement');

    startBattle(game);
    game.pause();
    game.phase = 'battle';
    game.resume();
    assert.equal(game.phase, 'battle');
  });

  it('migrates player maps and current turn on reconnect', () => {
    const { game, p1 } = createGame();
    currentGame = game;
    startBattle(game);

    game.currentTurn = p1.id;
    game.migratePlayer(p1.id, 'p1-new', { id: 'p1-new', side: p1.side });

    assert.equal(game.p1.id, 'p1-new');
    assert.ok(game.boards['p1-new']);
    assert.ok(game.shots['p1-new']);
    assert.ok(game.ships['p1-new']);
    assert.equal(game.currentTurn, 'p1-new');
  });

  it('startCountdown callback advances to placement phase', () => {
    const { game } = createGame();
    currentGame = game;

    let cb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => {
      cb = fn;
      return 1;
    };
    try {
      game.start();
      assert.equal(game.phase, 'countdown');
      cb();
      assert.equal(game.phase, 'placement');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('placement timeout auto-places missing players then starts battle', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    let cb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => {
      cb = fn;
      return 1;
    };
    try {
      game.start();
      game.startPlacement();
      game.placeShips(p1.id, validPlacementsA());
      cb(); // placement timeout path

      assert.equal(game.phase, 'battle');
      assert.equal(game.placementReady[p1.id], true);
      assert.equal(game.placementReady[p2.id], true);
      assert.equal(game.ships[p2.id].length > 0, true);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it('autoPlace produces ship entries and autoFire can switch turn if no cells', () => {
    const { game, p1, p2 } = createGame();
    currentGame = game;

    game.start();
    game.startPlacement();
    game.autoPlace(p1.id);
    assert.equal(game.ships[p1.id].length, GAME_CONFIG.SHIPS.length);

    game.phase = 'battle';
    game.currentTurn = p1.id;
    game.shots[p1.id] = Array.from({ length: GAME_CONFIG.GRID_SIZE }, () =>
      Array.from({ length: GAME_CONFIG.GRID_SIZE }, () => 'M'));
    game.startTurnTimer = () => {};
    game.broadcastState = () => {};
    game.autoFire(p1.id);
    assert.equal(game.currentTurn, p2.id);
  });

  it('startTurnTimer timeout calls autoFire and finishMatch computes winner score', () => {
    const { game, p1, p2, events } = createGame();
    currentGame = game;

    let timerCb = null;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => {
      timerCb = fn;
      return 1;
    };
    try {
      startBattle(game);
      let autoFireCalled = false;
      game.autoFire = () => { autoFireCalled = true; };
      game.startTurnTimer();
      timerCb();
      assert.equal(autoFireCalled, true);

      // score path in finishMatch
      game.ships[p1.id] = [{ sunk: false, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }] }];
      game.ships[p2.id] = [{ sunk: true, cells: [{ r: 1, c: 1 }] }];
      game.boards[p1.id][0][0] = 'S';
      game.boards[p1.id][0][1] = 'S';
      game.finishMatch(p1.id);
      const end = lastEvent(events, 'match-end');
      assert.ok(end);
      assert.equal(end.winnerId, p1.id);
      assert.equal(end.scores[0] > end.scores[1], true);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
