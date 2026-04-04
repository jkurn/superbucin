import { io } from 'socket.io-client';

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.ui = null;
    this.sceneManager = null;
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
  }

  init(ui, sceneManager) {
    this.ui = ui;
    this.sceneManager = sceneManager;

    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.playerId = this.socket.id;
      console.log('Connected:', this.playerId);
    });

    this.socket.on('room-created', (data) => {
      this.roomCode = data.roomCode;
      this.isHost = true;
      this.ui.showWaitingRoom(data.roomCode);
    });

    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      this.ui.showSideSelect(data.roomCode);
    });

    this.socket.on('player-joined', () => {
      this.ui.showSideSelect(this.roomCode);
    });

    this.socket.on('side-selected', (data) => {
      this.ui.updateSideSelect(data);
    });

    this.socket.on('game-start', (data) => {
      this.ui.startGame(data);
    });

    this.socket.on('game-state', (state) => {
      if (this.ui.gameScene) {
        this.ui.gameScene.onServerState(state);
      }
    });

    this.socket.on('round-end', (data) => {
      if (this.ui.gameScene) {
        this.ui.gameScene.onRoundEnd(data);
      }
    });

    this.socket.on('match-end', (data) => {
      this.ui.showVictory(data);
    });

    this.socket.on('opponent-disconnected', () => {
      this.ui.showDisconnect();
    });

    this.socket.on('error', (data) => {
      alert(data.message || 'Something went wrong');
    });
  }

  createRoom() {
    this.socket.emit('create-room');
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
}
