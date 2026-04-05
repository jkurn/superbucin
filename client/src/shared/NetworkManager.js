import { io } from 'socket.io-client';
import { EventBus } from './EventBus.js';

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.ui = null;
    this.sceneManager = null;
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this._inGame = false;
    this._wasInGame = false;
    this.roomGameType = 'pig-vs-chick';
  }

  init(ui, sceneManager) {
    this.ui = ui;
    this.sceneManager = sceneManager;

    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin;

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.playerId = this.socket.id;
      console.log('Connected:', this.playerId);

      // Auto-rejoin if we had an active room (reconnection after brief disconnect)
      if (this.roomCode && this._wasInGame) {
        console.log('Attempting rejoin:', this.roomCode);
        this.socket.emit('rejoin-room', { roomCode: this.roomCode });
        this._wasInGame = false;
      }
    });

    this.socket.on('disconnect', () => {
      // Mark that we were in a game so we can auto-rejoin on reconnect
      if (this.roomCode && this._inGame) {
        this._wasInGame = true;
      }
    });

    this.socket.on('room-created', (data) => {
      this.roomCode = data.roomCode;
      this.roomGameType = data.gameType || 'pig-vs-chick';
      this.isHost = true;
      this.ui.showWaitingRoom(data.roomCode);
    });

    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      if (data.gameType) this.roomGameType = data.gameType;
      if (data.skipSideSelect) return;
      this.ui.showSideSelect(data.roomCode);
    });

    this.socket.on('player-joined', (data) => {
      if (data?.gameType) this.roomGameType = data.gameType;
      if (data?.skipSideSelect) return;
      this.ui.showSideSelect(this.roomCode);
    });

    this.socket.on('side-selected', (data) => {
      this.ui.updateSideSelect(data);
    });

    this.socket.on('game-start', (data) => {
      this._inGame = true;
      this.ui.startGame(data);
    });

    this.socket.on('game-state', (state) => {
      EventBus.emit('game:state', state);
    });

    this.socket.on('word-scramble-state', (state) => {
      EventBus.emit('word:state', state);
    });

    this.socket.on('word-scramble-feedback', (payload) => {
      EventBus.emit('word:feedback', payload);
    });

    this.socket.on('memory-state', (state) => {
      EventBus.emit('memory:state', state);
    });

    this.socket.on('match-end', (data) => {
      this._inGame = false;
      this.ui.showVictory(data);
    });

    this.socket.on('opponent-disconnected', (data) => {
      if (data && data.reconnecting) {
        this.ui.showReconnecting();
      } else {
        this._inGame = false;
        this.ui.showDisconnect();
      }
    });

    this.socket.on('opponent-reconnected', () => {
      this.ui.hideReconnecting();
    });

    this.socket.on('error', (data) => {
      this.ui.showError(data.message || 'Something went wrong');
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
    this.socket.emit('create-room', payload);
  }

  memoryFlip(index) {
    this.socket.emit('memory-flip', { index });
  }

  joinRoom(code) {
    this.socket.emit('join-room', { roomCode: code.toUpperCase() });
  }

  selectSide(side) {
    this.socket.emit('select-side', { side });
  }

  spawnUnit(tier, lane) {
    this.socket.emit('spawn-unit', { tier, lane });
  }

  requestRematch() {
    this.socket.emit('rematch');
  }

  submitWord(path) {
    this.socket.emit('submit-word', { path });
  }
}
