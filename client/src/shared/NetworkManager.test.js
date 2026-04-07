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
});
