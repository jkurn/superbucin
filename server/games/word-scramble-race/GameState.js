import { isValidEnglishWord } from './dictionary.js';
import {
  generateGrid,
  randomGridSize,
  pathToWord,
  basePointsForLength,
} from './gridUtils.js';

export const GAME_CONFIG = {
  ROUND_DURATION_MS: 75_000,
  NUM_ROUNDS: 5,
  MIN_WORD_LENGTH: 3,
  INTERMISSION_MS: 3500,
  TICK_MS: 400,
};

export class GameState {
  constructor(player1, player2, emitCallback, _roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.grid = [];
    this.gridSize = 5;
    this.round = 1;
    this.roundEndsAt = 0;
    this.phase = 'playing'; // playing | intermission
    this.scores = { [player1.id]: 0, [player2.id]: 0 };
    /** @type {Record<string, Set<string>>} */
    this.roundWords = { [player1.id]: new Set(), [player2.id]: new Set() };
    this.tickInterval = null;
    this.intermissionTimer = null;
    this.pauseOffsetMs = 0;
    /** @type {Record<string, Promise<void>>} serialized async submitWord per player */
    this._wordSubmitTail = {
      [player1.id]: Promise.resolve(),
      [player2.id]: Promise.resolve(),
    };
  }

  start() {
    this.active = true;
    this.scores[this.p1.id] = 0;
    this.scores[this.p2.id] = 0;
    this.round = 1;
    this.phase = 'playing';
    this._wordSubmitTail[this.p1.id] = Promise.resolve();
    this._wordSubmitTail[this.p2.id] = Promise.resolve();
    this.clearTimers();
    this.startRound();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  pause() {
    if (!this.active) return;
    this.clearTickOnly();
    if (this.phase === 'playing' && this.roundEndsAt > 0) {
      this.pauseOffsetMs = Math.max(0, this.roundEndsAt - Date.now());
    }
    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }
  }

  resume() {
    if (!this.active) return;
    if (this.phase === 'playing' && this.pauseOffsetMs > 0) {
      this.roundEndsAt = Date.now() + this.pauseOffsetMs;
      this.pauseOffsetMs = 0;
      this.startTickLoop();
      this.broadcastState();
    }
  }

  clearTimers() {
    this.clearTickOnly();
    if (this.intermissionTimer) {
      clearTimeout(this.intermissionTimer);
      this.intermissionTimer = null;
    }
  }

  clearTickOnly() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  startRound() {
    this.phase = 'playing';
    this.gridSize = randomGridSize();
    this.grid = generateGrid(this.gridSize);
    this.roundWords[this.p1.id] = new Set();
    this.roundWords[this.p2.id] = new Set();
    this.roundEndsAt = Date.now() + GAME_CONFIG.ROUND_DURATION_MS;
    this.pauseOffsetMs = 0;
    this.startTickLoop();
    this.broadcastState();
  }

  startTickLoop() {
    this.clearTickOnly();
    this.tickInterval = setInterval(() => this.tick(), GAME_CONFIG.TICK_MS);
  }

  tick() {
    if (!this.active || this.phase !== 'playing') return;
    if (Date.now() >= this.roundEndsAt) {
      this.endRound();
      return;
    }
    this.broadcastState();
  }

  endRound() {
    this.clearTickOnly();
    if (this.round >= GAME_CONFIG.NUM_ROUNDS) {
      this.finishMatch();
      return;
    }

    this.phase = 'intermission';
    this.broadcastState();

    this.intermissionTimer = setTimeout(() => {
      this.intermissionTimer = null;
      this.round += 1;
      this.startRound();
    }, GAME_CONFIG.INTERMISSION_MS);
  }

  finishMatch() {
    this.active = false;
    this.clearTimers();

    const s1 = this.scores[this.p1.id];
    const s2 = this.scores[this.p2.id];
    let winnerId = null;
    if (s1 > s2) winnerId = this.p1.id;
    else if (s2 > s1) winnerId = this.p2.id;

    this.emit('match-end', {
      winnerId,
      tie: winnerId === null,
      scores: [s1, s2],
    });
  }

  broadcastState() {
    const payload = {
      grid: this.grid,
      gridSize: this.gridSize,
      round: this.round,
      numRounds: GAME_CONFIG.NUM_ROUNDS,
      phase: this.phase,
      roundEndsAt: this.phase === 'playing' ? this.roundEndsAt : null,
      intermissionMs: this.phase === 'intermission' ? GAME_CONFIG.INTERMISSION_MS : null,
      scores: { ...this.scores },
      wordsFound: {
        [this.p1.id]: [...this.roundWords[this.p1.id]].sort(),
        [this.p2.id]: [...this.roundWords[this.p2.id]].sort(),
      },
    };
    this.emit('word-scramble-state', payload);
  }

  /**
   * @param {string} playerId
   * @param {{ r: number, c: number }[]} path
   */
  submitWord(playerId, path) {
    const prev = this._wordSubmitTail[playerId] ?? Promise.resolve();
    const next = prev.then(() => this._submitWordImpl(playerId, path));
    this._wordSubmitTail[playerId] = next.catch(() => {});
    return next;
  }

  /**
   * @param {string} playerId
   * @param {{ r: number, c: number }[]} path
   */
  async _submitWordImpl(playerId, path) {
    if (!this.active || this.phase !== 'playing') return;
    if (playerId !== this.p1.id && playerId !== this.p2.id) return;

    const otherId = playerId === this.p1.id ? this.p2.id : this.p1.id;
    const parsed = pathToWord(this.grid, path);
    if (!parsed.ok || !parsed.word) {
      this.emit('word-scramble-feedback', {
        targetId: playerId,
        ok: false,
        message: 'Invalid path on the grid.',
      });
      return;
    }

    const word = parsed.word;
    if (word.length < GAME_CONFIG.MIN_WORD_LENGTH) {
      this.emit('word-scramble-feedback', {
        targetId: playerId,
        ok: false,
        message: `Words need at least ${GAME_CONFIG.MIN_WORD_LENGTH} letters.`,
      });
      return;
    }

    if (this.roundWords[playerId].has(word)) {
      this.emit('word-scramble-feedback', {
        targetId: playerId,
        ok: false,
        message: 'You already found that word this round.',
      });
      return;
    }

    const dictOk = await isValidEnglishWord(word);
    if (!dictOk) {
      this.emit('word-scramble-feedback', {
        targetId: playerId,
        ok: false,
        message: 'Not in dictionary.',
      });
      return;
    }

    if (this.roundWords[playerId].has(word)) {
      this.emit('word-scramble-feedback', {
        targetId: playerId,
        ok: false,
        message: 'You already found that word this round.',
      });
      return;
    }

    let base = basePointsForLength(word.length);
    const opponentHadWord = this.roundWords[otherId].has(word);
    const multiplier = opponentHadWord ? 1 : 2;
    const points = base * multiplier;

    this.roundWords[playerId].add(word);
    this.scores[playerId] += points;

    this.emit('word-scramble-feedback', {
      targetId: playerId,
      ok: true,
      word,
      basePoints: base,
      multiplier,
      points,
      opponentHadWord,
    });

    this.broadcastState();
  }

}
