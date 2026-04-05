import { pickQuestions } from './questions.js';

export const GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  QUESTIONS_PER_ROUND: 10,
  BONUS_QUESTIONS: 2,
  TIME_PER_QUESTION_MS: 15_000,
  MATCH_POINTS: 10,
  BONUS_MATCH_POINTS: 20,
  REVEAL_DURATION_MS: 3500,
  COUNTDOWN_MS: 3000,
};

export class GameState {
  constructor(player1, player2, emitCallback) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.questions = [];
    this.currentIndex = 0;
    this.phase = 'countdown'; // countdown | question | reveal | finished
    this.scores = { [player1.id]: 0, [player2.id]: 0 };
    this.answers = { [player1.id]: null, [player2.id]: null };
    this.timerEndsAt = 0;
    this.pauseOffsetMs = 0;

    this.tickInterval = null;
    this.phaseTimer = null;
  }

  start() {
    this.active = true;
    this.scores[this.p1.id] = 0;
    this.scores[this.p2.id] = 0;
    this.questions = pickQuestions(
      GAME_CONFIG.QUESTIONS_PER_ROUND,
      GAME_CONFIG.BONUS_QUESTIONS,
    );
    this.currentIndex = 0;
    this.phase = 'countdown';
    this.clearTimers();
    this.startCountdown();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  pause() {
    if (!this.active) return;
    if (this.phase === 'question' && this.timerEndsAt > 0) {
      this.pauseOffsetMs = Math.max(0, this.timerEndsAt - Date.now());
    }
    this.clearTimers();
  }

  resume() {
    if (!this.active) return;
    if (this.phase === 'question' && this.pauseOffsetMs > 0) {
      this.timerEndsAt = Date.now() + this.pauseOffsetMs;
      this.pauseOffsetMs = 0;
      this.startTickLoop();
      this.broadcastState();
    } else if (this.phase === 'reveal') {
      this.startRevealTimer();
    } else if (this.phase === 'countdown') {
      this.startCountdown();
    }
  }

  clearTimers() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  startCountdown() {
    this.phase = 'countdown';
    this.broadcastState();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.startQuestion();
    }, GAME_CONFIG.COUNTDOWN_MS);
  }

  startQuestion() {
    if (!this.active) return;
    if (this.currentIndex >= this.questions.length) {
      this.finishMatch();
      return;
    }

    this.phase = 'question';
    this.answers[this.p1.id] = null;
    this.answers[this.p2.id] = null;
    this.timerEndsAt = Date.now() + GAME_CONFIG.TIME_PER_QUESTION_MS;
    this.pauseOffsetMs = 0;

    this.startTickLoop();
    this.broadcastState();
  }

  startTickLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), 300);
  }

  tick() {
    if (!this.active || this.phase !== 'question') return;
    if (Date.now() >= this.timerEndsAt) {
      this.revealAnswers();
      return;
    }
    this.broadcastState();
  }

  submitAnswer(playerId, answerIndex) {
    if (!this.active || this.phase !== 'question') return;
    if (playerId !== this.p1.id && playerId !== this.p2.id) return;
    if (this.answers[playerId] !== null) return;

    const q = this.questions[this.currentIndex];
    if (answerIndex < 0 || answerIndex >= q.options.length) return;

    this.answers[playerId] = answerIndex;
    this.broadcastState();

    if (this.answers[this.p1.id] !== null && this.answers[this.p2.id] !== null) {
      this.revealAnswers();
    }
  }

  revealAnswers() {
    if (this.phase === 'reveal') return;
    this.phase = 'reveal';

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    const q = this.questions[this.currentIndex];
    const a1 = this.answers[this.p1.id];
    const a2 = this.answers[this.p2.id];
    const isMatch = a1 !== null && a2 !== null && a1 === a2;

    if (isMatch) {
      const pts = q.isBonus
        ? GAME_CONFIG.BONUS_MATCH_POINTS
        : GAME_CONFIG.MATCH_POINTS;
      this.scores[this.p1.id] += pts;
      this.scores[this.p2.id] += pts;
    }

    this.broadcastState();
    this.startRevealTimer();
  }

  startRevealTimer() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.currentIndex++;
      this.startQuestion();
    }, GAME_CONFIG.REVEAL_DURATION_MS);
  }

  finishMatch() {
    this.active = false;
    this.phase = 'finished';
    this.clearTimers();

    const s1 = this.scores[this.p1.id];
    const s2 = this.scores[this.p2.id];

    // Cooperative game — both players share the same score, but
    // we still pick a "winner" for the standard match-end flow.
    // In speed-match both always have equal score, so it's always a tie.
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
    const q = this.questions[this.currentIndex] || null;
    const a1 = this.answers[this.p1.id];
    const a2 = this.answers[this.p2.id];
    const isMatch = a1 !== null && a2 !== null && a1 === a2;

    const pointsForMatch = q
      ? (q.isBonus ? GAME_CONFIG.BONUS_MATCH_POINTS : GAME_CONFIG.MATCH_POINTS)
      : 0;

    this.emit('speed-match-state', {
      phase: this.phase,
      questionNum: this.currentIndex + 1,
      totalQuestions: this.questions.length,
      category: q ? q.category : null,
      question: q ? q.text : null,
      options: q ? q.options : [],
      isBonus: q ? q.isBonus : false,
      timerEndsAt: this.phase === 'question' ? this.timerEndsAt : null,
      p1Answer: a1,
      p2Answer: a2,
      p1Answered: a1 !== null,
      p2Answered: a2 !== null,
      isMatch,
      pointsEarned: this.phase === 'reveal' && isMatch ? pointsForMatch : 0,
      scores: [this.scores[this.p1.id], this.scores[this.p2.id]],
      countdownMs: this.phase === 'countdown' ? GAME_CONFIG.COUNTDOWN_MS : null,
    });
  }
}
