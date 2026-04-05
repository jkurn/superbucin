import { io } from 'socket.io-client';
import { EventBus } from './EventBus.js';

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.ui = null;
    this.sceneManager = null;
    this.roomCode = null;
    this.gameType = null;
    this.playerId = null;
    this.isHost = false;
    this._inGame = false;
    this._wasInGame = false;
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
      if (data.gameType) this.gameType = data.gameType;
      this.isHost = true;
      this.ui.showWaitingRoom(data.roomCode);
    });

    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      if (data.gameType) this.gameType = data.gameType;
      this.ui.showSideSelect(data.roomCode);
    });

    this.socket.on('player-joined', () => {
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

    this.socket.on('action-error', (data) => {
      EventBus.emit('game:action-error', data);
      this.ui.showError(data.message);
    });

    this.socket.on('error', (data) => {
      this.ui.showError(data.message || 'Something went wrong');
    });
  }

  createRoom(gameType) {
    this.socket.emit('create-room', { gameType });
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

  sendGameAction(action) {
    this.socket.emit('game-action', action);
  }

  requestRematch() {
    this.socket.emit('rematch');
  }
}
