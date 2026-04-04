import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://superbucin.pages.dev',
      /\.superbucin\.pages\.dev$/,
    ],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create-room', () => {
    roomManager.createRoom(socket);
  });

  socket.on('join-room', (data) => {
    roomManager.joinRoom(socket, data.roomCode);
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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`SUPERBUCIN server running on port ${PORT}`);
});
