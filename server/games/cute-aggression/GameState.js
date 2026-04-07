/**
 * Virus vs Virus — Server-authoritative match container.
 *
 * Match flow:
 *   countdown → playing → mini-result → (repeat) → finished
 *
 * Four mini-games (randomly selected each round):
 *   mash    — Virus Inflater: tap to grow virus, first to cross centre wins
 *   reflex  — Quick Draw: tap after signal fires, false-start = opponent wins
 *   pong    — Deflector: server-side ball physics, drag paddle to block
 *   sorting — Gatekeeper: toggle gate to catch own-colour viruses, block enemy
 */

import { CUTE_AGGRESSION_CONFIG as CFG } from './config.js';

export const GAME_CONFIG = CFG;

const MINI_POOL = ['mash', 'reflex', 'pong', 'sorting'];

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    /** @type {'countdown'|'playing'|'mini-result'|'finished'} */
    this.phase = 'countdown';

    this.matchScore = {};
    /** @type {'mash'|'reflex'|'pong'|'sorting'|null} */
    this.currentMiniGame = null;
    this.miniGameState = {};
    this.lastMiniResult = null;
    this.roundNum = 0;

    this.phaseTimer = null;
    this.tickInterval = null;
    this.spawnInterval = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start() {
    this.active = true;
    this.paused = false;
    this.matchScore = { [this.p1.id]: 0, [this.p2.id]: 0 };
    this.lastMiniResult = null;
    this.roundNum = 0;
    this._startNextMiniGame();
  }

  stop() {
    this.active = false;
    this._clearTimers();
  }

  pause() {
    if (!this.active) return;
    this.paused = true;
    this._clearTimers();
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    if (this.phase === 'countdown') {
      this._startCountdown();
    } else if (this.phase === 'playing') {
      this._resumeMiniGame();
    }
    this._broadcastState();
  }

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;

    if (this.matchScore[oldId] !== undefined) {
      this.matchScore[newId] = this.matchScore[oldId];
      delete this.matchScore[oldId];
    }

    const ms = this.miniGameState;
    if (ms) {
      for (const key of ['scales', 'paddles', 'scores', 'gates']) {
        if (ms[key]?.[oldId] !== undefined) {
          ms[key][newId] = ms[key][oldId];
          delete ms[key][oldId];
        }
      }
    }
  }

  getReconnectPayload(socketId) {
    const player = socketId === this.p1.id ? this.p1 : this.p2;
    const opponent = socketId === this.p1.id ? this.p2 : this.p1;
    const pChar = CFG.CHARACTERS[player.side] || CFG.CHARACTERS.merah;
    const oChar = CFG.CHARACTERS[opponent.side] || CFG.CHARACTERS.biru;

    return {
      cuteAggressionState: {
        gameType: 'cute-aggression',
        phase: this.phase,
        roundNum: this.roundNum,
        currentMiniGame: this.currentMiniGame,
        matchScore: {
          me: this.matchScore[player.id] || 0,
          opp: this.matchScore[opponent.id] || 0,
        },
        winScore: CFG.WIN_SCORE,
        lastMiniResult: this.lastMiniResult
          ? { iWon: this.lastMiniResult.winnerId === player.id, miniGame: this.lastMiniResult.miniGame }
          : null,
        me: { character: pChar, side: player.side },
        opp: { character: oChar, side: opponent.side },
        mini: this._buildMiniSlice(player, opponent),
      },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _clearTimers() {
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
  }

  _opponentOf(playerId) {
    return playerId === this.p1.id ? this.p2.id : this.p1.id;
  }

  // ── Match flow ────────────────────────────────────────────────────────────

  _startNextMiniGame() {
    this.roundNum++;
    this.currentMiniGame = MINI_POOL[Math.floor(Math.random() * MINI_POOL.length)];
    this.miniGameState = {};
    this._startCountdown();
  }

  _startCountdown() {
    this._clearTimers();
    this.phase = 'countdown';
    this._broadcastState();

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this._launchMiniGame();
    }, CFG.COUNTDOWN_MS);
  }

  _launchMiniGame() {
    this.phase = 'playing';
    this.miniGameState = {};

    switch (this.currentMiniGame) {
      case 'mash': this._initMash(); break;
      case 'reflex': this._initReflex(); break;
      case 'pong': this._initPong(); break;
      case 'sorting': this._initSorting(); break;
    }

    this._broadcastState();
  }

  _resumeMiniGame() {
    if (this.miniGameState.winner) return;
    if (this.currentMiniGame === 'pong') {
      this.tickInterval = setInterval(() => this._tickPong(), CFG.PONG_TICK_MS);
    } else if (this.currentMiniGame === 'sorting') {
      this.spawnInterval = setInterval(() => this._spawnVirus(), CFG.SORTING_SPAWN_INTERVAL_MS);
      this.tickInterval = setInterval(() => this._tickSorting(), CFG.SORTING_TICK_MS);
    }
  }

  _endMiniGame(winnerId) {
    this._clearTimers();
    this.phase = 'mini-result';

    if (winnerId) {
      this.matchScore[winnerId] = (this.matchScore[winnerId] || 0) + 1;
    }

    this.lastMiniResult = { winnerId, miniGame: this.currentMiniGame };
    this._broadcastState();

    const matchWon = winnerId && this.matchScore[winnerId] >= CFG.WIN_SCORE;

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (matchWon) {
        this._finishMatch(winnerId);
      } else {
        this._startNextMiniGame();
      }
    }, CFG.MINI_RESULT_MS);
  }

  _finishMatch(winnerId) {
    this.active = false;
    this.phase = 'finished';
    this._clearTimers();

    this.emit('match-end', {
      winnerId,
      tie: false,
      scores: [this.matchScore[this.p1.id] || 0, this.matchScore[this.p2.id] || 0],
    });
  }

  // ── handleAction (router) ─────────────────────────────────────────────────

  handleAction(playerId, action) {
    if (!this.active || this.paused || this.phase !== 'playing') return;
    if (!action || typeof action !== 'object') return;

    switch (this.currentMiniGame) {
      case 'mash':
        if (action.type === 'mash') this._handleMash(playerId);
        break;
      case 'reflex':
        if (action.type === 'tap') this._handleReflex(playerId);
        break;
      case 'pong':
        if (action.type === 'paddle') this._handlePaddle(playerId, action);
        break;
      case 'sorting':
        if (action.type === 'gate') this._handleGate(playerId);
        break;
    }
  }

  // ── Mini-game: Mash ───────────────────────────────────────────────────────

  _initMash() {
    this.miniGameState = {
      scales: { [this.p1.id]: 0.10, [this.p2.id]: 0.10 },
      startedAt: Date.now(),
      winner: null,
    };

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.phase !== 'playing' || this.miniGameState.winner) return;
      const s1 = this.miniGameState.scales[this.p1.id] || 0;
      const s2 = this.miniGameState.scales[this.p2.id] || 0;
      this._endMiniGame(s1 >= s2 ? this.p1.id : this.p2.id);
    }, CFG.MASH_TIME_LIMIT_MS);
  }

  _handleMash(playerId) {
    const ms = this.miniGameState;
    if (!ms.scales || ms.winner) return;

    ms.scales[playerId] = Math.min(1.1, (ms.scales[playerId] || 0.1) + CFG.MASH_SCALE_PER_TAP);

    if (ms.scales[playerId] >= CFG.MASH_WIN_SCALE) {
      ms.winner = playerId;
      this._clearTimers();
      this._endMiniGame(playerId);
    } else {
      this._broadcastState();
    }
  }

  // ── Mini-game: Reflex ─────────────────────────────────────────────────────

  _initReflex() {
    const waitMs = CFG.REFLEX_MIN_WAIT_MS
      + Math.random() * (CFG.REFLEX_MAX_WAIT_MS - CFG.REFLEX_MIN_WAIT_MS);

    this.miniGameState = {
      reflexPhase: 'waiting',
      triggered: false,
      triggeredAt: null,
      falseTapper: null,
      winner: null,
    };

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.phase !== 'playing' || this.miniGameState.winner) return;

      this.miniGameState.triggered = true;
      this.miniGameState.triggeredAt = Date.now();
      this.miniGameState.reflexPhase = 'signal';
      this._broadcastState();

      // Response window — if nobody taps, random winner
      this.phaseTimer = setTimeout(() => {
        this.phaseTimer = null;
        if (this.phase !== 'playing' || this.miniGameState.winner) return;
        const winner = Math.random() < 0.5 ? this.p1.id : this.p2.id;
        this.miniGameState.winner = winner;
        this._endMiniGame(winner);
      }, CFG.REFLEX_RESPONSE_WINDOW_MS);
    }, waitMs);
  }

  _handleReflex(playerId) {
    const ms = this.miniGameState;
    if (!ms || ms.winner) return;

    const opponentId = this._opponentOf(playerId);

    if (!ms.triggered) {
      // False start — opponent wins
      ms.falseTapper = playerId;
      ms.winner = opponentId;
      ms.reflexPhase = 'false-start';
      this._clearTimers();
      this._endMiniGame(opponentId);
    } else {
      // First valid tap wins
      ms.winner = playerId;
      ms.reflexPhase = 'done';
      this._clearTimers();
      this._endMiniGame(playerId);
    }
  }

  // ── Mini-game: Pong ───────────────────────────────────────────────────────

  _initPong() {
    // Random initial angle 30–75 degrees to avoid too-horizontal or too-vertical ball
    const angle = (Math.PI / 6) + Math.random() * (5 * Math.PI / 12);
    const dirX = Math.random() < 0.5 ? 1 : -1;
    const dirY = Math.random() < 0.5 ? 1 : -1;
    const spd = CFG.PONG_BALL_SPEED;

    this.miniGameState = {
      ball: {
        x: 0.5,
        y: 0.5,
        vx: Math.cos(angle) * spd * dirX,
        vy: Math.sin(angle) * spd * dirY,
        speed: spd,
      },
      paddles: { [this.p1.id]: 0.5, [this.p2.id]: 0.5 },
      winner: null,
    };

    this.tickInterval = setInterval(() => this._tickPong(), CFG.PONG_TICK_MS);
  }

  _tickPong() {
    if (!this.active || this.paused || this.phase !== 'playing') return;
    const ms = this.miniGameState;
    if (!ms?.ball || ms.winner) return;

    const ball = ms.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Side-wall bounces
    if (ball.x <= 0.02) { ball.x = 0.02; ball.vx = Math.abs(ball.vx); }
    if (ball.x >= 0.98) { ball.x = 0.98; ball.vx = -Math.abs(ball.vx); }

    const half = CFG.PONG_PADDLE_WIDTH / 2;
    const P1_Y = 0.88; // p1's paddle row (bottom of court)
    const P2_Y = 0.12; // p2's paddle row (top of court)

    // p1 paddle — ball moving downward
    if (ball.vy > 0 && ball.y >= P1_Y - 0.06 && ball.y <= P1_Y + 0.04) {
      const px = ms.paddles[this.p1.id];
      if (ball.x >= px - half && ball.x <= px + half) {
        this._bounceBall(ball, px, half, -1); // -1 = send upward
        ball.y = P1_Y - 0.07;
      }
    }

    // p2 paddle — ball moving upward
    if (ball.vy < 0 && ball.y <= P2_Y + 0.06 && ball.y >= P2_Y - 0.04) {
      const px = ms.paddles[this.p2.id];
      if (ball.x >= px - half && ball.x <= px + half) {
        this._bounceBall(ball, px, half, 1); // 1 = send downward
        ball.y = P2_Y + 0.07;
      }
    }

    // Out of bounds — goal scored
    if (ball.y > 1.05 && !ms.winner) {
      ms.winner = this.p2.id;
      this._endMiniGame(this.p2.id);
      return;
    }
    if (ball.y < -0.05 && !ms.winner) {
      ms.winner = this.p1.id;
      this._endMiniGame(this.p1.id);
      return;
    }

    this._broadcastState();
  }

  _bounceBall(ball, paddleX, halfWidth, vyDir) {
    ball.speed = Math.min(ball.speed * 1.05, CFG.PONG_MAX_SPEED);
    const off = (ball.x - paddleX) / halfWidth; // −1..1
    const angle = (Math.PI / 4) + Math.abs(off) * (Math.PI / 8); // 45–68°
    ball.vx = Math.cos(angle) * ball.speed * Math.sign(off || 0.01);
    ball.vy = Math.sin(angle) * ball.speed * vyDir;
  }

  _handlePaddle(playerId, action) {
    if (!this.miniGameState.paddles) return;
    if (typeof action.x !== 'number') return;
    this.miniGameState.paddles[playerId] = Math.max(0, Math.min(1, action.x));
  }

  // ── Mini-game: Sorting ────────────────────────────────────────────────────

  _initSorting() {
    this.miniGameState = {
      scores: { [this.p1.id]: 0, [this.p2.id]: 0 },
      gates: { [this.p1.id]: false, [this.p2.id]: false },
      viruses: [],
      nextId: 0,
      startedAt: Date.now(),
      winner: null,
    };

    this.spawnInterval = setInterval(() => this._spawnVirus(), CFG.SORTING_SPAWN_INTERVAL_MS);
    this.tickInterval = setInterval(() => this._tickSorting(), CFG.SORTING_TICK_MS);

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.phase !== 'playing' || this.miniGameState.winner) return;
      const s1 = this.miniGameState.scores[this.p1.id] || 0;
      const s2 = this.miniGameState.scores[this.p2.id] || 0;
      this._endMiniGame(s1 >= s2 ? this.p1.id : this.p2.id);
    }, CFG.SORTING_TIME_LIMIT_MS);
  }

  _spawnVirus() {
    if (!this.active || this.phase !== 'playing') return;
    const ms = this.miniGameState;
    if (!ms.viruses) return;

    const color = Math.random() < 0.5 ? 'merah' : 'biru';
    ms.viruses.push({
      id: ms.nextId++,
      color,
      spawnedAt: Date.now(),
      arrivesAt: Date.now() + CFG.SORTING_TRAVEL_MS,
    });
    this._broadcastState();
  }

  _tickSorting() {
    if (!this.active || this.paused || this.phase !== 'playing') return;
    const ms = this.miniGameState;
    if (!ms.viruses || ms.winner) return;

    const now = Date.now();
    const arrived = ms.viruses.filter((v) => v.arrivesAt <= now);
    if (arrived.length === 0) return;

    ms.viruses = ms.viruses.filter((v) => v.arrivesAt > now);

    for (const virus of arrived) {
      for (const player of [this.p1, this.p2]) {
        if (ms.gates[player.id]) {
          if (virus.color === player.side) {
            ms.scores[player.id]++;
            if (ms.scores[player.id] >= CFG.SORTING_WIN_CATCHES && !ms.winner) {
              ms.winner = player.id;
            }
          } else {
            ms.scores[player.id] = Math.max(0, ms.scores[player.id] - 1);
          }
        }
      }
    }

    if (ms.winner) {
      this._clearTimers();
      this._endMiniGame(ms.winner);
      return;
    }

    this._broadcastState();
  }

  _handleGate(playerId) {
    const ms = this.miniGameState;
    if (!ms.gates) return;
    ms.gates[playerId] = !ms.gates[playerId];
    this._broadcastState();
  }

  // ── State broadcasting ────────────────────────────────────────────────────

  _broadcastState() {
    const buildSlice = (player, opponent) => ({
      gameType: 'cute-aggression',
      phase: this.phase,
      roundNum: this.roundNum,
      currentMiniGame: this.currentMiniGame,
      matchScore: {
        me: this.matchScore[player.id] || 0,
        opp: this.matchScore[opponent.id] || 0,
      },
      winScore: CFG.WIN_SCORE,
      lastMiniResult: this.lastMiniResult
        ? {
          iWon: this.lastMiniResult.winnerId === player.id,
          miniGame: this.lastMiniResult.miniGame,
        }
        : null,
      me: {
        character: CFG.CHARACTERS[player.side] || CFG.CHARACTERS.merah,
        side: player.side,
      },
      opp: {
        character: CFG.CHARACTERS[opponent.side] || CFG.CHARACTERS.biru,
        side: opponent.side,
      },
      mini: this._buildMiniSlice(player, opponent),
    });

    this.emit('cute-aggression-state', {
      byPlayer: {
        [this.p1.id]: buildSlice(this.p1, this.p2),
        [this.p2.id]: buildSlice(this.p2, this.p1),
      },
    });
  }

  _buildMiniSlice(player, opponent) {
    const ms = this.miniGameState;
    if (!ms) return {};
    const now = Date.now();

    switch (this.currentMiniGame) {
      case 'mash':
        return {
          myScale: ms.scales?.[player.id] ?? 0.1,
          oppScale: ms.scales?.[opponent.id] ?? 0.1,
          timeLeft: ms.startedAt
            ? Math.max(0, CFG.MASH_TIME_LIMIT_MS - (now - ms.startedAt))
            : 0,
          winScale: CFG.MASH_WIN_SCALE,
        };

      case 'reflex':
        return {
          reflexPhase: ms.reflexPhase || 'waiting',
          triggered: ms.triggered || false,
          falseTapper: ms.falseTapper === player.id
            ? 'me'
            : ms.falseTapper === opponent.id ? 'opp' : null,
        };

      case 'pong': {
        if (!ms.ball) return {};
        const myPad = ms.paddles?.[player.id] ?? 0.5;
        const opPad = ms.paddles?.[opponent.id] ?? 0.5;
        // p1 = "bottom" in absolute coords; p2 gets flipped so they also see themselves at bottom
        if (player.id === this.p1.id) {
          return { ball: { x: ms.ball.x, y: ms.ball.y }, myPaddleX: myPad, oppPaddleX: opPad };
        }
        return {
          ball: { x: 1 - ms.ball.x, y: 1 - ms.ball.y },
          myPaddleX: 1 - myPad,
          oppPaddleX: 1 - opPad,
        };
      }

      case 'sorting':
        return {
          myScore: ms.scores?.[player.id] ?? 0,
          oppScore: ms.scores?.[opponent.id] ?? 0,
          gateOpen: ms.gates?.[player.id] ?? false,
          viruses: (ms.viruses || []).map((v) => ({
            id: v.id,
            color: v.color,
            progress: Math.min(1, (now - v.spawnedAt) / CFG.SORTING_TRAVEL_MS),
          })),
          winCatches: CFG.SORTING_WIN_CATCHES,
          timeLeft: ms.startedAt
            ? Math.max(0, CFG.SORTING_TIME_LIMIT_MS - (now - ms.startedAt))
            : 0,
        };

      default:
        return {};
    }
  }
}
