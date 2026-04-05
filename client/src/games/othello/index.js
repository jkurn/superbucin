// Othello — game module registration
// Exports everything needed for GameRegistry

import { OthelloScene } from './OthelloScene.js';
import { applyServerConfig } from './config.js';

export const othelloGame = {
  type: 'othello',
  lobby: {
    name: 'Othello',
    icon: '⚫',
    badge: '2 Players',
    sides: [
      { id: 'black', label: 'Black', emoji: '⚫' },
      { id: 'white', label: 'White', emoji: '⚪' },
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
      { id: 'black', label: 'Black', emoji: '⚫' },
      { id: 'white', label: 'White', emoji: '⚪' },
    ],
  },
  Scene: OthelloScene,
  applyConfig: applyServerConfig,

  createHUD(overlay) {
    // Turn indicator bar (top)
    const turnBar = document.createElement('div');
    turnBar.className = 'othello-turn-bar';
    turnBar.id = 'othello-turn-bar';
    turnBar.innerHTML = '<span id="turn-text">Waiting...</span>';
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

      updateTurn(isMyTurn, mySide) {
        const el = document.getElementById('turn-text');
        if (el) {
          const disc = mySide === 'black' ? '⚫' : '⚪';
          el.textContent = isMyTurn ? `${disc} Your turn — tap to place` : "Waiting for opponent...";
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
    };
  },
};
