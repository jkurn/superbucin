import { pickQuestions } from './questions.js';

export const GAME_CONFIG = {
  SKIP_SIDE_SELECT: true,
  QUESTIONS_PER_ROUND: 10,
  TIME_PER_QUESTION_MS: 12_000,
  POINTS_CORRECT: 10,
  POINTS_SPEED_BONUS: 5,
  REVEAL_DURATION_MS: 3000,
  COUNTDOWN_MS: 3000,
};

export class GameState {
  constructor(player1, player2, emitCallback, roomOptions = {}) {
    this.p1 = player1;
    this.p2 = player2;
    this.emit = emitCallback;

    this.active = false;
    this.paused = false;
    this.questions = [];
    this.currentIndex = 0;
    this.phase = 'countdown'; // countdown | question | reveal | finished
    this.scores = { [player1.id]: 0, [player2.id]: 0 };
    this.answers = { [player1.id]: null, [player2.id]: null };
    this.answerTimes = { [player1.id]: 0, [player2.id]: 0 };
    this.timerEndsAt = 0;
    this.pauseOffsetMs = 0;
    this.packId = roomOptions.packId || 'couples';
    this.customQuestions = roomOptions.customQuestions || null;

    this.tickInterval = null;
    this.phaseTimer = null;
  }

  start() {
    this.active = true;
    this.paused = false;
    this.scores[this.p1.id] = 0;
    this.scores[this.p2.id] = 0;
    this.questions = pickQuestions(
      GAME_CONFIG.QUESTIONS_PER_ROUND,
      this.customQuestions,
      this.packId,
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
    this.paused = true;
    if (this.phase === 'question' && this.timerEndsAt > 0) {
      this.pauseOffsetMs = Math.max(0, this.timerEndsAt - Date.now());
    }
    this.clearTimers();
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
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

  migratePlayer(oldId, newId, playerObj) {
    if (this.p1.id === oldId) this.p1 = playerObj;
    else if (this.p2.id === oldId) this.p2 = playerObj;

    // Migrate scores and answers
    if (this.scores[oldId] !== undefined) {
      this.scores[newId] = this.scores[oldId];
      delete this.scores[oldId];
    }
    if (this.answers[oldId] !== undefined) {
      this.answers[newId] = this.answers[oldId];
      delete this.answers[oldId];
    }
    if (this.answerTimes[oldId] !== undefined) {
      this.answerTimes[newId] = this.answerTimes[oldId];
      delete this.answerTimes[oldId];
    }
  }

  clearTimers() {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
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
    this.answerTimes[this.p1.id] = 0;
    this.answerTimes[this.p2.id] = 0;
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
    }
  }

  /** Called via handleAction from RoomManager */
  handleAction(playerId, action) {
    if (!this.active || this.paused) return;
    if (!action || typeof action !== 'object') return;

    if (action.type === 'answer') {
      this.submitAnswer(playerId, action.choice);
    }
  }

  submitAnswer(playerId, choice) {
    if (this.phase !== 'question') return;
    if (playerId !== this.p1.id && playerId !== this.p2.id) return;
    if (this.answers[playerId] !== null) return; // already answered

    const q = this.questions[this.currentIndex];
    if (choice < 0 || choice >= q.options.length) return;

    this.answers[playerId] = choice;
    this.answerTimes[playerId] = Date.now();
    this.broadcastState();

    // If both answered, reveal immediately
    if (this.answers[this.p1.id] !== null && this.answers[this.p2.id] !== null) {
      this.revealAnswers();
    }
  }

  revealAnswers() {
    if (this.phase === 'reveal') return;
    this.phase = 'reveal';

    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }

    const q = this.questions[this.currentIndex];
    const correct = q.correct;

    // Score: first correct answer gets bonus, both correct get base points
    for (const player of [this.p1, this.p2]) {
      const ans = this.answers[player.id];
      if (ans === correct) {
        this.scores[player.id] += GAME_CONFIG.POINTS_CORRECT;

        // Speed bonus: if this player answered first and correctly
        const other = player.id === this.p1.id ? this.p2 : this.p1;
        const otherAns = this.answers[other.id];
        const myTime = this.answerTimes[player.id];
        const otherTime = this.answerTimes[other.id];

        if (otherAns !== correct || (myTime > 0 && otherTime > 0 && myTime < otherTime)) {
          this.scores[player.id] += GAME_CONFIG.POINTS_SPEED_BONUS;
        }
      }
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
    const correct = q ? q.correct : -1;
    const a1 = this.answers[this.p1.id];
    const a2 = this.answers[this.p2.id];

    this.emit('state-update', {
      gameType: 'quiz-race',
      phase: this.phase,
      questionNum: this.currentIndex + 1,
      totalQuestions: this.questions.length,
      category: q ? q.category : null,
      question: q ? q.text : null,
      options: q ? q.options : [],
      correct: this.phase === 'reveal' ? correct : -1, // only reveal correct answer in reveal phase
      timerEndsAt: this.phase === 'question' ? this.timerEndsAt : null,
      p1Answer: this.phase === 'reveal' ? a1 : null,
      p2Answer: this.phase === 'reveal' ? a2 : null,
      p1Answered: a1 !== null,
      p2Answered: a2 !== null,
      scores: { [this.p1.id]: this.scores[this.p1.id], [this.p2.id]: this.scores[this.p2.id] },
    });
  }
}
