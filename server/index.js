import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { supabase as supabaseAdmin } from './supabaseAdmin.js';
import { RoomManager } from './rooms/RoomManager.js';
import { GameFactory } from './games/GameFactory.js';
import { GameState, GAME_CONFIG } from './games/pig-vs-chick/GameState.js';
import { GameState as WordScrambleState, GAME_CONFIG as WORD_SCRAMBLE_CONFIG } from './games/word-scramble-race/GameState.js';
import { DoodleGuessGameState, DOODLE_GAME_CONFIG } from './games/doodle-guess/GameState.js';
import { MemoryMatchGameState } from './games/memory-match/GameState.js';
import { MEMORY_MATCH_CONFIG } from './games/memory-match/config.js';
import { GameState as OthelloState, GAME_CONFIG as OTHELLO_CONFIG } from './games/othello/GameState.js';
import { GameState as SpeedMatchState, GAME_CONFIG as SPEED_MATCH_CONFIG } from './games/speed-match/GameState.js';
import { GameState as ConnectFourState, GAME_CONFIG as CONNECT_FOUR_CONFIG } from './games/connect-four/GameState.js';
import { GameState as QuizRaceState, GAME_CONFIG as QUIZ_RACE_CONFIG } from './games/quiz-race/GameState.js';
import { GameState as BattleshipState, GAME_CONFIG as BATTLESHIP_CONFIG } from './games/battleship-mini/GameState.js';
import { GameState as VendingState, GAME_CONFIG as VENDING_CONFIG } from './games/vending-machine/GameState.js';

GameFactory.register('pig-vs-chick', GameState, GAME_CONFIG);
GameFactory.register('word-scramble-race', WordScrambleState, WORD_SCRAMBLE_CONFIG);
GameFactory.register('doodle-guess', DoodleGuessGameState, DOODLE_GAME_CONFIG);
GameFactory.register('memory-match', MemoryMatchGameState, MEMORY_MATCH_CONFIG);
GameFactory.register('othello', OthelloState, OTHELLO_CONFIG);
GameFactory.register('speed-match', SpeedMatchState, SPEED_MATCH_CONFIG);
GameFactory.register('connect-four', ConnectFourState, CONNECT_FOUR_CONFIG);
GameFactory.register('quiz-race', QuizRaceState, QUIZ_RACE_CONFIG);
GameFactory.register('battleship-mini', BattleshipState, BATTLESHIP_CONFIG);
GameFactory.register('vending-machine', VendingState, VENDING_CONFIG);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/health', (_req, res) => res.send('ok'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://superbucin.pricylia.com',
      'https://superbucin.onrender.com',
    ],
    methods: ['GET', 'POST'],
  },
  pingInterval: 30000,
  pingTimeout: 60000,
  upgradeTimeout: 30000,
  transports: ['websocket', 'polling'],
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

// ==================== REST API ====================

app.get('/api/profile/:username', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { username } = req.params;

  try {
    // Look up the profile by username
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, points')
      .eq('username', username)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Fetch stats for this user
    const { data: stats } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', profile.id);

    // Fetch earned achievements with details
    const { data: userAchievements } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', profile.id);

    let achievements = [];
    if (userAchievements && userAchievements.length > 0) {
      const ids = userAchievements.map((ua) => ua.achievement_id);
      const { data: achDetails } = await supabaseAdmin
        .from('achievements')
        .select('*')
        .in('id', ids);
      achievements = achDetails || [];
    }

    res.json({
      profile,
      stats: stats || [],
      achievements,
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`SUPERBUCIN server running on port ${PORT}`);
});
