import { io } from 'socket.io-client';
import { EventBus } from './EventBus.js';
import { captureEvent } from './analytics.js';

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
      console.log('Connected:', this.playerId);
      captureEvent('socket_connected', {
        roomCode: this.roomCode,
        inGame: this._inGame,
      });

      this.socket.emit('identify', this.userManager.getIdentity());

      if (this.roomCode && this._wasInGame) {
        console.log('Attempting rejoin:', this.roomCode);
        this.socket.emit('rejoin-room', { roomCode: this.roomCode });
        this._wasInGame = false;
      } else if (this.pendingJoinCode) {
        const code = this.pendingJoinCode;
        this.pendingJoinCode = null;
        console.log('Deep-link join:', code);
        this.joinRoom(code);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      captureEvent('socket_disconnected', {
        reason: reason || 'unknown',
        roomCode: this.roomCode,
        inGame: this._inGame,
      });
      if (this.roomCode && this._inGame) {
        this._wasInGame = true;
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Connection error:', err.message);
      captureEvent('socket_connect_error', {
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

    this.socket.on('game-state', (state) => {
      this._captureState('game-state', state);
      EventBus.emit('game:state', state);
    });

    this.socket.on('word-scramble-state', (state) => {
      this._captureState('word-scramble-state', state);
      EventBus.emit('word:state', state);
    });

    this.socket.on('word-scramble-feedback', (payload) => {
      EventBus.emit('word:feedback', payload);
    });

    this.socket.on('memory-state', (state) => {
      this._captureState('memory-state', state);
      EventBus.emit('memory:state', state);
    });

    this.socket.on('speed-match-state', (state) => {
      this._captureState('speed-match-state', state);
      EventBus.emit('speed-match:state', state);
    });

    this.socket.on('battleship-state', (state) => {
      this._captureState('battleship-state', state);
      EventBus.emit('battleship:state', state);
    });

    this.socket.on('vending-state', (state) => {
      this._captureState('vending-state', state);
      EventBus.emit('vending:state', state);
    });

    this.socket.on('bonk-state', (state) => {
      this._captureState('bonk-state', state);
      EventBus.emit('bonk:state', state);
    });

    this.socket.on('cute-aggression-state', (state) => {
      this._captureState('cute-aggression-state', state);
      EventBus.emit('cute-aggression:state', state);
    });

    this.socket.on('match-end', (data) => {
      this._inGame = false;
      captureEvent('match_ended', {
        roomCode: this.roomCode,
        gameType: this.gameType || this.roomGameType,
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
      captureEvent('game_action_error', {
        roomCode: this.roomCode,
        gameType: this.gameType || this.roomGameType,
        message: data?.message || null,
      });
      EventBus.emit('game:action-error', data);
      this.ui.showError(data.message);
    });

    this.socket.on('room-error', (data) => {
      const msg = data.message || 'Something went wrong';
      captureEvent('room_error', {
        roomCode: this.roomCode,
        gameType: this.gameType || this.roomGameType,
        message: msg,
      });
      this.ui.showError(msg);

      // If the error relates to a room not found (deep link), go back to lobby
      const lower = msg.toLowerCase();
      if (lower.includes('room not found') || lower.includes('room is full') || lower.includes('no room')) {
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
    this.socket.emit('create-room', payload);
  }

  memoryFlip(index) {
    this.socket.emit('memory-flip', { index });
  }

  joinRoom(code) {
    captureEvent('join_room_attempt', {
      roomCode: code.toUpperCase(),
    });
    this.socket.emit('join-room', { roomCode: code.toUpperCase() });
  }

  selectSide(side) {
    captureEvent('side_selected', {
      roomCode: this.roomCode,
      gameType: this.roomGameType,
      side,
    });
    this.socket.emit('select-side', { side });
  }

  spawnUnit(tier, lane) {
    this.socket.emit('spawn-unit', { tier, lane });
  }

  sendGameAction(action) {
    this.socket.emit('game-action', action);
  }

  requestRematch() {
    captureEvent('rematch_requested', {
      roomCode: this.roomCode,
      gameType: this.gameType || this.roomGameType,
    });
    this.socket.emit('rematch');
  }

  submitWord(path) {
    this.socket.emit('submit-word', { path });
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
