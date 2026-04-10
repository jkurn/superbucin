// Othello — game module registration
// Exports everything needed for GameRegistry

/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { OthelloScene } from './OthelloScene.js';
import { applyServerConfig } from './config.js';
import { STICKERS } from '../../shared/StickerPack.js';

function stickerSrc(stickerKey) {
  if (!stickerKey) return STICKERS.mochiHappy;
  return STICKERS[stickerKey] || STICKERS.mochiHappy;
}

const TIMEOUT_STICKER_DURATION_MS = {
  mochiHappy: 5200,
  mochiHeart: 5200,
  coupleBlob: 5200,
  pricyLaughing: 6200,
  virtualHug: 5600,
  pricyRocket: 6200,
  pricyWine: 6200,
  kangenKamu: 5800,
  tanganBerat: 5800,
  janganSenyum: 5800,
  overthinking: 6200,
  sayangilahPricy: 6400,
};
const DEFAULT_TIMEOUT_STICKER_DURATION_MS = 5800;

/** @type {GameDefinition} */
export const othelloGame = {
  type: 'othello',
  lobby: {
    name: 'Othello',
    icon: '⚫',
    badge: '2 Players',
    sides: [
      { side: 'black', label: 'Black', emoji: '⚫' },
      { side: 'white', label: 'White', emoji: '⚪' },
    ],
  },
  victoryMessages: {
    win: ['You won! Well played!', 'Victory! Great strategy!', 'Dominant performance!'],
    lose: ['Better luck next time!', 'GG! Close game!', 'Almost had it!'],
    draw: ["It's a draw! Rematch?", 'Perfectly balanced!'],
  },
  sideSelect: {
    title: 'OTHELLO',
    pickTitle: 'Pick your disc color!',
    options: [
      { side: 'black', label: 'Black', emoji: '⚫' },
      { side: 'white', label: 'White', emoji: '⚪' },
    ],
  },
  Scene: OthelloScene,
  applyConfig: applyServerConfig,

  createHUD(overlay) {
    let timeoutHideTimer = null;

    // Turn indicator bar (top)
    const turnBar = document.createElement('div');
    turnBar.className = 'othello-turn-bar';
    turnBar.id = 'othello-turn-bar';
    turnBar.innerHTML = `
      <div class="othello-turn-main">
        <span id="turn-text">Waiting...</span>
        <img class="othello-turn-sticker" id="turn-sticker" src="${stickerSrc('mochiHappy')}" alt="Tiny Toes" />
        <span class="othello-turn-timer" id="turn-timer">10s</span>
      </div>
      <div class="othello-turn-vibe" id="turn-vibe">Tick tock, tiny toes on the clock.</div>
      <div class="othello-turn-timer-track">
        <div class="othello-turn-timer-fill" id="turn-timer-fill"></div>
      </div>
      <div class="othello-timeout-pop" id="othello-timeout-pop" hidden>
        <img class="othello-timeout-sticker" id="timeout-sticker" src="${stickerSrc('mochiHeart')}" alt="Timeout sticker" />
        <span class="othello-timeout-text" id="timeout-text"></span>
      </div>
    `;
    overlay.appendChild(turnBar);

    // Score display (bottom)
    const scoreBar = document.createElement('div');
    scoreBar.className = 'othello-score-bar';
    scoreBar.id = 'othello-score-bar';
    scoreBar.innerHTML = `
      <div class="score-side">
        <span class="score-disc">⚫</span>
        <span class="score-value" id="score-black">2</span>
      </div>
      <div class="score-divider">—</div>
      <div class="score-side">
        <span class="score-disc">⚪</span>
        <span class="score-value" id="score-white">2</span>
      </div>
    `;
    overlay.appendChild(scoreBar);

    return {
      updateScore(scores) {
        const blackEl = document.getElementById('score-black');
        const whiteEl = document.getElementById('score-white');
        if (blackEl) {
          blackEl.textContent = scores.black;
          blackEl.classList.add('score-bump');
          setTimeout(() => blackEl.classList.remove('score-bump'), 300);
        }
        if (whiteEl) {
          whiteEl.textContent = scores.white;
          whiteEl.classList.add('score-bump');
          setTimeout(() => whiteEl.classList.remove('score-bump'), 300);
        }
      },

      updateTurn(isMyTurn, mySide, turnTimeLeftMs = 0, turnTimeMs = 10_000, vibe = {}) {
        const el = document.getElementById('turn-text');
        if (el) {
          const disc = mySide === 'black' ? '⚫' : '⚪';
          el.textContent = isMyTurn ? `${disc} Your turn — tap to place` : "Waiting for opponent...";
        }
        const stickerEl = document.getElementById('turn-sticker');
        if (stickerEl) {
          stickerEl.src = stickerSrc(vibe.turnStickerKey);
        }
        const vibeEl = document.getElementById('turn-vibe');
        if (vibeEl) {
          const seconds = Math.ceil(Math.max(0, turnTimeLeftMs) / 1000);
          vibeEl.textContent = seconds <= 3
            ? 'Tick tock, tick tock... tiny claws coming.'
            : 'Tick tock, tiny toes on the clock.';
        }
        const timerEl = document.getElementById('turn-timer');
        const fillEl = document.getElementById('turn-timer-fill');
        if (timerEl) {
          const safeLeft = Math.max(0, Math.floor(turnTimeLeftMs));
          const secs = Math.ceil(safeLeft / 1000);
          timerEl.textContent = `${secs}s`;
          timerEl.classList.toggle('urgent', safeLeft > 0 && secs <= 3);
        }
        if (fillEl) {
          const safeTotal = Math.max(1, Math.floor(turnTimeMs));
          const safeLeft = Math.max(0, Math.floor(turnTimeLeftMs));
          const pct = Math.max(0, Math.min(100, (safeLeft / safeTotal) * 100));
          fillEl.style.width = `${pct}%`;
          fillEl.classList.toggle('urgent', safeLeft > 0 && safeLeft <= 3000);
        }
        const bar = document.getElementById('othello-turn-bar');
        if (bar) {
          bar.classList.toggle('my-turn', isMyTurn);
          bar.classList.toggle('opp-turn', !isMyTurn);
        }
        const scoreBar = document.getElementById('othello-score-bar');
        if (scoreBar) {
          scoreBar.classList.toggle('my-turn', isMyTurn);
        }
      },

      showTimeoutPenalty(payload = {}) {
        const popEl = document.getElementById('othello-timeout-pop');
        const timeoutSticker = document.getElementById('timeout-sticker');
        const timeoutText = document.getElementById('timeout-text');
        if (!popEl || !timeoutSticker || !timeoutText) return;

        if (timeoutHideTimer) {
          clearTimeout(timeoutHideTimer);
          timeoutHideTimer = null;
        }

        timeoutSticker.src = stickerSrc(payload.stickerKey);
        timeoutText.textContent = payload.flavorText || payload.message || 'Tiny Toes took over your turn.';
        popEl.hidden = false;
        popEl.classList.remove('show');
        void popEl.offsetWidth; // restart animation
        popEl.classList.add('show');
        const displayDurationMs = Number.isFinite(payload.displayDurationMs)
          ? payload.displayDurationMs
          : (TIMEOUT_STICKER_DURATION_MS[payload.stickerKey] || DEFAULT_TIMEOUT_STICKER_DURATION_MS);
        timeoutHideTimer = setTimeout(() => {
          popEl.classList.remove('show');
          popEl.hidden = true;
          timeoutHideTimer = null;
        }, displayDurationMs);
      },
    };
  },
};
