// Word Scramble Race — Boggle-style grid, dictionary validation on server

/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { WordScrambleScene } from './WordScrambleScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

function isAdjacent(a, b) {
  if (!a || !b) return false;
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

/** @type {GameDefinition} */
export const wordScrambleRaceGame = {
  type: 'word-scramble-race',
  lobby: {
    name: 'Word Scramble Race',
    icon: '🔤⚡',
    badge: '2 Players · 5 rounds',
  },
  sideSelect: {
    title: 'WORD SCRAMBLE RACE',
    pickTitle: 'Pick your team color~',
    options: [
      { side: 'sprout', emoji: '🌿', label: 'Sprout' },
      { side: 'blossom', emoji: '🌸', label: 'Blossom' },
    ],
  },
  Scene: WordScrambleScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, data, network) {
    const root = document.createElement('div');
    root.className = 'wsr-root';
    root.innerHTML = `
      <div class="wsr-topbar">
        <div class="wsr-round" id="wsr-round">Round 1 / ${GAME_CONFIG.NUM_ROUNDS}</div>
        <div class="wsr-timer" id="wsr-timer">—:—</div>
        <div class="wsr-phase-msg" id="wsr-phase-msg"></div>
      </div>
      <div class="wsr-scores">
        <div class="wsr-score-pill wsr-me"><span>You</span><strong id="wsr-score-me">0</strong></div>
        <div class="wsr-score-pill wsr-opp"><span>Sayang</span><strong id="wsr-score-opp">0</strong></div>
      </div>
      <div class="wsr-main">
        <div class="wsr-grid-wrap">
          <div class="wsr-grid" id="wsr-grid"></div>
          <div class="wsr-current" id="wsr-current"></div>
          <div class="wsr-actions">
            <button type="button" class="btn btn-blue btn-small" id="wsr-clear">Clear</button>
            <button type="button" class="btn btn-pink btn-small" id="wsr-submit">Submit word</button>
          </div>
        </div>
        <div class="wsr-words-panel">
          <div class="wsr-words-col">
            <div class="wsr-words-title">Your words</div>
            <ul class="wsr-word-list" id="wsr-list-me"></ul>
          </div>
          <div class="wsr-words-col">
            <div class="wsr-words-title">Sayang</div>
            <ul class="wsr-word-list" id="wsr-list-opp"></ul>
          </div>
        </div>
      </div>
      <div class="wsr-help">
        3 letters = 1pt · 4 = 3 · 5 = 5 · 6+ = 10 ·
        <strong>2×</strong> if sayang hasn’t found that word yet this round
      </div>
    `;
    overlay.appendChild(root);

    let path = [];
    let lastGridKey = '';
    let rafId = 0;
    let lastState = null;

    const gridEl = root.querySelector('#wsr-grid');
    const timerEl = root.querySelector('#wsr-timer');
    const roundEl = root.querySelector('#wsr-round');
    const phaseEl = root.querySelector('#wsr-phase-msg');
    const currentEl = root.querySelector('#wsr-current');
    const scoreMeEl = root.querySelector('#wsr-score-me');
    const scoreOppEl = root.querySelector('#wsr-score-opp');
    const listMeEl = root.querySelector('#wsr-list-me');
    const listOppEl = root.querySelector('#wsr-list-opp');

    function gridKey(g) {
      return g ? g.map((row) => row.join('')).join('|') : '';
    }

    function renderGrid(grid, size) {
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'wsr-cell';
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          cell.textContent = grid[r][c];
          cell.addEventListener('click', () => onCellClick(r, c));
          gridEl.appendChild(cell);
        }
      }
      syncPathHighlight();
    }

    function syncPathHighlight() {
      const cells = gridEl.querySelectorAll('.wsr-cell');
      cells.forEach((el) => {
        el.classList.remove('wsr-path', 'wsr-path-last');
      });
      path.forEach((p, i) => {
        const el = gridEl.querySelector(`.wsr-cell[data-r="${p.r}"][data-c="${p.c}"]`);
        if (el) {
          el.classList.add('wsr-path');
          if (i === path.length - 1) el.classList.add('wsr-path-last');
        }
      });
    }

    function wordFromPath(g) {
      if (!g || !path.length) return '';
      return path.map((p) => g[p.r][p.c]).join('').toLowerCase();
    }

    function onCellClick(r, c) {
      const state = lastState;
      if (!state || state.phase !== 'playing') return;
      const g = state.grid;
      const cell = { r, c };

      if (path.length === 0) {
        path = [cell];
      } else {
        const last = path[path.length - 1];
        if (last.r === r && last.c === c) {
          path.pop();
        } else if (isAdjacent(last, cell)) {
          const key = `${r},${c}`;
          const used = new Set(path.map((p) => `${p.r},${p.c}`));
          if (used.has(key)) return;
          path.push(cell);
        } else {
          path = [cell];
        }
      }
      syncPathHighlight();
      currentEl.textContent = wordFromPath(g);
    }

    function updateFromState(state) {
      lastState = state;
      const g = state.grid;
      const key = gridKey(g);
      if (key !== lastGridKey && g) {
        lastGridKey = key;
        path = [];
        renderGrid(g, state.gridSize || g.length);
        currentEl.textContent = '';
      }

      roundEl.textContent = `Round ${state.round} / ${state.numRounds}`;

      const myId = network.playerId;
      const opp = Object.keys(state.scores || {}).find((id) => id !== myId);
      scoreMeEl.textContent = state.scores[myId] ?? 0;
      scoreOppEl.textContent = opp ? (state.scores[opp] ?? 0) : 0;

      const wordsMe = (state.wordsFound && state.wordsFound[myId]) || [];
      const wordsOpp = opp ? (state.wordsFound[opp] || []) : [];
      listMeEl.innerHTML = wordsMe.map((w) => `<li>${w}</li>`).join('');
      listOppEl.innerHTML = wordsOpp.map((w) => `<li>${w}</li>`).join('');

      if (state.phase === 'intermission') {
        phaseEl.textContent = 'Next round soon…';
        gridEl.classList.add('wsr-dim');
      } else {
        phaseEl.textContent = '';
        gridEl.classList.remove('wsr-dim');
      }
    }

    function tickTimer() {
      cancelAnimationFrame(rafId);
      const loop = () => {
        const state = lastState;
        if (state && state.phase === 'playing' && state.roundEndsAt) {
          const ms = Math.max(0, state.roundEndsAt - Date.now());
          const s = Math.ceil(ms / 1000);
          const m = Math.floor(s / 60);
          const r = s % 60;
          timerEl.textContent = `${m}:${r.toString().padStart(2, '0')}`;
        } else if (state && state.phase === 'intermission') {
          timerEl.textContent = '—';
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    const onWordState = (state) => {
      updateFromState(state);
    };

    const onFeedback = (fb) => {
      if (fb.targetId && fb.targetId !== network.playerId) return;
      if (fb.ok) {
        const mult = fb.multiplier > 1 ? ` · ${fb.multiplier}× unique bonus` : '';
        network.ui.showError(`+${fb.points} pts${mult}`);
        path = [];
        syncPathHighlight();
        if (lastState?.grid) currentEl.textContent = '';
      } else if (fb.message) {
        network.ui.showError(fb.message);
      }
    };

    EventBus.on('word:state', onWordState);
    EventBus.on('word:feedback', onFeedback);

    root.querySelector('#wsr-clear').addEventListener('click', () => {
      path = [];
      syncPathHighlight();
      currentEl.textContent = '';
    });

    root.querySelector('#wsr-submit').addEventListener('click', () => {
      if (!lastState || lastState.phase !== 'playing') return;
      if (path.length < GAME_CONFIG.MIN_WORD_LENGTH) {
        network.ui.showError(`Need at least ${GAME_CONFIG.MIN_WORD_LENGTH} letters.`);
        return;
      }
      network.submitWord(path.map((p) => ({ r: p.r, c: p.c })));
    });

    tickTimer();

    return {
      destroy() {
        cancelAnimationFrame(rafId);
        EventBus.off('word:state', onWordState);
        EventBus.off('word:feedback', onFeedback);
        root.remove();
      },
    };
  },
};
