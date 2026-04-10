import { io } from 'socket.io-client';
import { EventBus } from './EventBus.js';
import { captureEvent } from './analytics.js';

const STATE_EVENT_BRIDGE = {
  'game-state': 'game:state',
  'word-scramble-state': 'word:state',
  'memory-state': 'memory:state',
  'speed-match-state': 'speed-match:state',
  'battleship-state': 'battleship:state',
  'vending-state': 'vending:state',
  'bonk-state': 'bonk:state',
  'cute-aggression-state': 'cute-aggression:state',
  'sticker-hit-state': 'sticker-hit:state',
};

const OUTBOUND_SOCKET_EVENTS = {
  identify: 'identify',
  rejoinRoom: 'rejoin-room',
  createRoom: 'create-room',
  memoryFlip: 'memory-flip',
  joinRoom: 'join-room',
  selectSide: 'select-side',
  spawnUnit: 'spawn-unit',
  gameAction: 'game-action',
  rematch: 'rematch',
  submitWord: 'submit-word',
};

export class NetworkManager {
  constructor(socketFactory = io) {
    this.socketFactory = socketFactory;
    this.socket = null;
    this.ui = null;
    this.sceneManager = null;
    this.userManager = null;
    this.roomCode = null;
    this.gameType = null;
    this.playerId = null;
    this.isHost = false;
    this._inGame = false;
    this._wasInGame = false;
    this.roomGameType = 'pig-vs-chick';
    this.opponentIdentity = null;
    this.pendingJoinCode = null;
    this.latestStateByEvent = {};
  }

  init(ui, sceneManager, userManager) {
    this.ui = ui;
    this.sceneManager = sceneManager;
    this.userManager = userManager;

    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin;

    this.socket = this.socketFactory(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 20,
      timeout: 30000,
    });

    this.socket.on('connect', () => {
      this.playerId = this.socket.id;
      this._track('socket_connected', this._connectionContext());

      this._emit(OUTBOUND_SOCKET_EVENTS.identify, this.userManager.getIdentity());

      if (this.roomCode && this._wasInGame) {
        this._emit(OUTBOUND_SOCKET_EVENTS.rejoinRoom, { roomCode: this.roomCode });
        this._wasInGame = false;
      } else if (this.pendingJoinCode) {
        const code = this.pendingJoinCode;
        this.pendingJoinCode = null;
        this.joinRoom(code);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this._track('socket_disconnected', {
        ...this._connectionContext(),
        reason: reason || 'unknown',
      });
      if (this.roomCode && this._inGame) {
        this._wasInGame = true;
      }
    });

    this.socket.on('connect_error', (err) => {
      this._track('socket_connect_error', {
        message: err?.message || 'unknown',
      });
    });

    this.socket.on('room-created', (data) => {
      this.roomCode = data.roomCode;
      this.roomGameType = data.gameType || 'pig-vs-chick';
      this.isHost = true;
      captureEvent('room_created', {
        roomCode: data.roomCode,
        gameType: this.roomGameType,
      });
      this.ui.showWaitingRoom(data.roomCode);
    });

    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      if (data.gameType) this.roomGameType = data.gameType;
      if (data.opponentIdentity) this.opponentIdentity = data.opponentIdentity;
      captureEvent('room_joined', {
        roomCode: data.roomCode,
        gameType: this.roomGameType,
        skipSideSelect: !!data.skipSideSelect,
      });
      if (data.skipSideSelect) return;
      this.ui.showSideSelect(data.roomCode);
    });

    this.socket.on('player-joined', (data) => {
      if (data?.gameType) this.roomGameType = data.gameType;
      if (data?.opponentIdentity) this.opponentIdentity = data.opponentIdentity;
      captureEvent('room_player_joined', {
        roomCode: this.roomCode,
        gameType: this.roomGameType,
        skipSideSelect: !!data?.skipSideSelect,
      });
      if (data?.skipSideSelect) return;
      this.ui.showSideSelect(this.roomCode);
    });

    this.socket.on('side-selected', (data) => {
      this.ui.updateSideSelect(data);
    });

    this.socket.on('game-start', (data) => {
      this._inGame = true;
      if (data.opponentIdentity) this.opponentIdentity = data.opponentIdentity;
      captureEvent('game_started', {
        roomCode: this.roomCode,
        gameType: data.gameType || this.roomGameType,
        isHost: this.isHost,
      });
      this.ui.startGame(data);
    });

    Object.entries(STATE_EVENT_BRIDGE).forEach(([socketEvent, busEvent]) => {
      this.socket.on(socketEvent, (state) => {
        this._captureState(socketEvent, state);
        EventBus.emit(busEvent, state);
      });
    });

    this.socket.on('word-scramble-feedback', (payload) => {
      EventBus.emit('word:feedback', payload);
    });


    this.socket.on('match-end', (data) => {
      this._inGame = false;
      this._track('match_ended', {
        ...this._roomAndGameContext(),
        winner: data.winner,
        loser: data.loser,
      });
      EventBus.emit('game:match-end', data);
      this.ui.showVictory(data);
      this.userManager.refreshProfile();
    });

    this.socket.on('achievement-unlocked', (data) => {
      if (data.achievements && data.achievements.length > 0) {
        captureEvent('achievement_unlocked', {
          count: data.achievements.length,
          ids: data.achievements
            .map((a) => a.id || a.slug || a.key)
            .filter(Boolean)
            .slice(0, 24),
        });
        this.ui.showAchievementToast(data.achievements);
      }
    });

    this.socket.on('opponent-disconnected', (data) => {
      captureEvent('opponent_disconnected', {
        reconnecting: !!(data && data.reconnecting),
        roomCode: this.roomCode,
        inGame: this._inGame,
      });
      if (data && data.reconnecting) {
        this.ui.showReconnecting();
      } else {
        this._inGame = false;
        this.ui.showDisconnect();
      }
    });

    this.socket.on('opponent-reconnected', () => {
      captureEvent('opponent_reconnected', { roomCode: this.roomCode });
      this.ui.hideReconnecting();
    });

    this.socket.on('action-error', (data) => {
      this._track('game_action_error', {
        ...this._roomAndGameContext(),
        message: data?.message || null,
      });
      EventBus.emit('game:action-error', data);
      this.ui.showError(data.message);
    });

    this.socket.on('room-error', (data) => {
      const msg = data.message || 'Something went wrong';
      this._track('room_error', {
        ...this._roomAndGameContext(),
        message: msg,
      });
      this.ui.showError(msg);

      // If the error relates to a room not found (deep link), go back to lobby
      if (this._shouldReturnToLobbyFromRoomError(msg)) {
        this._navigateToLobby();
      }
    });
  }

  _navigateToLobby() {
    // Lazy import to avoid circular dependency with Router
    import('./Router.js').then(({ Router }) => {
      Router.navigate('/');
      this.ui.showLobby({ fromRouter: true });
    });
  }

  createRoom(gameTypeOrPayload, customPrompts) {
    let payload;
    if (typeof gameTypeOrPayload === 'string') {
      payload = { gameType: gameTypeOrPayload };
      if (Array.isArray(customPrompts) && customPrompts.length > 0) {
        payload.customPrompts = customPrompts;
      }
    } else {
      payload = gameTypeOrPayload && typeof gameTypeOrPayload === 'object'
        ? { ...gameTypeOrPayload }
        : { gameType: 'pig-vs-chick' };
    }
    captureEvent('create_room_attempt', {
      gameType: payload.gameType || 'pig-vs-chick',
      hasCustomPrompts: Array.isArray(payload.customPrompts) && payload.customPrompts.length > 0,
    });
    this._emit(OUTBOUND_SOCKET_EVENTS.createRoom, payload);
  }

  memoryFlip(index) {
    this._emit(OUTBOUND_SOCKET_EVENTS.memoryFlip, { index });
  }

  joinRoom(code) {
    captureEvent('join_room_attempt', {
      roomCode: code.toUpperCase(),
    });
    this._emit(OUTBOUND_SOCKET_EVENTS.joinRoom, { roomCode: code.toUpperCase() });
  }

  selectSide(side) {
    captureEvent('side_selected', {
      roomCode: this.roomCode,
      gameType: this.roomGameType,
      side,
    });
    this._emit(OUTBOUND_SOCKET_EVENTS.selectSide, { side });
  }

  spawnUnit(tier, lane) {
    this._emit(OUTBOUND_SOCKET_EVENTS.spawnUnit, { tier, lane });
  }

  sendGameAction(action) {
    this._emit(OUTBOUND_SOCKET_EVENTS.gameAction, action);
  }

  requestRematch() {
    this._track('rematch_requested', this._roomAndGameContext());
    this._emit(OUTBOUND_SOCKET_EVENTS.rematch);
  }

  submitWord(path) {
    this._emit(OUTBOUND_SOCKET_EVENTS.submitWord, { path });
  }

  _track(eventName, properties = {}) {
    captureEvent(eventName, properties);
  }

  _connectionContext() {
    return {
      roomCode: this.roomCode,
      inGame: this._inGame,
    };
  }

  _roomAndGameContext() {
    return {
      roomCode: this.roomCode,
      gameType: this.gameType || this.roomGameType,
    };
  }

  _shouldReturnToLobbyFromRoomError(message) {
    const lower = String(message || '').toLowerCase();
    return lower.includes('room not found') || lower.includes('room is full') || lower.includes('no room');
  }

  _emit(eventName, payload) {
    if (typeof payload === 'undefined') {
      this.socket.emit(eventName);
      return;
    }
    this.socket.emit(eventName, payload);
  }

  _captureState(eventName, payload) {
    this.latestStateByEvent[eventName] = payload;
  }

  getDebugSnapshot() {
    return {
      connected: !!this.socket?.id,
      playerId: this.playerId,
      roomCode: this.roomCode,
      roomGameType: this.roomGameType,
      isHost: this.isHost,
      inGame: this._inGame,
      opponentIdentity: this.opponentIdentity,
      latestStateByEvent: this.latestStateByEvent,
    };
  }
}
