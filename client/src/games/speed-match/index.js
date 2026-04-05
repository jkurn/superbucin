/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { SpeedMatchScene } from './SpeedMatchScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

const CATEGORY_LABELS = {
  food: '🍕 Food',
  movies: '🎬 Entertainment',
  places: '🌍 Places',
  habits: '💭 Habits',
  partner: '💕 Sayang Says',
};

/** @type {GameDefinition} */
export const speedMatchGame = {
  type: 'speed-match',
  lobby: {
    name: 'Speed Match',
    icon: '⚡💕',
    badge: '2 Players',
  },
  Scene: SpeedMatchScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, data, network) {
    const container = document.createElement('div');
    container.className = 'sm-hud';
    container.innerHTML = `
      <div class="sm-top-bar">
        <div class="sm-score-block">
          <span class="sm-score-label">You</span>
          <span class="sm-score-value" id="sm-my-score">0</span>
        </div>
        <div class="sm-progress">
          <span id="sm-question-num">1</span>/<span id="sm-total">12</span>
        </div>
        <div class="sm-score-block">
          <span class="sm-score-label">Sayang</span>
          <span class="sm-score-value" id="sm-opp-score">0</span>
        </div>
      </div>
      <div class="sm-timer-bar"><div class="sm-timer-fill" id="sm-timer-fill"></div></div>
      <div class="sm-body" id="sm-body">
        <div class="sm-countdown-big" id="sm-countdown-big"></div>
      </div>
    `;
    overlay.appendChild(container);

    let timerEndsAt = null;
    let timerDuration = GAME_CONFIG.TIME_PER_QUESTION_MS;
    let selectedAnswer = null;
    let currentPhase = 'countdown';
    let timerRAF = null;

    function updateTimerBar() {
      const fill = document.getElementById('sm-timer-fill');
      if (!fill || !timerEndsAt) {
        if (fill) fill.style.width = '100%';
        timerRAF = requestAnimationFrame(updateTimerBar);
        return;
      }
      const remaining = Math.max(0, timerEndsAt - Date.now());
      const pct = (remaining / timerDuration) * 100;
      fill.style.width = `${pct}%`;

      if (pct < 20) {
        fill.classList.add('sm-timer-danger');
      } else {
        fill.classList.remove('sm-timer-danger');
      }

      if (remaining > 0 && currentPhase === 'question') {
        timerRAF = requestAnimationFrame(updateTimerBar);
      }
    }

    function renderCountdown() {
      const body = document.getElementById('sm-body');
      if (!body) return;
      body.innerHTML = `
        <div class="sm-countdown-big" id="sm-countdown-big">
          <div class="sm-countdown-icon">⚡💕</div>
          <div class="sm-countdown-text">Get Ready!</div>
        </div>
      `;
    }

    function renderQuestion(state) {
      const body = document.getElementById('sm-body');
      if (!body) return;

      const categoryLabel = CATEGORY_LABELS[state.category] || state.category;
      const bonusBadge = state.isBonus
        ? '<span class="sm-bonus-badge">BONUS ×2</span>'
        : '';

      body.innerHTML = `
        <div class="sm-category">${categoryLabel} ${bonusBadge}</div>
        <div class="sm-question">${state.question}</div>
        <div class="sm-options" id="sm-options"></div>
        <div class="sm-wait-status" id="sm-wait-status"></div>
      `;

      const optionsEl = document.getElementById('sm-options');
      state.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'sm-option-btn';
        btn.textContent = opt;
        btn.dataset.index = i;
        btn.addEventListener('click', () => {
          if (selectedAnswer !== null) return;
          selectedAnswer = i;
          network.socket.emit('speed-match-answer', { answer: i });

          optionsEl.querySelectorAll('.sm-option-btn').forEach((b) => {
            b.classList.remove('sm-option-selected');
          });
          btn.classList.add('sm-option-selected');

          const status = document.getElementById('sm-wait-status');
          if (status && !state.partnerAnswered) {
            status.textContent = 'Waiting for sayang~ ⏳';
            status.className = 'sm-wait-status sm-waiting';
          }
        });
        optionsEl.appendChild(btn);
      });
    }

    function renderReveal(state) {
      const body = document.getElementById('sm-body');
      if (!body) return;

      const categoryLabel = CATEGORY_LABELS[state.category] || state.category;
      const bonusBadge = state.isBonus
        ? '<span class="sm-bonus-badge">BONUS ×2</span>'
        : '';

      const myAnswer = state.yourAnswer;
      const partnerAnswer = state.partnerAnswer;
      const myText = myAnswer !== null ? state.options[myAnswer] : '⏰ No Answer';
      const partnerText = partnerAnswer !== null ? state.options[partnerAnswer] : '⏰ No Answer';

      const matchClass = state.isMatch ? 'sm-match' : 'sm-no-match';
      const matchText = state.isMatch
        ? `💕 MATCH! +${state.pointsEarned} points!`
        : '😅 No match~';

      body.innerHTML = `
        <div class="sm-category">${categoryLabel} ${bonusBadge}</div>
        <div class="sm-question" style="font-size:1rem;opacity:0.7;">${state.question}</div>
        <div class="sm-reveal-answers">
          <div class="sm-reveal-card sm-reveal-you ${matchClass}">
            <div class="sm-reveal-label">You</div>
            <div class="sm-reveal-answer">${myText}</div>
          </div>
          <div class="sm-reveal-vs ${matchClass}">${state.isMatch ? '💕' : 'VS'}</div>
          <div class="sm-reveal-card sm-reveal-partner ${matchClass}">
            <div class="sm-reveal-label">Sayang</div>
            <div class="sm-reveal-answer">${partnerText}</div>
          </div>
        </div>
        <div class="sm-match-result ${matchClass}">${matchText}</div>
      `;
    }

    function onSpeedMatchState(state) {
      currentPhase = state.phase;

      // Update scores
      const myScore = document.getElementById('sm-my-score');
      const oppScore = document.getElementById('sm-opp-score');
      const qNum = document.getElementById('sm-question-num');
      const qTotal = document.getElementById('sm-total');
      if (myScore) myScore.textContent = state.yourScore;
      if (oppScore) oppScore.textContent = state.partnerScore;
      if (qNum) qNum.textContent = state.questionNum;
      if (qTotal) qTotal.textContent = state.totalQuestions;

      switch (state.phase) {
        case 'countdown':
          renderCountdown();
          break;

        case 'question':
          if (selectedAnswer === null && !document.getElementById('sm-options')) {
            renderQuestion(state);
          }
          // Update timer
          if (state.timerEndsAt) {
            timerEndsAt = state.timerEndsAt;
            timerDuration = GAME_CONFIG.TIME_PER_QUESTION_MS;
            if (!timerRAF) timerRAF = requestAnimationFrame(updateTimerBar);
          }
          // Show partner status
          if (selectedAnswer === null && state.partnerAnswered) {
            const status = document.getElementById('sm-wait-status');
            if (status) {
              status.textContent = 'Sayang already answered! 👀';
              status.className = 'sm-wait-status sm-partner-ready';
            }
          }
          break;

        case 'reveal':
          selectedAnswer = null;
          timerEndsAt = null;
          renderReveal(state);
          break;

        default:
          break;
      }
    }

    EventBus.on('speed-match:state', onSpeedMatchState);

    // Start the timer animation loop
    timerRAF = requestAnimationFrame(updateTimerBar);

    return {
      updateHP() {},
      updateEnergy() {},
      updateSpawnButtons() {},
      destroy() {
        EventBus.off('speed-match:state', onSpeedMatchState);
        if (timerRAF) cancelAnimationFrame(timerRAF);
      },
    };
  },
};
