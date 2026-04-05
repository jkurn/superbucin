// Pig vs Chick — game module registration
// Exports everything needed for GameRegistry

import { PigVsChickScene } from './PigVsChickScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';

export const pigVsChickGame = {
  type: 'pig-vs-chick',
  lobby: {
    name: 'Pig vs Chick',
    icon: '🐷⚔️🐔',
    badge: '2 Players',
  },
  Scene: PigVsChickScene,
  applyConfig: applyServerConfig,

  // Build game-specific HUD, return updater object
  createHUD(overlay, data, network) {
    const config = GAME_CONFIG;
    const isBottom = data.yourDirection === 1;
    const mySide = isBottom ? data.p1Side : data.p2Side;
    const oppSide = isBottom ? data.p2Side : data.p1Side;
    const myIcon = mySide === 'pig' ? '🐷' : '🐔';
    const oppIcon = oppSide === 'pig' ? '🐷' : '🐔';

    // Top HP bar (opponent)
    const topBar = document.createElement('div');
    topBar.className = 'hp-bar-top';
    topBar.innerHTML = `
      <div class="hp-avatar">${oppIcon}</div>
      <div class="hp-bar-wrapper">
        <div class="hp-bar-bg">
          <div class="hp-bar-fill hp-fill-opponent" id="hp-fill-top" style="width:100%"></div>
        </div>
        <div class="hp-text" id="hp-text-top">100</div>
      </div>
    `;
    overlay.appendChild(topBar);

    // Bottom HP bar (me)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hp-bar-bottom';
    bottomBar.innerHTML = `
      <div class="hp-avatar">${myIcon}</div>
      <div class="hp-bar-wrapper">
        <div class="hp-bar-bg">
          <div class="hp-bar-fill hp-fill-me" id="hp-fill-bottom" style="width:100%"></div>
        </div>
        <div class="hp-text" id="hp-text-bottom">100</div>
      </div>
    `;
    overlay.appendChild(bottomBar);

    // Left-side spawn buttons
    const spawnPanel = document.createElement('div');
    spawnPanel.className = 'spawn-panel';
    spawnPanel.id = 'spawn-panel';

    config.UNITS.forEach((unit, i) => {
      const icon = mySide === 'pig' ? unit.pigIcon : unit.chickenIcon;
      const btn = document.createElement('div');
      btn.className = 'spawn-btn-circle';
      btn.dataset.tier = i + 1;
      btn.innerHTML = `
        <div class="spawn-circle-icon">${icon}</div>
        <div class="spawn-circle-cost">${unit.cost}</div>
      `;
      btn.addEventListener('click', () => {
        if (!btn.classList.contains('disabled')) {
          const lane = Math.floor(Math.random() * config.NUM_LANES);
          network.spawnUnit(i + 1, lane);
        }
      });
      spawnPanel.appendChild(btn);
    });
    overlay.appendChild(spawnPanel);

    // Energy display
    const energyDisplay = document.createElement('div');
    energyDisplay.className = 'energy-display';
    energyDisplay.id = 'energy-display';
    energyDisplay.innerHTML = `<span class="energy-coin">⚡</span><span id="energy-value">0</span>`;
    overlay.appendChild(energyDisplay);

    // Return HUD updater
    return {
      updateHP(playerHP, playerId) {
        const myHP = playerHP[playerId] || 0;
        const oppId = Object.keys(playerHP).find((id) => id !== playerId);
        const oppHP = oppId ? playerHP[oppId] : 0;
        const maxHP = config.PLAYER_HP;

        const fillTop = document.getElementById('hp-fill-top');
        const textTop = document.getElementById('hp-text-top');
        const fillBottom = document.getElementById('hp-fill-bottom');
        const textBottom = document.getElementById('hp-text-bottom');

        if (fillTop) fillTop.style.width = `${(oppHP / maxHP) * 100}%`;
        if (textTop) textTop.textContent = Math.ceil(oppHP);
        if (fillBottom) fillBottom.style.width = `${(myHP / maxHP) * 100}%`;
        if (textBottom) textBottom.textContent = Math.ceil(myHP);
      },

      updateEnergy(current) {
        const el = document.getElementById('energy-value');
        if (el) el.textContent = Math.floor(current);
      },

      updateSpawnButtons(energy) {
        const buttons = document.querySelectorAll('.spawn-btn-circle');
        config.UNITS.forEach((unit, i) => {
          if (buttons[i]) {
            if (energy < unit.cost) {
              buttons[i].classList.add('disabled');
            } else {
              buttons[i].classList.remove('disabled');
            }
          }
        });
      },
    };
  },
};
