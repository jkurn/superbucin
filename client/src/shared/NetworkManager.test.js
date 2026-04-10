import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NetworkManager } from './NetworkManager.js';
import { EventBus } from './EventBus.js';

class FakeSocket {
  constructor(id = 'sock-1') {
    this.id = id;
    this.handlers = new Map();
    this.emitted = [];
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  emit(event, payload) {
    this.emitted.push({ event, payload });
  }

  trigger(event, payload) {
    const handler = this.handlers.get(event);
    if (handler) handler(payload);
  }
}

function makeUI() {
  return {
    calls: [],
    showWaitingRoom(roomCode) { this.calls.push({ method: 'showWaitingRoom', args: [roomCode] }); },
    showSideSelect(roomCode) { this.calls.push({ method: 'showSideSelect', args: [roomCode] }); },
    updateSideSelect(data) { this.calls.push({ method: 'updateSideSelect', args: [data] }); },
    startGame(data) { this.calls.push({ method: 'startGame', args: [data] }); },
    showVictory(data) { this.calls.push({ method: 'showVictory', args: [data] }); },
    showAchievementToast(data) { this.calls.push({ method: 'showAchievementToast', args: [data] }); },
    showReconnecting() { this.calls.push({ method: 'showReconnecting', args: [] }); },
    hideReconnecting() { this.calls.push({ method: 'hideReconnecting', args: [] }); },
    showDisconnect() { this.calls.push({ method: 'showDisconnect', args: [] }); },
    showError(msg) { this.calls.push({ method: 'showError', args: [msg] }); },
    showLobby(opts) { this.calls.push({ method: 'showLobby', args: [opts] }); },
  };
}

describe('NetworkManager contracts', () => {
  let oldWindow;

  beforeEach(() => {
    oldWindow = globalThis.window;
    globalThis.window = {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:5173',
      },
    };
  });

  afterEach(() => {
    globalThis.window = oldWindow;
  });

  it('connect emits identify with user identity', () => {
    const fakeSocket = new FakeSocket('abc123');
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    const userManager = {
      getIdentity: () => ({ userId: 'u1', displayName: 'Jon' }),
      refreshProfile: () => {},
    };

    nm.init(ui, {}, userManager);
    fakeSocket.trigger('connect');

    assert.equal(nm.playerId, 'abc123');
    const identify = fakeSocket.emitted.find((e) => e.event === 'identify');
    assert.ok(identify);
    assert.deepEqual(identify.payload, { userId: 'u1', displayName: 'Jon' });
  });

  it('room-created updates manager state and shows waiting room', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    fakeSocket.trigger('room-created', { roomCode: 'ABCD', gameType: 'othello' });

    assert.equal(nm.roomCode, 'ABCD');
    assert.equal(nm.roomGameType, 'othello');
    assert.equal(nm.isHost, true);
    assert.deepEqual(ui.calls[0], { method: 'showWaitingRoom', args: ['ABCD'] });
  });

  it('room-joined sets opponent identity and shows side select when required', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    fakeSocket.trigger('room-joined', {
      roomCode: 'WXYZ',
      gameType: 'connect-four',
      skipSideSelect: false,
      opponentIdentity: { displayName: 'Rival' },
    });

    assert.equal(nm.roomCode, 'WXYZ');
    assert.equal(nm.roomGameType, 'connect-four');
    assert.deepEqual(nm.opponentIdentity, { displayName: 'Rival' });
    assert.deepEqual(ui.calls[0], { method: 'showSideSelect', args: ['WXYZ'] });
  });

  it('achievement-unlocked shows toast only when achievements exist', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    fakeSocket.trigger('achievement-unlocked', { achievements: [] });
    fakeSocket.trigger('achievement-unlocked', { achievements: [{ id: 'a1' }] });

    const toasts = ui.calls.filter((c) => c.method === 'showAchievementToast');
    assert.equal(toasts.length, 1);
    assert.deepEqual(toasts[0].args[0], [{ id: 'a1' }]);
  });

  it('match-end shows victory and refreshes profile', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    let refreshCount = 0;

    nm.init(ui, {}, {
      getIdentity: () => ({}),
      refreshProfile: () => { refreshCount += 1; },
    });

    nm._inGame = true;
    fakeSocket.trigger('match-end', { winner: 'p1' });

    assert.equal(nm._inGame, false);
    assert.equal(refreshCount, 1);
    assert.deepEqual(ui.calls[0], { method: 'showVictory', args: [{ winner: 'p1' }] });
  });

  it('opponent-disconnected toggles reconnect vs disconnect UI', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    nm._inGame = true;

    fakeSocket.trigger('opponent-disconnected', { reconnecting: true });
    fakeSocket.trigger('opponent-disconnected', { reconnecting: false });

    assert.deepEqual(
      ui.calls.map((c) => c.method),
      ['showReconnecting', 'showDisconnect'],
    );
    assert.equal(nm._inGame, false);
  });

  it('action-error emits EventBus and shows error', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    const oldEmit = EventBus.emit;
    const emitted = [];

    EventBus.emit = (event, data) => {
      emitted.push({ event, data });
    };

    try {
      nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
      fakeSocket.trigger('action-error', { message: 'Invalid move', code: 'BAD_ACTION' });

      assert.deepEqual(emitted[0], {
        event: 'game:action-error',
        data: { message: 'Invalid move', code: 'BAD_ACTION' },
      });
      assert.deepEqual(ui.calls[0], { method: 'showError', args: ['Invalid move'] });
    } finally {
      EventBus.emit = oldEmit;
    }
  });

  it('room-error for missing room navigates to lobby flow', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    let navigated = false;

    nm._navigateToLobby = () => {
      navigated = true;
      ui.showLobby({ fromRouter: true });
    };

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    fakeSocket.trigger('room-error', { message: 'Room not found! Check the code sayang~' });

    assert.equal(navigated, true);
    assert.deepEqual(ui.calls.map((c) => c.method), ['showError', 'showLobby']);
  });

  it('getDebugSnapshot captures latest game state payloads', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();

    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    fakeSocket.trigger('memory-state', { turn: 1, payload: { p1: { score: 2 } } });
    fakeSocket.trigger('battleship-state', { phase: 'battle' });

    const snapshot = nm.getDebugSnapshot();
    assert.equal(snapshot.roomGameType, 'pig-vs-chick');
    assert.deepEqual(snapshot.latestStateByEvent['memory-state'], {
      turn: 1,
      payload: { p1: { score: 2 } },
    });
    assert.deepEqual(snapshot.latestStateByEvent['battleship-state'], { phase: 'battle' });
  });

  it('connect reconnects previous room and deep-link joins pending code', () => {
    const fakeSocket = new FakeSocket('sock-r1');
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    nm.init(ui, {}, { getIdentity: () => ({ userId: 'u1' }), refreshProfile: () => {} });

    nm.roomCode = 'ABCD';
    nm._wasInGame = true;
    fakeSocket.trigger('connect');
    const rejoin = fakeSocket.emitted.find((e) => e.event === 'rejoin-room');
    assert.ok(rejoin);
    assert.deepEqual(rejoin.payload, { roomCode: 'ABCD' });
    assert.equal(nm._wasInGame, false);

    nm.pendingJoinCode = 'z9x8';
    fakeSocket.trigger('connect');
    const join = fakeSocket.emitted.find((e) => e.event === 'join-room');
    assert.ok(join);
    assert.deepEqual(join.payload, { roomCode: 'Z9X8' });
    assert.equal(nm.pendingJoinCode, null);
  });

  it('disconnect marks wasInGame only when already in game', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });
    nm.roomCode = 'ABCD';

    nm._inGame = false;
    fakeSocket.trigger('disconnect', 'transport close');
    assert.equal(nm._wasInGame, false);

    nm._inGame = true;
    fakeSocket.trigger('disconnect', 'transport close');
    assert.equal(nm._wasInGame, true);
  });

  it('routes state events through EventBus and wrapper methods emit socket events', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    const oldEmit = EventBus.emit;
    const emitted = [];
    EventBus.emit = (event, data) => emitted.push({ event, data });
    try {
      nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });

      fakeSocket.trigger('game-state', { hp: 10 });
      fakeSocket.trigger('word-scramble-state', { phase: 'playing' });
      fakeSocket.trigger('word-scramble-feedback', { ok: true });
      fakeSocket.trigger('memory-state', { turn: 'p1' });
      fakeSocket.trigger('speed-match-state', { q: 1 });
      fakeSocket.trigger('vending-state', { yen: 999 });
      fakeSocket.trigger('bonk-state', { hp: 80 });
      fakeSocket.trigger('cute-aggression-state', { combo: 2 });
      fakeSocket.trigger('sticker-hit-state', { stage: 3 });

      assert.ok(emitted.find((e) => e.event === 'game:state'));
      assert.ok(emitted.find((e) => e.event === 'word:state'));
      assert.ok(emitted.find((e) => e.event === 'word:feedback'));
      assert.ok(emitted.find((e) => e.event === 'memory:state'));
      assert.ok(emitted.find((e) => e.event === 'speed-match:state'));
      assert.ok(emitted.find((e) => e.event === 'vending:state'));
      assert.ok(emitted.find((e) => e.event === 'bonk:state'));
      assert.ok(emitted.find((e) => e.event === 'cute-aggression:state'));
      assert.ok(emitted.find((e) => e.event === 'sticker-hit:state'));

      nm.createRoom('othello');
      nm.createRoom('doodle-guess', ['cat']);
      nm.createRoom({ gameType: 'memory-match', speedMode: true });
      nm.createRoom(null);
      nm.memoryFlip(3);
      nm.joinRoom('ab12');
      nm.selectSide('black');
      nm.spawnUnit(2, 'top');
      nm.sendGameAction({ type: 'answer', value: 1 });
      nm.requestRematch();
      nm.submitWord([{ r: 0, c: 0 }]);

      const eventNames = fakeSocket.emitted.map((e) => e.event);
      assert.ok(eventNames.includes('create-room'));
      assert.ok(eventNames.includes('memory-flip'));
      assert.ok(eventNames.includes('join-room'));
      assert.ok(eventNames.includes('select-side'));
      assert.ok(eventNames.includes('spawn-unit'));
      assert.ok(eventNames.includes('game-action'));
      assert.ok(eventNames.includes('rematch'));
      assert.ok(eventNames.includes('submit-word'));
    } finally {
      EventBus.emit = oldEmit;
    }
  });

  it('player/join flow branch behavior and room-error without lobby navigation', () => {
    const fakeSocket = new FakeSocket();
    const nm = new NetworkManager(() => fakeSocket);
    const ui = makeUI();
    let navCount = 0;
    nm._navigateToLobby = () => { navCount += 1; };
    nm.init(ui, {}, { getIdentity: () => ({}), refreshProfile: () => {} });

    fakeSocket.trigger('room-joined', {
      roomCode: 'A1B2',
      gameType: 'memory-match',
      skipSideSelect: true,
      opponentIdentity: { displayName: 'opp' },
    });
    assert.equal(ui.calls.length, 0);

    fakeSocket.trigger('player-joined', { gameType: 'othello', skipSideSelect: true });
    assert.equal(ui.calls.length, 0);
    fakeSocket.trigger('player-joined', { gameType: 'othello', skipSideSelect: false });
    assert.equal(ui.calls[0].method, 'showSideSelect');

    fakeSocket.trigger('side-selected', { message: 'ok' });
    assert.equal(ui.calls.find((c) => c.method === 'updateSideSelect').args[0].message, 'ok');

    fakeSocket.trigger('game-start', { yourSide: 'black', opponentIdentity: { displayName: 'new' } });
    assert.equal(nm._inGame, true);
    assert.deepEqual(nm.opponentIdentity, { displayName: 'new' });

    fakeSocket.trigger('opponent-reconnected');
    assert.ok(ui.calls.find((c) => c.method === 'hideReconnecting'));

    fakeSocket.trigger('room-error', { message: 'Validation failed' });
    assert.equal(navCount, 0);
  });
});
