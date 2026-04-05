import { generateRoomCode } from '../utils/generateRoomCode.js';
import { GameFactory } from '../games/GameFactory.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();      // roomCode -> room
    this.playerRooms = new Map(); // socketId -> roomCode
  }

  createRoom(socket, gameType = 'pig-vs-chick') {
    if (!GameFactory.has(gameType)) {
      socket.emit('error', { message: 'Unknown game type!' });
      return;
    }

    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      code,
      gameType,
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

    room.game = GameFactory.create(room.gameType, p1, p2, (event, data) => {
      this.handleGameEvent(room, event, data);
    });

    const gameConfig = GameFactory.getConfig(room.gameType);

    p1.socket.emit('game-start', {
      gameType: room.gameType,
      yourSide: p1.side,
      yourDirection: 1,
      opponentSide: p2.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: 'You',
      p2Label: 'Sayang',
      gameConfig,
    });

    p2.socket.emit('game-start', {
      gameType: room.gameType,
      yourSide: p2.side,
      yourDirection: -1,
      opponentSide: p1.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: 'Sayang',
      p2Label: 'You',
      gameConfig,
    });

    room.game.start();
    console.log(`Game started in room ${room.code} [${room.gameType}]: ${p1.side} vs ${p2.side}`);
  }

  spawnUnit(socket, tier, lane) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) return;

    room.game.requestSpawn(socket.id, tier, lane);
  }

  handleGameEvent(room, event, data) {
    // Only emit to connected players
    const connected = room.players.filter((p) => !p.disconnected);

    switch (event) {
      case 'state-update':
        connected.forEach((p) => {
          p.socket.emit('game-state', {
            units: data.units,
            playerHP: data.playerHP,
            energy: data.energies[p.id],
          });
        });
        break;

      case 'match-end':
        room.state = 'finished';
        connected.forEach((p) => {
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

  rejoinRoom(socket, roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room expired! Start a new game sayang~' });
      return;
    }

    // Find the disconnected player slot
    const dcPlayer = room.players.find((p) => p.disconnected);
    if (!dcPlayer) {
      socket.emit('error', { message: 'No open slot to rejoin!' });
      return;
    }

    // Clear the destruction timer
    if (room._disconnectTimer) {
      clearTimeout(room._disconnectTimer);
      room._disconnectTimer = null;
    }

    // Swap in the new socket
    const oldId = dcPlayer.id;
    this.playerRooms.delete(oldId);
    dcPlayer.id = socket.id;
    dcPlayer.socket = socket;
    dcPlayer.disconnected = false;
    this.playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    // Update GameState player ID references
    if (room.game) {
      if (room.game.p1.id === oldId) {
        room.game.p1 = dcPlayer;
        // Migrate energy and HP keys
        room.game.energies[socket.id] = room.game.energies[oldId];
        delete room.game.energies[oldId];
        room.game.playerHP[socket.id] = room.game.playerHP[oldId];
        delete room.game.playerHP[oldId];
        // Migrate unit ownership
        room.game.units.forEach((u) => { if (u.ownerId === oldId) u.ownerId = socket.id; });
      } else if (room.game.p2.id === oldId) {
        room.game.p2 = dcPlayer;
        room.game.energies[socket.id] = room.game.energies[oldId];
        delete room.game.energies[oldId];
        room.game.playerHP[socket.id] = room.game.playerHP[oldId];
        delete room.game.playerHP[oldId];
        room.game.units.forEach((u) => { if (u.ownerId === oldId) u.ownerId = socket.id; });
      }
    }

    // Notify opponent
    const otherPlayer = room.players.find((p) => p.id !== socket.id);
    if (otherPlayer) {
      otherPlayer.socket.emit('opponent-reconnected');
    }

    // Resume game or restore state
    if (room.state === 'playing' && room.game) {
      const isP1 = room.game.p1.id === socket.id;
      const p1 = room.players[0];
      const p2 = room.players[1];

      socket.emit('game-start', {
        gameType: room.gameType,
        yourSide: dcPlayer.side,
        yourDirection: isP1 ? 1 : -1,
        opponentSide: otherPlayer.side,
        p1Side: p1.side,
        p2Side: p2.side,
        p1Label: isP1 ? 'You' : 'Sayang',
        p2Label: isP1 ? 'Sayang' : 'You',
        gameConfig: GameFactory.getConfig(room.gameType),
        reconnect: true,
      });

      room.game.resume();
    } else {
      // Not in a game — just put them back in the room
      socket.emit('room-joined', { roomCode });
    }

    console.log(`${socket.id} rejoined room ${roomCode}`);
  }

  handleDisconnect(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    const otherPlayer = room.players.find((p) => p.id !== socket.id);

    // If game is active, give a 15-second grace period
    if (room.state === 'playing' && room.game && player) {
      player.disconnected = true;
      room.game.pause();

      if (otherPlayer) {
        otherPlayer.socket.emit('opponent-disconnected', { reconnecting: true });
      }

      room._disconnectTimer = setTimeout(() => {
        // Grace period expired — destroy the room
        if (otherPlayer) {
          otherPlayer.socket.emit('opponent-disconnected', { reconnecting: false });
        }
        if (room.game) room.game.stop();
        this.rooms.delete(roomCode);
        room.players.forEach((p) => this.playerRooms.delete(p.id));
        console.log(`Room ${roomCode} destroyed (reconnect timeout)`);
      }, 15000);

      console.log(`Player disconnected from room ${roomCode}, waiting 15s for reconnect...`);
      return;
    }

    // Not in a game — destroy immediately
    if (otherPlayer) {
      otherPlayer.socket.emit('opponent-disconnected', { reconnecting: false });
    }
    if (room.game) room.game.stop();
    this.rooms.delete(roomCode);
    room.players.forEach((p) => this.playerRooms.delete(p.id));

    console.log(`Room ${roomCode} destroyed (player disconnected)`);
  }
}
