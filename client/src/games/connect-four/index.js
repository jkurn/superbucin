/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { ConnectFourScene } from './ConnectFourScene.js';
import { applyServerConfig } from './config.js';

/** @type {GameDefinition} */
export const connectFourGame = {
  type: 'connect-four',
  lobby: {
    name: 'Connect Four',
    icon: '\ud83d\udfe1',
    badge: '2 Players',
    sides: [
      { side: 'yellow', label: 'Yellow', emoji: '\ud83d\udfe1' },
      { side: 'pink', label: 'Pink', emoji: '\ud83d\udfe3' },
    ],
  },
  sideSelect: {
    title: 'CONNECT FOUR',
    pickTitle: 'Pick your disc color!',
    options: [
      { side: 'yellow', label: 'Yellow', emoji: '\ud83d\udfe1' },
      { side: 'pink', label: 'Pink', emoji: '\ud83d\udfe3' },
    ],
  },
  victoryMessages: {
    win: ['Four in a row! GG sayang~', 'You won! Stacking champion!', 'VICTORY! That was clean!'],
    lose: ['Yahhh kalah~ Next time!', 'GG sayang! Almost had it!', 'So close! Rematch?'],
    draw: ['Board is full! Tie!', 'Perfectly matched!'],
  },
  Scene: ConnectFourScene,
  applyConfig: applyServerConfig,

  createHUD(overlay) {
    const turnBar = document.createElement('div');
    turnBar.className = 'othello-turn-bar';
    turnBar.id = 'cf-turn-bar';
    turnBar.innerHTML = '<span id="cf-turn-text">Waiting...</span>';
    overlay.appendChild(turnBar);

    return {
      updateHP() {},
      updateEnergy() {},
      updateSpawnButtons() {},
      onGameState(state) {
        const el = document.getElementById('cf-turn-text');
        const bar = document.getElementById('cf-turn-bar');
        if (!el) return;
        const isMyTurn = state.currentTurn === state.yourId;
        if (state.winLine) {
          // currentTurn is still the winner's ID when winLine is set (turn doesn't switch on win)
          el.textContent = isMyTurn ? 'You won! 🎉' : 'You lost...';
        } else {
          el.textContent = isMyTurn ? '\ud83d\udfe1 Your turn \u2014 tap a column' : 'Waiting for opponent...';
        }
        if (bar) {
          bar.classList.toggle('my-turn', isMyTurn);
          bar.classList.toggle('opp-turn', !isMyTurn);
        }
      },
      destroy() {},
    };
  },
};
