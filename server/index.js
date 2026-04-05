import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { RoomManager } from './rooms/RoomManager.js';
import { GameFactory } from './games/GameFactory.js';
import { GameState, GAME_CONFIG } from './games/pig-vs-chick/GameState.js';

// Register all games
GameFactory.register('pig-vs-chick', GameState, GAME_CONFIG);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve built client files in production
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

  socket.on('create-room', (data) => {
    roomManager.createRoom(socket, data?.gameType);
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

  socket.on('rematch', () => {
    roomManager.rematch(socket);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`SUPERBUCIN server running on port ${PORT}`);
});
