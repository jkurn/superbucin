import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { readdir, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { supabase as supabaseAdmin } from './supabaseAdmin.js';
import { RoomManager } from './rooms/RoomManager.js';
import { GameFactory } from './games/GameFactory.js';
import { env, assertRequiredEnvForProduction } from './config/env.js';
import { logger, withRequestContext } from './observability/logger.js';
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
import { GameState as BonkBrawlState, GAME_CONFIG as BONK_BRAWL_CONFIG } from './games/bonk-brawl/GameState.js';
import { GameState as CuteAggressionState, GAME_CONFIG as CUTE_AGGRESSION_CONFIG } from './games/cute-aggression/GameState.js';
import { GameState as StickerHitState, GAME_CONFIG as STICKER_HIT_CONFIG } from './games/sticker-hit/GameState.js';
import { GameState as StickerMashDuelState, GAME_CONFIG as STICKER_MASH_DUEL_CONFIG } from './games/sticker-mash-duel/GameState.js';

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
GameFactory.register('bonk-brawl', BonkBrawlState, BONK_BRAWL_CONFIG);
GameFactory.register('cute-aggression', CuteAggressionState, CUTE_AGGRESSION_CONFIG);
GameFactory.register('sticker-hit', StickerHitState, STICKER_HIT_CONFIG);
GameFactory.register('sticker-mash-duel', StickerMashDuelState, STICKER_MASH_DUEL_CONFIG);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const clientDist = path.join(__dirname, '..', 'client', 'dist');
const pricyStickerDir = path.join(__dirname, '..', 'pricy-sticker');
const curatedStickerDir = path.join(__dirname, '..', 'client', 'public', 'stickers');
const kenneyShootingGalleryPngDir = path.join(__dirname, '..', 'kenney_shooting-gallery', 'PNG');
const kenneyUiPackPngDir = path.join(__dirname, '..', 'kenney_ui-pack', 'PNG');
const kenneyBoardgamePackPngDir = path.join(__dirname, '..', 'kenney_boardgame-pack', 'PNG');
app.use(express.static(clientDist));
app.use('/pricy-sticker', express.static(pricyStickerDir));
app.use('/stickers', express.static(curatedStickerDir));
app.use('/kenney/shooting-gallery', express.static(kenneyShootingGalleryPngDir));
app.use('/kenney/ui-pack', express.static(kenneyUiPackPngDir));
app.use('/kenney/boardgame', express.static(kenneyBoardgamePackPngDir));

let stickerManifestCache = null;

function parseAnimatedWebpDurationMs(buffer) {
  if (!buffer || buffer.length < 16) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

  let hasAnimation = false;
  let totalMs = 0;
  let hasFrame = false;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) break;

    if (chunkType === 'VP8X' && chunkSize >= 1) {
      const flags = buffer[dataOffset];
      hasAnimation = (flags & 0x02) !== 0;
    } else if (chunkType === 'ANMF' && chunkSize >= 16) {
      hasFrame = true;
      const duration = buffer[dataOffset + 12]
        | (buffer[dataOffset + 13] << 8)
        | (buffer[dataOffset + 14] << 16);
      totalMs += Math.max(10, duration);
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  if (!hasAnimation || !hasFrame) return null;
  return Math.max(200, totalMs);
}

function isLikelyGitLfsPointer(buffer) {
  if (!buffer || buffer.length < 48) return false;
  const firstLine = buffer.subarray(0, Math.min(buffer.length, 80)).toString('utf8');
  return firstLine.startsWith('version https://git-lfs.github.com/spec/v1');
}

async function getStickerDurationMs(absPath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.webp') return { durationMs: 1200, valid: true };
  try {
    const buf = await readFile(absPath);
    if (isLikelyGitLfsPointer(buf)) {
      return { durationMs: 1200, valid: false };
    }
    const parsed = parseAnimatedWebpDurationMs(buf);
    return { durationMs: parsed || 1200, valid: true };
  } catch {
    return { durationMs: 1200, valid: false };
  }
}

async function collectStickersFromDir(rootDir, publicPrefix) {
  /** @type {{ src: string, durationMs: number }[]} */
  const out = [];
  /** @type {string[]} */
  const stack = [''];

  while (stack.length) {
    const relDir = stack.pop();
    const absDir = path.join(rootDir, relDir);
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch (_err) {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = relDir ? path.posix.join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        stack.push(relPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(webp|png|jpg|jpeg|gif)$/i.test(entry.name)) continue;
      const encoded = relPath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
      const absPath = path.join(absDir, entry.name);
      const info = await getStickerDurationMs(absPath, entry.name);
      if (!info.valid) continue;
      out.push({ src: `${publicPrefix}/${encoded}`, durationMs: info.durationMs });
    }
  }

  out.sort((a, b) => a.src.localeCompare(b.src));
  return out;
}

async function buildStickerManifest() {
  const fromPricy = await collectStickersFromDir(pricyStickerDir, '/pricy-sticker');
  const fromCurated = await collectStickersFromDir(curatedStickerDir, '/stickers');
  const unique = new Map();
  [...fromPricy, ...fromCurated].forEach((entry) => {
    if (!unique.has(entry.src)) unique.set(entry.src, entry);
  });
  return [...unique.values()];
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logger.info({
      type: 'http_request',
      ...withRequestContext(req),
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
    });
  });
  next();
});

app.get('/health', (_req, res) => res.send('ok'));

app.get('/api/sticker-hit/sticker-manifest', async (_req, res) => {
  try {
    if (!stickerManifestCache) {
      stickerManifestCache = await buildStickerManifest();
    }
    res.json({ stickers: stickerManifestCache });
  } catch (err) {
    logger.error({ err }, 'Failed to build sticker manifest');
    res.status(500).json({ stickers: [] });
  }
});

app.get('/api/leaderboard/:gameType', async (req, res) => {
  if (!supabaseAdmin) {
    return res.json({ leaderboard: [] });
  }
  const { gameType } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('user_stats')
      .select('user_id, total_points, wins, games_played')
      .eq('game_type', gameType)
      .order('total_points', { ascending: false })
      .limit(6);

    if (error || !data || data.length === 0) {
      return res.json({ leaderboard: [] });
    }

    const userIds = data.map((r) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const leaderboard = data.map((row) => {
      const profile = profileMap.get(row.user_id) || {};
      return {
        username: profile.username || null,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
        total_points: row.total_points,
        wins: row.wins,
        games_played: row.games_played,
      };
    });

    res.json({ leaderboard });
  } catch (err) {
    logger.error({ err, gameType }, 'Leaderboard fetch failed');
    res.status(500).json({ leaderboard: [] });
  }
});

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
  logger.info({ type: 'socket_connected', socket_id: socket.id }, 'Player connected');

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
    logger.info({ type: 'socket_disconnected', socket_id: socket.id }, 'Player disconnected');
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
    logger.error({ err, username, request_id: req.requestId }, 'Error fetching profile');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

assertRequiredEnvForProduction();

const PORT = env.PORT;
httpServer.listen(PORT, () => {
  logger.info({ type: 'server_started', port: PORT }, `SUPERBUCIN server running on port ${PORT}`);
});
