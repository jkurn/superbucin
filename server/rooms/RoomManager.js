import { generateRoomCode } from '../utils/generateRoomCode.js';
import { GameState } from '../games/pig-vs-chick/GameState.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();      // roomCode -> room
    this.playerRooms = new Map(); // socketId -> roomCode
  }

  createRoom(socket) {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      code,
      players: [{ id: socket.id, socket, side: null, ready: false }],
      game: null,
      state: 'waiting', // waiting, side-select, playing, finished
    };

    this.rooms.set(code, room);
    this.playerRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-created', { roomCode: code });
    console.log(`Room ${code} created by ${socket.id}`);
  }

  joinRoom(socket, roomCode) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      socket.emit('error', { message: 'Room not found! Check the code sayang~' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full!' });
      return;
    }

    room.players.push({ id: socket.id, socket, side: null, ready: false });
    this.playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    room.state = 'side-select';

    // Notify both players
    this.io.to(roomCode).emit('room-joined', { roomCode });
    room.players[0].socket.emit('player-joined', {});
    console.log(`${socket.id} joined room ${roomCode}`);
  }

  selectSide(socket, side) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const otherPlayer = room.players.find((p) => p.id !== socket.id);

    // Check if other player already has this side
    if (otherPlayer && otherPlayer.side === side) {
      socket.emit('side-selected', { message: `${side} is already taken! Pick the other one~` });
      return;
    }

    player.side = side;
    player.ready = true;

    socket.emit('side-selected', { message: `You picked ${side}!` });

    // If both players have selected sides, start the game
    if (room.players.length === 2 && room.players.every((p) => p.ready)) {
      this.startGame(room);
    } else if (otherPlayer) {
      otherPlayer.socket.emit('side-selected', {
        message: `Opponent picked ${side}! Your turn~`,
      });
    }
  }

  startGame(room) {
    room.state = 'playing';

    const p1 = room.players[0];
    const p2 = room.players[1];

    room.game = new GameState(p1, p2, (event, data) => {
      this.handleGameEvent(room, event, data);
    });

    // Send game start to each player with their perspective
    p1.socket.emit('game-start', {
      yourSide: p1.side,
      yourDirection: 1,
      opponentSide: p2.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: 'You',
      p2Label: 'Sayang',
    });

    p2.socket.emit('game-start', {
      yourSide: p2.side,
      yourDirection: -1,
      opponentSide: p1.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: 'Sayang',
      p2Label: 'You',
    });

    // Start the game loop
    room.game.start();
    console.log(`Game started in room ${room.code}: ${p1.side} vs ${p2.side}`);
  }

  spawnUnit(socket, tier, lane) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) return;

    room.game.requestSpawn(socket.id, tier, lane);
  }

  handleGameEvent(room, event, data) {
    switch (event) {
      case 'state-update':
        // Send personalized state to each player
        room.players.forEach((p) => {
          p.socket.emit('game-state', {
            ...data,
            energy: data.energies[p.id],
          });
        });
        break;

      case 'round-end':
        room.players.forEach((p) => {
          p.socket.emit('round-end', {
            ...data,
            winnerIsYou: data.winnerId === p.id,
          });
        });
        break;

      case 'match-end':
        room.state = 'finished';
        room.players.forEach((p) => {
          p.socket.emit('match-end', {
            winner: data.winnerId,
            p1Score: data.scores[0],
            p2Score: data.scores[1],
            isWinner: data.winnerId === p.id,
          });
        });
        break;
    }
  }

  rematch(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Reset
    if (room.game) room.game.stop();
    room.players.forEach((p) => {
      p.side = null;
      p.ready = false;
    });
    room.state = 'side-select';

    this.io.to(roomCode).emit('room-joined', { roomCode });
  }

  handleDisconnect(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Notify other player
    const otherPlayer = room.players.find((p) => p.id !== socket.id);
    if (otherPlayer) {
      otherPlayer.socket.emit('opponent-disconnected');
    }

    // Clean up game
    if (room.game) room.game.stop();

    // Remove room
    this.rooms.delete(roomCode);
    room.players.forEach((p) => this.playerRooms.delete(p.id));

    console.log(`Room ${roomCode} destroyed (player disconnected)`);
  }
}
