import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { RoomManager } from './rooms/RoomManager.js';
import { GameFactory } from './games/GameFactory.js';
import { GameState, GAME_CONFIG } from './games/pig-vs-chick/GameState.js';
import { GameState as WordScrambleState, GAME_CONFIG as WORD_SCRAMBLE_CONFIG } from './games/word-scramble-race/GameState.js';
import { DoodleGuessGameState, DOODLE_GAME_CONFIG } from './games/doodle-guess/GameState.js';
import { MemoryMatchGameState } from './games/memory-match/GameState.js';
import { MEMORY_MATCH_CONFIG } from './games/memory-match/config.js';
import { GameState as OthelloState, GAME_CONFIG as OTHELLO_CONFIG } from './games/othello/GameState.js';

GameFactory.register('pig-vs-chick', GameState, GAME_CONFIG);
GameFactory.register('word-scramble-race', WordScrambleState, WORD_SCRAMBLE_CONFIG);
GameFactory.register('doodle-guess', DoodleGuessGameState, DOODLE_GAME_CONFIG);
GameFactory.register('memory-match', MemoryMatchGameState, MEMORY_MATCH_CONFIG);
GameFactory.register('othello', OthelloState, OTHELLO_CONFIG);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
    ],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('identify', (data) => {
    roomManager.setIdentity(socket, data);
  });

  socket.on('create-room', (data) => {
    roomManager.createRoom(socket, data);
  });

  socket.on('join-room', (data) => {
    roomManager.joinRoom(socket, data.roomCode);
  });

  socket.on('rejoin-room', (data) => {
    roomManager.rejoinRoom(socket, data.roomCode);
  });

  socket.on('select-side', (data) => {
    roomManager.selectSide(socket, data.side);
  });

  socket.on('spawn-unit', (data) => {
    roomManager.spawnUnit(socket, data.tier, data.lane);
  });

  socket.on('submit-word', (data) => {
    roomManager.submitWord(socket, data?.path || []);
  });

  socket.on('doodle-stroke', (data) => {
    roomManager.doodleStroke(socket, data);
  });

  socket.on('doodle-clear', () => {
    roomManager.doodleClear(socket);
  });

  socket.on('doodle-guess', (data) => {
    roomManager.doodleGuess(socket, data?.text);
  });

  socket.on('memory-flip', (data) => {
    roomManager.memoryFlip(socket, data?.index);
  });

  socket.on('game-action', (data) => {
    roomManager.handleAction(socket, data);
  });

  socket.on('rematch', () => {
    roomManager.rematch(socket);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`SUPERBUCIN server running on port ${PORT}`);
});
