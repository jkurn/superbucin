import {
  getDoodlePackPrompts,
  resolveDoodlePackId,
  DEFAULT_DOODLE_PACK_ID,
} from './prompts.js';

export const DOODLE_GAME_CONFIG = {
  ROUND_TIME_MS: 30000,
  TOTAL_ROUNDS: 6,
  MAX_POINTS_PER_ROUND: 100,
  MIN_POINTS_CORRECT: 8,
  GAME_NAME: 'doodle-guess',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeGuess(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function answersMatch(guessRaw, answerRaw) {
  const g = normalizeGuess(guessRaw);
  const a = normalizeGuess(answerRaw);
  if (!g || !a) return false;
  if (g === a) return true;
  if (a.length >= 4 && g.includes(a)) return true;
  if (g.length >= 4 && a.includes(g)) return true;
  return false;
}

export class DoodleGuessGameState {
  constructor(player1, player2, emitCallback, options = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;
    this.customPrompts = (options.customPrompts || [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    this.packId = resolveDoodlePackId(options.doodlePackId);

    this.scores = { [player1.id]: 0, [player2.id]: 0 };
    this.active = false;
    this.roundIndex = 0;
    this.phase = 'idle';
    this.currentPrompt = '';
    this.drawer = null;
    this.guesser = null;
    this.roundEndsAt = 0;
    this.roundTimer = null;
    this.strokeHistory = [];
    this.promptQueue = [];
  }

  migrateSocketId(oldId, newId) {
    if (this.scores[oldId] !== undefined) {
      this.scores[newId] = this.scores[oldId];
      delete this.scores[oldId];
    }
  }

  start() {
    this.stopTimers();
    this.active = true;
    this.scores[this.p1.id] = 0;
    this.scores[this.p2.id] = 0;
    this.roundIndex = 0;
    this.strokeHistory = [];
    this.buildPromptQueue();
    this.startRound(0);
  }

  buildPromptQueue() {
    const { TOTAL_ROUNDS } = DOODLE_GAME_CONFIG;
    const packWords = getDoodlePackPrompts(this.packId);
    const fallback = getDoodlePackPrompts(DEFAULT_DOODLE_PACK_ID);

    let merged;
    if (this.packId === 'custom') {
      merged = [...new Set([...this.customPrompts])];
      if (merged.length === 0) {
        merged = [...new Set([...fallback])];
      }
    } else {
      merged = [...new Set([...this.customPrompts, ...packWords])];
    }

    this.promptQueue = shuffle(merged);
    const fillerSource = merged.length > 0 ? merged : fallback;
    const fillerPool = shuffle([...fillerSource]);
    while (this.promptQueue.length < TOTAL_ROUNDS && fillerPool.length > 0) {
      this.promptQueue.push(fillerPool[this.promptQueue.length % fillerPool.length]);
    }
    this.promptQueue = this.promptQueue.slice(0, TOTAL_ROUNDS);
  }

  stop() {
    this.active = false;
    this.stopTimers();
  }

  pause() {
    this.stopTimers();
  }

  resume() {
    if (!this.active) return;
    if (this.phase === 'drawing' && this.roundEndsAt > Date.now()) {
      const remaining = Math.max(0, this.roundEndsAt - Date.now());
      this.roundTimer = setTimeout(() => this.endRound(false), remaining);
    }
  }

  stopTimers() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  getRolesForRound(r) {
    const fixedDrawer = this.p1.side === 'drawer' ? this.p1 : this.p2;
    const fixedGuesser = this.p1.side === 'guesser' ? this.p1 : this.p2;
    if (r % 2 === 0) {
      return { drawer: fixedDrawer, guesser: fixedGuesser };
    }
    return { drawer: fixedGuesser, guesser: fixedDrawer };
  }

  startRound(r) {
    this.stopTimers();
    this.roundIndex = r;
    this.phase = 'drawing';
    this.strokeHistory = [];
    const { drawer, guesser } = this.getRolesForRound(r);
    this.drawer = drawer;
    this.guesser = guesser;
    this.currentPrompt = this.promptQueue[r] || 'Love';

    this.roundEndsAt = Date.now() + DOODLE_GAME_CONFIG.ROUND_TIME_MS;
    this.roundTimer = setTimeout(() => this.endRound(false), DOODLE_GAME_CONFIG.ROUND_TIME_MS);

    this.emitDoodleState();
    this.emit('doodle-clear', { targetId: this.guesser.id });
  }

  buildPersonalState(playerId, extra = {}) {
    const { TOTAL_ROUNDS, ROUND_TIME_MS, MAX_POINTS_PER_ROUND, MIN_POINTS_CORRECT } = DOODLE_GAME_CONFIG;
    const base = {
      phase: this.phase,
      round: this.roundIndex + 1,
      totalRounds: TOTAL_ROUNDS,
      endsAt: this.roundEndsAt,
      scores: { ...this.scores },
      roundTimeMs: ROUND_TIME_MS,
      maxPointsPerRound: MAX_POINTS_PER_ROUND,
      minPointsCorrect: MIN_POINTS_CORRECT,
      ...extra,
    };
    return {
      ...base,
      youAreDrawer: this.drawer?.id === playerId,
      prompt: this.drawer?.id === playerId && this.phase === 'drawing' ? this.currentPrompt : null,
    };
  }

  emitDoodleState(extra = {}) {
    const byPlayer = {
      [this.p1.id]: this.buildPersonalState(this.p1.id, extra),
      [this.p2.id]: this.buildPersonalState(this.p2.id, extra),
    };
    this.emit('doodle-state', { byPlayer });
  }

  appendStroke(socketId, payload) {
    if (!this.active || this.phase !== 'drawing') return;
    if (!this.drawer || socketId !== this.drawer.id) return;
    const entry = { ...payload, t: Date.now() };
    if (this.strokeHistory.length < 800) {
      this.strokeHistory.push(entry);
    }
    this.emit('doodle-draw', { targetId: this.guesser.id, payload: entry });
  }

  clearCanvas(socketId) {
    if (!this.active || this.phase !== 'drawing') return;
    if (!this.drawer || socketId !== this.drawer.id) return;
    this.strokeHistory = [];
    this.emit('doodle-clear', { targetId: this.guesser.id });
  }

  submitGuess(socketId, text) {
    if (!this.active || this.phase !== 'drawing') return;
    if (!this.guesser || socketId !== this.guesser.id) return;
    const guess = String(text || '').trim();
    if (!guess) return;

    if (answersMatch(guess, this.currentPrompt)) {
      const remaining = Math.max(0, this.roundEndsAt - Date.now());
      const ratio = remaining / DOODLE_GAME_CONFIG.ROUND_TIME_MS;
      let pts = Math.round(ratio * DOODLE_GAME_CONFIG.MAX_POINTS_PER_ROUND);
      pts = Math.max(DOODLE_GAME_CONFIG.MIN_POINTS_CORRECT, Math.min(DOODLE_GAME_CONFIG.MAX_POINTS_PER_ROUND, pts));
      this.scores[this.guesser.id] = (this.scores[this.guesser.id] || 0) + pts;
      this.stopTimers();
      this.phase = 'round_result';
      this.emitDoodleState({
        lastResult: {
          correct: true,
          points: pts,
          guess,
          answer: this.currentPrompt,
          winnerId: this.guesser.id,
        },
      });
      setTimeout(() => this.advanceRound(), 2200);
    } else {
      this.emit('doodle-guess-wrong', { targetId: this.guesser.id, guess });
    }
  }

  endRound(timedOut) {
    if (!this.active || this.phase !== 'drawing') return;
    this.stopTimers();
    this.phase = 'round_result';
    this.emitDoodleState({
      lastResult: {
        correct: false,
        points: 0,
        answer: this.currentPrompt,
        timedOut: timedOut,
      },
    });
    setTimeout(() => this.advanceRound(), timedOut ? 2800 : 2200);
  }

  advanceRound() {
    if (!this.active) return;
    const next = this.roundIndex + 1;
    if (next >= DOODLE_GAME_CONFIG.TOTAL_ROUNDS) {
      this.finishMatch();
      return;
    }
    this.startRound(next);
  }

  finishMatch() {
    this.stopTimers();
    this.phase = 'game_over';
    this.active = false;
    const s1 = this.scores[this.p1.id] || 0;
    const s2 = this.scores[this.p2.id] || 0;
    let winnerId = null;
    if (s1 > s2) winnerId = this.p1.id;
    else if (s2 > s1) winnerId = this.p2.id;
    this.emit('match-end', {
      winnerId,
      tie: winnerId === null,
      scores: [s1, s2],
    });
  }

  getStrokeHistoryFor(targetId) {
    if (targetId !== this.guesser?.id) return [];
    return [...this.strokeHistory];
  }

  getPersonalStateFor(playerId) {
    return this.buildPersonalState(playerId, {});
  }
}
