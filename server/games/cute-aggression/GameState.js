/**
 * Virus vs Virus — Server-authoritative match container.
 *
 * Match flow:
 *   roulette → ready (hold handshake) → playing → mini-result → (repeat) → finished
 *
 * Three mini-games (randomly selected each round):
 *   mash   — Virus Inflater: tug-of-war tapping, single offset variable
 *   color  — Speed Color Match: tap opponent dots to flip, blunder penalty
 *   memory — Virus Counting: count displayed viruses, answer question first
 */

import { CUTE_AGGRESSION_CONFIG as CFG } from './config.js';

export const GAME_CONFIG = CFG;

const MINI_POOL = ['mash', 'color', 'memory'];

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    /** @type {'roulette'|'ready'|'playing'|'mini-result'|'finished'} */
    this.phase = 'roulette';

    this.matchScore = {};
    /** @type {'mash'|'color'|'memory'|null} */
    this.currentMiniGame = null;
    this.miniGameState = {};
    this.lastMiniResult = null;
    this.roundNum = 0;

    this.readyState = { holding: {}, countdownStart: null };

    this.phaseTimer = null;
    this.tickInterval = null;
    this.displayTimer = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    this.active = true;
    this.paused = false;
    this.matchScore = { [this.p1.id]: 0, [this.p2.id]: 0 };
    this.lastMiniResult = null;
    this.roundNum = 0;
    this._startRoulette();
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
    if (this.phase === 'ready') this._startReadyTick();
    this._broadcastState();
  }

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;

    if (this.matchScore[oldId] !== undefined) {
      this.matchScore[newId] = this.matchScore[oldId];
      delete this.matchScore[oldId];
    }

    const rs = this.readyState;
    if (rs.holding[oldId] !== undefined) {
      rs.holding[newId] = false; // New connection = not holding
      delete rs.holding[oldId];
      rs.countdownStart = null;
    }

    const ms = this.miniGameState;
    if (ms) {
      for (const key of ['locked', 'answers']) {
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
        miniPool: MINI_POOL,
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
        ready: this._buildReadySlice(player),
        mini: this._buildMiniSlice(player, opponent),
      },
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _clearTimers() {
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.displayTimer) { clearTimeout(this.displayTimer); this.displayTimer = null; }
  }

  _opponentOf(playerId) {
    return playerId === this.p1.id ? this.p2.id : this.p1.id;
  }

  // ── Match flow ─────────────────────────────────────────────────────────────

  _startRoulette() {
    this._clearTimers();
    this.roundNum++;
    this.currentMiniGame = MINI_POOL[Math.floor(Math.random() * MINI_POOL.length)];
    this.miniGameState = {};
    this.phase = 'roulette';
    this._broadcastState();

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this._startReady();
    }, CFG.ROULETTE_MS);
  }

  _startReady() {
    this._clearTimers();
    this.phase = 'ready';
    this.readyState = {
      holding: { [this.p1.id]: false, [this.p2.id]: false },
      countdownStart: null,
    };
    this._broadcastState();
    this._startReadyTick();
  }

  _startReadyTick() {
    this.tickInterval = setInterval(() => {
      if (!this.active || this.paused || this.phase !== 'ready') return;

      const both = this.readyState.holding[this.p1.id] && this.readyState.holding[this.p2.id];
      if (both && this.readyState.countdownStart) {
        if (Date.now() - this.readyState.countdownStart >= CFG.COUNTDOWN_MS) {
          this._clearTimers();
          this._launchMiniGame();
          return;
        }
      }

      this._broadcastState();
    }, CFG.READY_TICK_MS);
  }

  _launchMiniGame() {
    this.phase = 'playing';
    this.miniGameState = {};

    switch (this.currentMiniGame) {
      case 'mash': this._initMash(); break;
      case 'color': this._initColor(); break;
      case 'memory': this._initMemory(); break;
    }

    this._broadcastState();
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
        this._startRoulette();
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

  // ── handleAction ───────────────────────────────────────────────────────────

  handleAction(playerId, action) {
    if (!this.active || this.paused) return;
    if (!action || typeof action !== 'object') return;

    // Ready phase: hold/release
    if (this.phase === 'ready' && action.type === 'hold') {
      this._handleReady(playerId, action.pressed);
      return;
    }

    if (this.phase !== 'playing') return;

    switch (this.currentMiniGame) {
      case 'mash':
        if (action.type === 'mash') this._handleMash(playerId);
        break;
      case 'color':
        if (action.type === 'dot' && typeof action.index === 'number') {
          this._handleColor(playerId, action.index);
        }
        break;
      case 'memory':
        if (action.type === 'answer' && typeof action.value === 'number') {
          this._handleMemoryAnswer(playerId, action.value);
        }
        break;
    }
  }

  // ── Ready handshake ────────────────────────────────────────────────────────

  _handleReady(playerId, pressed) {
    this.readyState.holding[playerId] = !!pressed;

    const both = this.readyState.holding[this.p1.id] && this.readyState.holding[this.p2.id];

    if (both && !this.readyState.countdownStart) {
      this.readyState.countdownStart = Date.now();
    } else if (!both) {
      this.readyState.countdownStart = null;
    }

    this._broadcastState();
  }

  // ── Mash (Tug-of-War) ─────────────────────────────────────────────────────

  _initMash() {
    this.miniGameState = {
      offset: 0, // positive = p1 winning, negative = p2 winning
      startedAt: Date.now(),
      winner: null,
    };

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.phase !== 'playing' || this.miniGameState.winner) return;
      const off = this.miniGameState.offset;
      this._endMiniGame(off >= 0 ? this.p1.id : this.p2.id);
    }, CFG.MASH_TIME_LIMIT_MS);
  }

  _handleMash(playerId) {
    const ms = this.miniGameState;
    if (ms.winner) return;

    ms.offset += (playerId === this.p1.id ? CFG.MASH_TAP_VALUE : -CFG.MASH_TAP_VALUE);

    if (ms.offset >= CFG.MASH_WIN_THRESHOLD) {
      ms.winner = this.p1.id;
      this._clearTimers();
      this._endMiniGame(this.p1.id);
    } else if (ms.offset <= -CFG.MASH_WIN_THRESHOLD) {
      ms.winner = this.p2.id;
      this._clearTimers();
      this._endMiniGame(this.p2.id);
    } else {
      this._broadcastState();
    }
  }

  // ── Color Match ────────────────────────────────────────────────────────────

  _initColor() {
    const count = CFG.COLOR_DOT_COUNT;
    const dots = [];
    for (let i = 0; i < count; i++) {
      dots.push(Math.random() < 0.5 ? 'merah' : 'biru');
    }
    // Ensure at least one of each color
    if (dots.every((d) => d === 'merah')) dots[0] = 'biru';
    if (dots.every((d) => d === 'biru')) dots[0] = 'merah';

    this.miniGameState = {
      dots,
      startedAt: Date.now(),
      winner: null,
    };

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.phase !== 'playing' || this.miniGameState.winner) return;
      const ms = this.miniGameState;
      const p1Count = ms.dots.filter((d) => d === this.p1.side).length;
      const p2Count = ms.dots.filter((d) => d === this.p2.side).length;
      this._endMiniGame(p1Count >= p2Count ? this.p1.id : this.p2.id);
    }, CFG.COLOR_TIME_LIMIT_MS);
  }

  _handleColor(playerId, dotIndex) {
    const ms = this.miniGameState;
    if (!ms.dots || ms.winner) return;
    if (dotIndex < 0 || dotIndex >= ms.dots.length) return;

    const player = playerId === this.p1.id ? this.p1 : this.p2;
    const opponent = playerId === this.p1.id ? this.p2 : this.p1;

    if (ms.dots[dotIndex] === opponent.side) {
      // Good tap: flip opponent's dot to mine
      ms.dots[dotIndex] = player.side;
    } else if (ms.dots[dotIndex] === player.side) {
      // Blunder! Flip my dot to opponent's
      ms.dots[dotIndex] = opponent.side;
    }

    // Check win: all dots same color
    if (ms.dots.every((d) => d === player.side)) {
      ms.winner = playerId;
      this._clearTimers();
      this._endMiniGame(playerId);
    } else if (ms.dots.every((d) => d === opponent.side)) {
      ms.winner = opponent.id;
      this._clearTimers();
      this._endMiniGame(opponent.id);
    } else {
      this._broadcastState();
    }
  }

  // ── Memory (Virus Counting) ────────────────────────────────────────────────

  _initMemory() {
    const total = CFG.MEMORY_TOTAL_VIRUSES;
    const sequence = [];
    for (let i = 0; i < total; i++) {
      sequence.push(Math.random() < 0.5 ? 'merah' : 'biru');
    }
    // Ensure at least one of each
    if (sequence.every((c) => c === 'merah')) sequence[0] = 'biru';
    if (sequence.every((c) => c === 'biru')) sequence[0] = 'merah';

    const merahCount = sequence.filter((c) => c === 'merah').length;
    const biruCount = total - merahCount;
    const askColor = Math.random() < 0.5 ? 'merah' : 'biru';
    const correctAnswer = askColor === 'merah' ? merahCount : biruCount;

    // Generate answer options including the correct answer
    const options = new Set([correctAnswer]);
    for (let i = Math.max(0, correctAnswer - 3); options.size < CFG.MEMORY_OPTION_COUNT && i <= total; i++) {
      options.add(i);
    }

    this.miniGameState = {
      sequence,
      displayIndex: -1,
      memoryPhase: 'display', // display | pause | prompt
      askColor,
      correctAnswer,
      options: [...options].sort((a, b) => a - b),
      answers: { [this.p1.id]: null, [this.p2.id]: null },
      locked: { [this.p1.id]: false, [this.p2.id]: false },
      startedAt: Date.now(),
      winner: null,
    };

    this._advanceMemoryDisplay();
  }

  _advanceMemoryDisplay() {
    const ms = this.miniGameState;
    ms.displayIndex++;
    this._broadcastState();

    if (ms.displayIndex >= ms.sequence.length - 1) {
      // All viruses shown — transition to pause, then prompt
      this.displayTimer = setTimeout(() => {
        this.displayTimer = null;
        if (this.phase !== 'playing' || ms.winner) return;

        ms.memoryPhase = 'pause';
        this._broadcastState();

        this.phaseTimer = setTimeout(() => {
          this.phaseTimer = null;
          if (this.phase !== 'playing' || ms.winner) return;

          ms.memoryPhase = 'prompt';
          this._broadcastState();

          // Answer timeout
          this.phaseTimer = setTimeout(() => {
            this.phaseTimer = null;
            if (this.phase !== 'playing' || ms.winner) return;
            const winner = Math.random() < 0.5 ? this.p1.id : this.p2.id;
            ms.winner = winner;
            this._endMiniGame(winner);
          }, CFG.MEMORY_ANSWER_TIME_MS);
        }, CFG.MEMORY_PAUSE_MS);
      }, CFG.MEMORY_DISPLAY_INTERVAL_MS);
    } else {
      // Show next virus after interval
      this.displayTimer = setTimeout(() => {
        this.displayTimer = null;
        if (this.phase !== 'playing' || ms.winner) return;
        this._advanceMemoryDisplay();
      }, CFG.MEMORY_DISPLAY_INTERVAL_MS);
    }
  }

  _handleMemoryAnswer(playerId, value) {
    const ms = this.miniGameState;
    if (!ms || ms.winner || ms.memoryPhase !== 'prompt') return;
    if (ms.locked[playerId]) return;

    const opponentId = this._opponentOf(playerId);

    if (value === ms.correctAnswer) {
      ms.answers[playerId] = value;
      ms.winner = playerId;
      this._clearTimers();
      this._endMiniGame(playerId);
    } else {
      ms.answers[playerId] = value;
      ms.locked[playerId] = true;

      if (ms.locked[opponentId]) {
        // Both wrong — random winner
        const winner = Math.random() < 0.5 ? this.p1.id : this.p2.id;
        ms.winner = winner;
        this._clearTimers();
        this._endMiniGame(winner);
      } else {
        this._broadcastState();
      }
    }
  }

  // ── State broadcasting ─────────────────────────────────────────────────────

  _broadcastState() {
    const buildSlice = (player, opponent) => ({
      gameType: 'cute-aggression',
      phase: this.phase,
      roundNum: this.roundNum,
      currentMiniGame: this.currentMiniGame,
      miniPool: MINI_POOL,
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
      ready: this._buildReadySlice(player),
      mini: this._buildMiniSlice(player, opponent),
    });

    this.emit('cute-aggression-state', {
      byPlayer: {
        [this.p1.id]: buildSlice(this.p1, this.p2),
        [this.p2.id]: buildSlice(this.p2, this.p1),
      },
    });
  }

  _buildReadySlice(player) {
    const rs = this.readyState;
    if (!rs || !rs.holding) return {};
    const opponent = player.id === this.p1.id ? this.p2 : this.p1;

    return {
      meHolding: rs.holding[player.id] || false,
      oppHolding: rs.holding[opponent.id] || false,
      countdownElapsed: rs.countdownStart ? Date.now() - rs.countdownStart : 0,
      countdownTotal: CFG.COUNTDOWN_MS,
    };
  }

  _buildMiniSlice(player, opponent) {
    const ms = this.miniGameState;
    if (!ms) return {};
    const now = Date.now();

    switch (this.currentMiniGame) {
      case 'mash': {
        const rawOffset = ms.offset || 0;
        // Positive = I'm winning from this player's perspective
        const myOffset = player.id === this.p1.id ? rawOffset : -rawOffset;
        return {
          offset: myOffset,
          threshold: CFG.MASH_WIN_THRESHOLD,
          timeLimitMs: CFG.MASH_TIME_LIMIT_MS,
          timeLeft: ms.startedAt
            ? Math.max(0, CFG.MASH_TIME_LIMIT_MS - (now - ms.startedAt))
            : 0,
        };
      }

      case 'color':
        return {
          dots: ms.dots || [],
          mySide: player.side,
          oppSide: opponent.side,
          timeLimitMs: CFG.COLOR_TIME_LIMIT_MS,
          timeLeft: ms.startedAt
            ? Math.max(0, CFG.COLOR_TIME_LIMIT_MS - (now - ms.startedAt))
            : 0,
        };

      case 'memory': {
        const base = {
          memoryPhase: ms.memoryPhase || 'display',
          myLocked: ms.locked?.[player.id] || false,
          oppLocked: ms.locked?.[opponent.id] || false,
          myAnswer: ms.answers?.[player.id] ?? null,
        };

        if (ms.memoryPhase === 'display') {
          base.currentVirus = ms.displayIndex >= 0 && ms.displayIndex < ms.sequence.length
            ? ms.sequence[ms.displayIndex]
            : null;
          base.displayProgress = ms.displayIndex + 1;
          base.displayTotal = ms.sequence.length;
        }

        if (ms.memoryPhase === 'prompt' || ms.memoryPhase === 'pause') {
          base.askColor = ms.askColor;
          base.options = ms.options;
        }

        // Reveal correct answer once game is decided
        if (ms.winner || ms.locked?.[player.id]) {
          base.correctAnswer = ms.correctAnswer;
        }

        return base;
      }

      default:
        return {};
    }
  }
}
