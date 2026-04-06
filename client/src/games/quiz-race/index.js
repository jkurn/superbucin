/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { QuizRaceScene } from './QuizRaceScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

const CATEGORY_LABELS = {
  food: '🍕 Food',
  travel: '✈️ Travel',
  dates: '💕 Dates',
  fun: '🎉 Fun',
  music: '🎵 Music',
  habits: '💤 Habits',
  science: '🔬 Science',
  geography: '🌍 Geography',
  tech: '💻 Tech',
  art: '🎨 Art',
  history: '📜 History',
  sports: '⚽ Sports',
  custom: '⭐ Custom',
};

/** @type {GameDefinition} */
export const quizRaceGame = {
  type: 'quiz-race',
  lobby: {
    name: 'Blitz Trivia',
    icon: '🧠⚡',
    badge: '2 Players',
  },
  victoryMessages: {
    win: ['Big brain energy! GG sayang~', 'Trivia champion! 🧠', 'You crushed it!'],
    lose: ['Yahhh~ Almost got it!', 'So close! Rematch?', 'GG sayang! Next time!'],
    draw: ['Tied! Equally smart~', 'Same brain!'],
  },
  Scene: QuizRaceScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, data, network) {
    const container = document.createElement('div');
    container.className = 'qr-hud';
    container.innerHTML = `
      <div class="qr-top-bar">
        <div class="qr-score-block">
          <span class="qr-score-label">You</span>
          <span class="qr-score-value" id="qr-my-score">0</span>
        </div>
        <div class="qr-progress">
          <span id="qr-question-num">1</span>/<span id="qr-total">${GAME_CONFIG.QUESTIONS_PER_ROUND}</span>
        </div>
        <div class="qr-score-block">
          <span class="qr-score-label">Sayang</span>
          <span class="qr-score-value" id="qr-opp-score">0</span>
        </div>
      </div>
      <div class="qr-timer-bar"><div class="qr-timer-fill" id="qr-timer-fill"></div></div>
      <div class="qr-body" id="qr-body">
        <div class="qr-countdown-big" id="qr-countdown-big"></div>
      </div>
    `;
    overlay.appendChild(container);

    let timerEndsAt = null;
    let timerDuration = GAME_CONFIG.TIME_PER_QUESTION_MS;
    let selectedAnswer = null;
    let currentPhase = 'countdown';
    let timerRAF = null;

    function updateTimerBar() {
      const fill = document.getElementById('qr-timer-fill');
      if (!fill || !timerEndsAt) {
        if (fill) fill.style.width = '100%';
        timerRAF = requestAnimationFrame(updateTimerBar);
        return;
      }
      const remaining = Math.max(0, timerEndsAt - Date.now());
      const pct = (remaining / timerDuration) * 100;
      fill.style.width = `${pct}%`;

      if (pct < 20) {
        fill.classList.add('qr-timer-danger');
      } else {
        fill.classList.remove('qr-timer-danger');
      }

      if (remaining > 0 && currentPhase === 'question') {
        timerRAF = requestAnimationFrame(updateTimerBar);
      }
    }

    function renderCountdown() {
      const body = document.getElementById('qr-body');
      if (!body) return;
      body.innerHTML = `
        <div class="qr-countdown-big">
          <div class="qr-countdown-icon">🧠⚡</div>
          <div class="qr-countdown-text">Get Ready!</div>
        </div>
      `;
    }

    function renderQuestion(state) {
      const body = document.getElementById('qr-body');
      if (!body) return;

      const categoryLabel = CATEGORY_LABELS[state.category] || state.category || '';

      body.innerHTML = `
        <div class="qr-category">${categoryLabel}</div>
        <div class="qr-question">${state.question}</div>
        <div class="qr-options" id="qr-options"></div>
        <div class="qr-wait-status" id="qr-wait-status"></div>
      `;

      const optionsEl = document.getElementById('qr-options');
      state.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'qr-option-btn';
        btn.textContent = opt;
        btn.dataset.index = i;
        btn.addEventListener('click', () => {
          if (selectedAnswer !== null) return;
          selectedAnswer = i;
          network.sendGameAction({ type: 'answer', choice: i });

          optionsEl.querySelectorAll('.qr-option-btn').forEach((b) => {
            b.classList.remove('qr-option-selected');
          });
          btn.classList.add('qr-option-selected');

          const status = document.getElementById('qr-wait-status');
          if (status) {
            status.textContent = 'Locked in! Waiting for sayang~ ⏳';
            status.className = 'qr-wait-status qr-waiting';
          }
        });
        optionsEl.appendChild(btn);
      });
    }

    function renderReveal(state) {
      const body = document.getElementById('qr-body');
      if (!body) return;

      const categoryLabel = CATEGORY_LABELS[state.category] || state.category || '';
      const correctIdx = state.correct;

      body.innerHTML = `
        <div class="qr-category">${categoryLabel}</div>
        <div class="qr-question" style="font-size:1rem;opacity:0.7;">${state.question}</div>
        <div class="qr-options-reveal" id="qr-options-reveal"></div>
        <div class="qr-reveal-status" id="qr-reveal-status"></div>
      `;

      const optionsEl = document.getElementById('qr-options-reveal');
      state.options.forEach((opt, i) => {
        const btn = document.createElement('div');
        btn.className = 'qr-option-reveal';

        const isCorrect = i === correctIdx;
        const isMyPick = i === state.p1Answer;
        const isOppPick = i === state.p2Answer;

        if (isCorrect) btn.classList.add('qr-correct');
        if (isMyPick && !isCorrect) btn.classList.add('qr-wrong');
        if (isOppPick && !isCorrect) btn.classList.add('qr-opp-wrong');

        let markers = '';
        if (isMyPick) markers += ' <span class="qr-pick-marker qr-you-marker">You</span>';
        if (isOppPick) markers += ' <span class="qr-pick-marker qr-opp-marker">Sayang</span>';
        if (isCorrect) markers += ' ✅';

        btn.innerHTML = `<span>${opt}</span>${markers}`;
        optionsEl.appendChild(btn);
      });

      // Show result message
      const statusEl = document.getElementById('qr-reveal-status');
      if (statusEl) {
        const myPick = state.p1Answer;
        if (myPick === correctIdx) {
          statusEl.textContent = '🎉 Correct!';
          statusEl.className = 'qr-reveal-status qr-reveal-correct';
        } else if (myPick === null) {
          statusEl.textContent = "⏰ Time's up!";
          statusEl.className = 'qr-reveal-status qr-reveal-timeout';
        } else {
          statusEl.textContent = '😅 Wrong~';
          statusEl.className = 'qr-reveal-status qr-reveal-wrong';
        }
      }
    }

    function onGameState(state) {
      if (state.gameType !== 'quiz-race') return;
      currentPhase = state.phase;

      // Update scores — use yourId to figure out which score is ours
      const myId = network.playerId;
      const myScore = state.scores?.[myId] ?? 0;
      let oppScore = 0;
      if (state.scores) {
        for (const [id, score] of Object.entries(state.scores)) {
          if (id !== myId) oppScore = score;
        }
      }

      const myScoreEl = document.getElementById('qr-my-score');
      const oppScoreEl = document.getElementById('qr-opp-score');
      const qNum = document.getElementById('qr-question-num');
      const qTotal = document.getElementById('qr-total');
      if (myScoreEl) myScoreEl.textContent = myScore;
      if (oppScoreEl) oppScoreEl.textContent = oppScore;
      if (qNum) qNum.textContent = state.questionNum;
      if (qTotal) qTotal.textContent = state.totalQuestions;

      // Remap p1Answer/p2Answer to be relative to this player
      // Server sends p1Answer/p2Answer based on room order, but
      // we need to show "your answer" vs "opponent answer"
      const isP1 = state.yourId === Object.keys(state.scores)[0];
      const viewState = {
        ...state,
        p1Answer: isP1 ? state.p1Answer : state.p2Answer,
        p2Answer: isP1 ? state.p2Answer : state.p1Answer,
      };

      switch (state.phase) {
        case 'countdown':
          renderCountdown();
          break;

        case 'question': {
          if (selectedAnswer === null && !document.getElementById('qr-options')) {
            renderQuestion(viewState);
          }
          if (state.timerEndsAt) {
            timerEndsAt = state.timerEndsAt;
            timerDuration = GAME_CONFIG.TIME_PER_QUESTION_MS;
            if (!timerRAF) timerRAF = requestAnimationFrame(updateTimerBar);
          }
          // Show partner answered indicator
          const oppAnswered = isP1 ? state.p2Answered : state.p1Answered;
          if (selectedAnswer === null && oppAnswered) {
            const status = document.getElementById('qr-wait-status');
            if (status) {
              status.textContent = 'Sayang already answered! 👀';
              status.className = 'qr-wait-status qr-partner-ready';
            }
          }
          break;
        }

        case 'reveal':
          selectedAnswer = null;
          timerEndsAt = null;
          renderReveal(viewState);
          break;

        default:
          break;
      }
    }

    EventBus.on('game:state', onGameState);

    // Start timer animation loop
    timerRAF = requestAnimationFrame(updateTimerBar);

    return {
      updateHP() {},
      updateEnergy() {},
      updateSpawnButtons() {},
      onGameState(_state) {},
      destroy() {
        EventBus.off('game:state', onGameState);
        if (timerRAF) cancelAnimationFrame(timerRAF);
      },
    };
  },
};
