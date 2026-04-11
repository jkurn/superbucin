import { generateRoomCode } from '../utils/generateRoomCode.js';
import { GameFactory } from '../games/GameFactory.js';
import { MEMORY_MATCH_CONFIG } from '../games/memory-match/config.js';
import { UserService } from '../services/UserService.js';

function normalizeMemoryOptions(data) {
  if (!data || data.gameType !== 'memory-match') return {};
  const packId = typeof data.packId === 'string' ? data.packId : MEMORY_MATCH_CONFIG.DEFAULT_PACK;
  const rawGrid = Number(data.gridSize);
  const gridSize = rawGrid >= 6 ? 6 : 4;
  return {
    packId,
    gridSize,
    speedMode: !!data.speedMode,
  };
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRooms = new Map();
    this.playerIdentities = new Map();
  }

  setIdentity(socket, data) {
    if (!data) return;
    this.playerIdentities.set(socket.id, {
      userId: data.userId || null,
      displayName: data.displayName || 'Guest',
      username: data.username || null,
      avatarUrl: data.avatarUrl || '/avatars/panda.png',
      tag: data.tag || null,
      isGuest: data.isGuest !== false,
    });
  }

  _getIdentity(socketId) {
    return this.playerIdentities.get(socketId) || {
      userId: null,
      displayName: 'Guest',
      avatarUrl: '/avatars/panda.png',
      isGuest: true,
    };
  }

  _getDisplayName(socketId) {
    const id = this._getIdentity(socketId);
    if (id.username) return id.username;
    if (id.tag) return `${id.displayName} #${id.tag}`;
    return id.displayName;
  }

  createRoom(socket, data = {}) {
    const gameType = typeof data === 'string' ? data : (data?.gameType || 'pig-vs-chick');
    const customPrompts = Array.isArray(data?.customPrompts)
      ? data.customPrompts.map((s) => String(s).trim()).filter(Boolean).slice(0, 80)
      : [];

    if (!GameFactory.has(gameType)) {
      console.log(`Create failed: unknown game type '${gameType}'`);
      socket.emit('room-error', { message: 'Unknown game type!' });
      return;
    }

    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      code,
      gameType,
      customPrompts,
      gameOptions: normalizeMemoryOptions({ ...(typeof data === 'object' ? data : {}), gameType }),
      players: [{ id: socket.id, socket, side: null, ready: false, identity: this._getIdentity(socket.id) }],
      game: null,
      state: 'waiting',
    };

    this.rooms.set(code, room);
    this.playerRooms.set(socket.id, code);
    socket.join(code);

    socket.emit('room-created', { roomCode: code, gameType });
    console.log(`Room ${code} created by ${this._getDisplayName(socket.id)}`);
  }

  joinRoom(socket, roomCode) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      console.log(`Join failed: room ${roomCode} not found (active rooms: ${[...this.rooms.keys()].join(', ') || 'none'})`);
      socket.emit('room-error', { message: 'Room not found! Check the code sayang~' });
      return;
    }

    if (room.players.length >= 2) {
      console.log(`Join failed: room ${roomCode} is full`);
      socket.emit('room-error', { message: 'Room is full!' });
      return;
    }

    // Clear the waiting timer if someone joins a persisted room
    if (room._waitingTimer) {
      clearTimeout(room._waitingTimer);
      room._waitingTimer = null;
    }

    const joinerIdentity = this._getIdentity(socket.id);
    room.players.push({ id: socket.id, socket, side: null, ready: false, identity: joinerIdentity });
    this.playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    const hostIdentity = room.players.length > 1 ? room.players[0].identity : joinerIdentity;

    // If this joiner is alone (host left), put them in waiting state
    if (room.players.length === 1) {
      room.state = 'waiting';
      socket.emit('room-created', { roomCode, gameType: room.gameType });
      console.log(`${this._getDisplayName(socket.id)} joined empty room ${roomCode}, waiting for opponent`);
      return;
    }

    const skipSides = GameFactory.skipSideSelect(room.gameType);
    if (skipSides) {
      room.players[0].side = 'p1';
      room.players[0].ready = true;
      room.players[1].side = 'p2';
      room.players[1].ready = true;

      socket.emit('room-joined', {
        roomCode,
        gameType: room.gameType,
        skipSideSelect: true,
        opponentIdentity: hostIdentity,
      });
      room.players[0].socket.emit('player-joined', {
        gameType: room.gameType,
        skipSideSelect: true,
        opponentIdentity: joinerIdentity,
      });
      void this.startGame(room).catch((err) => console.error('startGame failed', err));
    } else {
      room.state = 'side-select';
      socket.emit('room-joined', {
        roomCode,
        gameType: room.gameType,
        skipSideSelect: false,
        opponentIdentity: hostIdentity,
      });
      room.players[0].socket.emit('player-joined', {
        gameType: room.gameType,
        opponentIdentity: joinerIdentity,
      });
    }
    console.log(`${this._getDisplayName(socket.id)} joined room ${roomCode}`);
  }

  selectSide(socket, side) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const validSides = room.gameType === 'doodle-guess'
      ? ['drawer', 'guesser']
      : room.gameType === 'memory-match'
        ? ['p1', 'p2']
        : room.gameType === 'word-scramble-race'
          ? ['sprout', 'blossom']
          : room.gameType === 'othello'
            ? ['black', 'white']
            : room.gameType === 'connect-four'
              ? ['yellow', 'pink']
              : room.gameType === 'bonk-brawl'
                ? ['bunny', 'kitty']
                : room.gameType === 'cute-aggression'
                  ? ['merah', 'biru']
                  : ['pig', 'chicken'];
    if (!validSides.includes(side)) {
      socket.emit('side-selected', { message: 'Pick a valid role!' });
      return;
    }

    const otherPlayer = room.players.find((p) => p.id !== socket.id);

    if (otherPlayer && otherPlayer.side === side) {
      socket.emit('side-selected', { message: `${side} is already taken! Pick the other one~` });
      return;
    }

    player.side = side;
    player.ready = true;

    socket.emit('side-selected', { message: `You picked ${side}!` });

    if (room.players.length === 2 && room.players.every((p) => p.ready)) {
      void this.startGame(room).catch((err) => console.error('startGame failed', err));
    } else if (otherPlayer) {
      otherPlayer.socket.emit('side-selected', {
        message: `Opponent picked ${side}! Your turn~`,
        opponentSide: side,
      });
    }
  }

  async startGame(room) {
    room.state = 'playing';

    const p1 = room.players[0];
    const p2 = room.players[1];

    const createOpts = {
      customPrompts: room.customPrompts || [],
      ...(room.gameOptions || {}),
    };

    if (room.gameType === 'sticker-hit') {
      try {
        createOpts.stickerHitHydration = await this._loadStickerHitHydration(room);
      } catch (err) {
        console.error('Sticker Hit profile hydration failed:', err);
        createOpts.stickerHitHydration = {};
      }
    }

    room.game = GameFactory.create(
      room.gameType,
      p1,
      p2,
      (event, data) => {
        this.handleGameEvent(room, event, data);
      },
      createOpts,
    );

    const gameConfig = GameFactory.getConfig(room.gameType, room.gameOptions || {});

    const baseStart = {
      gameType: room.gameType,
      gameConfig,
      memoryRoom: room.gameOptions || {},
    };

    const p1Name = this._getDisplayName(p1.id);
    const p2Name = this._getDisplayName(p2.id);

    p1.socket.emit('game-start', {
      ...baseStart,
      yourSide: p1.side,
      yourDirection: 1,
      opponentSide: p2.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: 'You',
      p2Label: p2Name,
      opponentIdentity: p2.identity,
    });

    p2.socket.emit('game-start', {
      ...baseStart,
      yourSide: p2.side,
      yourDirection: -1,
      opponentSide: p1.side,
      p1Side: p1.side,
      p2Side: p2.side,
      p1Label: p1Name,
      p2Label: 'You',
      opponentIdentity: p1.identity,
    });

    room.game.start();
    console.log(`Game started in room ${room.code} [${room.gameType}]: ${p1Name} (${p1.side}) vs ${p2Name} (${p2.side})`);
  }

  async _loadStickerHitHydration(room) {
    const out = {};
    for (const p of room.players) {
      const uid = p.identity?.userId;
      if (!uid || p.identity?.isGuest) continue;
      out[p.id] = await UserService.getStickerHitProgressForUser(uid);
    }
    return out;
  }

  spawnUnit(socket, tier, lane) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) return;
    if (typeof room.game.requestSpawn !== 'function') return;

    room.game.requestSpawn(socket.id, tier, lane);
  }

  submitWord(socket, path) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room || !room.game || typeof room.game.submitWord !== 'function') return;

    room.game.submitWord(socket.id, path).catch((err) => {
      console.error('submitWord error:', err);
      socket.emit('word-scramble-feedback', {
        targetId: socket.id,
        ok: false,
        message: 'Server error — try again.',
      });
    });
  }

  doodleStroke(socket, payload) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room?.game || room.gameType !== 'doodle-guess') return;
    if (typeof room.game.appendStroke !== 'function') return;
    room.game.appendStroke(socket.id, payload);
  }

  doodleClear(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room?.game || room.gameType !== 'doodle-guess') return;
    if (typeof room.game.clearCanvas !== 'function') return;
    room.game.clearCanvas(socket.id);
  }

  doodleGuess(socket, text) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room?.game || room.gameType !== 'doodle-guess') return;
    if (typeof room.game.submitGuess !== 'function') return;
    room.game.submitGuess(socket.id, text);
  }

  memoryFlip(socket, index) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room?.game || typeof room.game.tryFlip !== 'function') return;
    room.game.tryFlip(socket.id, index);
  }

  handleAction(socket, action) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room?.game || typeof room.game.handleAction !== 'function') return;
    room.game.handleAction(socket.id, action);
  }

  async handleGameEvent(room, event, data) {
    const connected = room.players.filter((p) => !p.disconnected);

    switch (event) {
      case 'state-update':
        connected.forEach((p) => {
          if (data.energies) {
            // Per-player format (Pig vs Chick)
            p.socket.emit('game-state', {
              units: data.units,
              playerHP: data.playerHP,
              energy: data.energies[p.id],
            });
          } else {
            // Broadcast format (Othello, etc.)
            p.socket.emit('game-state', { ...data, yourId: p.id });
          }
        });
        break;

      case 'word-scramble-state':
        connected.forEach((p) => {
          p.socket.emit('word-scramble-state', data);
        });
        break;

      case 'word-scramble-feedback':
        connected.forEach((p) => {
          if (p.id === data.targetId) {
            p.socket.emit('word-scramble-feedback', data);
          }
        });
        break;

      case 'doodle-state':
        connected.forEach((p) => {
          const st = data.byPlayer[p.id];
          if (st) p.socket.emit('doodle-state', st);
        });
        break;

      case 'doodle-draw':
        connected.forEach((p) => {
          if (p.id === data.targetId) p.socket.emit('doodle-draw', data.payload);
        });
        break;

      case 'doodle-clear':
        connected.forEach((p) => {
          if (p.id === data.targetId) p.socket.emit('doodle-clear', {});
        });
        break;

      case 'doodle-guess-wrong':
        connected.forEach((p) => {
          if (p.id === data.targetId) p.socket.emit('doodle-guess-wrong', { guess: data.guess });
        });
        break;

      case 'memory-state': {
        const p1p = room.players[0];
        connected.forEach((p) => {
          const slice = p.id === p1p.id ? data.p1 : data.p2;
          if (slice) p.socket.emit('memory-state', slice);
        });
        break;
      }

      case 'speed-match-state': {
        const p1p = room.players[0];
        connected.forEach((p) => {
          const isP1 = p.id === p1p.id;
          p.socket.emit('speed-match-state', {
            ...data,
            yourScore: isP1 ? data.scores[0] : data.scores[1],
            partnerScore: isP1 ? data.scores[1] : data.scores[0],
            yourAnswer: isP1 ? data.p1Answer : data.p2Answer,
            partnerAnswer: isP1 ? data.p2Answer : data.p1Answer,
            partnerAnswered: isP1 ? data.p2Answered : data.p1Answered,
          });
        });
        break;
      }

      case 'battleship-state': {
        connected.forEach((p) => {
          const slice = data.byPlayer[p.id];
          if (slice) p.socket.emit('battleship-state', slice);
        });
        break;
      }

      case 'vending-state': {
        connected.forEach((p) => {
          const slice = data.byPlayer[p.id];
          if (slice) p.socket.emit('vending-state', slice);
        });
        break;
      }

      case 'bonk-state': {
        connected.forEach((p) => {
          const slice = data.byPlayer[p.id];
          if (slice) p.socket.emit('bonk-state', slice);
        });
        break;
      }

      case 'cute-aggression-state': {
        connected.forEach((p) => {
          const slice = data.byPlayer[p.id];
          if (slice) p.socket.emit('cute-aggression-state', slice);
        });
        break;
      }

      case 'sticker-hit-state': {
        connected.forEach((p) => {
          const slice = data.byPlayer[p.id];
          if (slice) p.socket.emit('sticker-hit-state', slice);
        });
        break;
      }

      case 'action-error':
        connected.forEach((p) => {
          if (p.id === data.playerId) {
            p.socket.emit('action-error', data);
          }
        });
        break;

      case 'match-end': {
        room.state = 'finished';
        const p1 = room.players[0];

        let pointsByPlayer = {};
        try {
          const result = await this._recordMatchResult(room, data);
          pointsByPlayer = result.pointsByPlayer || {};
        } catch (err) {
          console.error('Failed to record match:', err);
        }

        connected.forEach((p) => {
          const isP1 = p.id === p1.id;
          const yourScore = isP1 ? data.scores[0] : data.scores[1];
          const oppScore = isP1 ? data.scores[1] : data.scores[0];
          p.socket.emit('match-end', {
            winner: data.winnerId,
            tie: Boolean(data.tie),
            p1Score: data.scores[0],
            p2Score: data.scores[1],
            yourScore,
            oppScore,
            isWinner: data.winnerId !== null && data.winnerId === p.id,
            pointsEarned: pointsByPlayer[p.id] || 0,
          });
        });
        break;
      }
    }
  }

  async _recordMatchResult(room, data) {
    const p1 = room.players[0];
    const p2 = room.players[1];

    const { newAchievements, pointsByPlayer } = await UserService.recordMatch({
      gameType: room.gameType,
      p1,
      p2,
      winnerId: data.winnerId,
      scores: data.scores,
      isTie: !!data.tie,
    });

    if (room.gameType === 'sticker-hit' && data.stickerHitPersist) {
      try {
        await UserService.persistStickerHitAfterMatch(room.players, data.stickerHitPersist);
      } catch (err) {
        console.error('Sticker Hit progress persist failed:', err);
      }
    }

    for (const [playerId, achievements] of Object.entries(newAchievements)) {
      const player = room.players.find((p) => p.id === playerId);
      if (player && !player.disconnected) {
        player.socket.emit('achievement-unlocked', { achievements });
      }
    }

    return { pointsByPlayer };
  }

  rematch(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    if (room.game) room.game.stop();
    room.players.forEach((p) => {
      p.side = null;
      p.ready = false;
    });

    if (GameFactory.skipSideSelect(room.gameType)) {
      room.players[0].side = 'p1';
      room.players[0].ready = true;
      room.players[1].side = 'p2';
      room.players[1].ready = true;
      void this.startGame(room).catch((err) => console.error('startGame failed', err));
      return;
    }

    room.state = 'side-select';
    this.io.to(roomCode).emit('room-joined', { roomCode, gameType: room.gameType, skipSideSelect: false });
  }

  rejoinRoom(socket, roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      console.log(`Rejoin failed: room ${roomCode} expired`);
      socket.emit('room-error', { message: 'Room expired! Start a new game sayang~' });
      return;
    }

    const dcPlayer = room.players.find((p) => p.disconnected);
    if (!dcPlayer) {
      console.log(`Rejoin failed: room ${roomCode} has no open slot`);
      socket.emit('room-error', { message: 'No open slot to rejoin!' });
      return;
    }

    if (room._disconnectTimer) {
      clearTimeout(room._disconnectTimer);
      room._disconnectTimer = null;
    }

    const oldId = dcPlayer.id;
    this.playerRooms.delete(oldId);

    const oldIdentity = this.playerIdentities.get(oldId);
    if (oldIdentity) {
      this.playerIdentities.set(socket.id, oldIdentity);
      this.playerIdentities.delete(oldId);
    }

    dcPlayer.id = socket.id;
    dcPlayer.socket = socket;
    dcPlayer.disconnected = false;
    this.playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    if (room.game) {
      if (room.game.p1 === dcPlayer) {
        room.game.p1 = dcPlayer;
        if (room.game.energies) {
          room.game.energies[socket.id] = room.game.energies[oldId];
          delete room.game.energies[oldId];
        }
        if (room.game.playerHP) {
          room.game.playerHP[socket.id] = room.game.playerHP[oldId];
          delete room.game.playerHP[oldId];
        }
        if (room.game.units) {
          room.game.units.forEach((u) => { if (u.ownerId === oldId) u.ownerId = socket.id; });
        }
        if (room.game.scores) {
          room.game.scores[socket.id] = room.game.scores[oldId];
          delete room.game.scores[oldId];
        }
        if (room.game.roundWords) {
          room.game.roundWords[socket.id] = room.game.roundWords[oldId];
          delete room.game.roundWords[oldId];
        }
        if (room.game.currentTurn === oldId) {
          room.game.currentTurn = socket.id;
        }
      } else if (room.game.p2 === dcPlayer) {
        room.game.p2 = dcPlayer;
        if (room.game.energies) {
          room.game.energies[socket.id] = room.game.energies[oldId];
          delete room.game.energies[oldId];
        }
        if (room.game.playerHP) {
          room.game.playerHP[socket.id] = room.game.playerHP[oldId];
          delete room.game.playerHP[oldId];
        }
        if (room.game.units) {
          room.game.units.forEach((u) => { if (u.ownerId === oldId) u.ownerId = socket.id; });
        }
        if (room.game.scores) {
          room.game.scores[socket.id] = room.game.scores[oldId];
          delete room.game.scores[oldId];
        }
        if (room.game.roundWords) {
          room.game.roundWords[socket.id] = room.game.roundWords[oldId];
          delete room.game.roundWords[oldId];
        }
        if (room.game.currentTurn === oldId) {
          room.game.currentTurn = socket.id;
        }
      }
    }

    if (room.game && room.gameType === 'sticker-hit' && typeof room.game.migrateReconnectSocket === 'function') {
      room.game.migrateReconnectSocket(oldId, socket.id);
    }

    const otherPlayer = room.players.find((p) => p.id !== socket.id);
    if (otherPlayer) {
      otherPlayer.socket.emit('opponent-reconnected');
    }

    if (room.state === 'playing' && room.game) {
      const isP1 = room.game.p1.id === socket.id;
      const p1 = room.players[0];
      const p2 = room.players[1];

      const rePayload = {
        gameType: room.gameType,
        yourSide: dcPlayer.side,
        yourDirection: isP1 ? 1 : -1,
        opponentSide: otherPlayer.side,
        p1Side: p1.side,
        p2Side: p2.side,
        p1Label: isP1 ? 'You' : this._getDisplayName(p1.id),
        p2Label: isP1 ? this._getDisplayName(p2.id) : 'You',
        gameConfig: GameFactory.getConfig(room.gameType, room.gameOptions || {}),
        memoryRoom: room.gameOptions || {},
        reconnect: true,
        opponentIdentity: otherPlayer.identity,
      };

      if (typeof room.game.getReconnectPayload === 'function') {
        Object.assign(rePayload, room.game.getReconnectPayload(socket.id));
      }

      socket.emit('game-start', rePayload);

      if (room.gameType === 'doodle-guess' && room.game.getStrokeHistoryFor && room.game.getPersonalStateFor) {
        const strokes = room.game.getStrokeHistoryFor(socket.id);
        socket.emit('doodle-sync', { strokes });
        socket.emit('doodle-state', room.game.getPersonalStateFor(socket.id));
      }

      room.game.resume();
    } else {
      socket.emit('room-joined', { roomCode, gameType: room.gameType });
    }

    console.log(`${this._getDisplayName(socket.id)} rejoined room ${roomCode}`);
  }

  handleDisconnect(socket) {
    const roomCode = this.playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    const otherPlayer = room.players.find((p) => p.id !== socket.id);

    // --- In-game disconnect: pause + 45s grace ---
    if (room.state === 'playing' && room.game && player) {
      player.disconnected = true;
      room.game.pause();

      if (otherPlayer) {
        otherPlayer.socket.emit('opponent-disconnected', { reconnecting: true });
      }

      room._disconnectTimer = setTimeout(() => {
        if (otherPlayer) {
          otherPlayer.socket.emit('opponent-disconnected', { reconnecting: false });
        }
        if (room.game) room.game.stop();
        this.rooms.delete(roomCode);
        room.players.forEach((p) => this.playerRooms.delete(p.id));
        console.log(`Room ${roomCode} destroyed (reconnect timeout)`);
      }, 45000);

      console.log(`Player disconnected from room ${roomCode}, waiting 45s for reconnect...`);
      return;
    }

    // --- Waiting/side-select: keep room alive for shared links ---
    if (room.state === 'waiting' || room.state === 'side-select') {
      // Remove the disconnected player from the room
      room.players = room.players.filter((p) => p.id !== socket.id);
      this.playerRooms.delete(socket.id);

      if (otherPlayer) {
        otherPlayer.socket.emit('opponent-disconnected', { reconnecting: true });
      }

      // If room is now empty, keep it alive for 10 minutes (shared link grace)
      if (room.players.length === 0) {
        if (room._waitingTimer) clearTimeout(room._waitingTimer);
        room._waitingTimer = setTimeout(() => {
          if (this.rooms.has(roomCode) && this.rooms.get(roomCode).players.length === 0) {
            this.rooms.delete(roomCode);
            console.log(`Room ${roomCode} destroyed (empty waiting timeout — 10 min)`);
          }
        }, 10 * 60 * 1000);
        console.log(`Room ${roomCode} host left, keeping alive 10 min for shared links`);
      } else {
        console.log(`Player left room ${roomCode}, 1 player remaining`);
      }
      return;
    }

    // --- Finished/other states: destroy ---
    if (otherPlayer) {
      otherPlayer.socket.emit('opponent-disconnected', { reconnecting: false });
    }
    if (room.game) room.game.stop();
    this.rooms.delete(roomCode);
    room.players.forEach((p) => this.playerRooms.delete(p.id));

    console.log(`Room ${roomCode} destroyed (player disconnected)`);
  }
}
