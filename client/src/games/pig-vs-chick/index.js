// Pig vs Chick — game module registration
// Exports everything needed for GameRegistry

import { PigVsChickScene } from './PigVsChickScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

export const pigVsChickGame = {
  type: 'pig-vs-chick',
  lobby: {
    name: 'Pig vs Chick',
    icon: '🐷⚔️🐔',
    badge: '2 Players',
    sides: [
      { id: 'pig', label: 'Pig', emoji: '🐷' },
      { id: 'chicken', label: 'Chicken', emoji: '🐔' },
    ],
  },
  victoryMessages: {
    win: ['SAYANG MENANG! 🤣🤣🤣', 'GG sayang~ kamu hebat!', 'LUCU BANGET menangnya! 💕'],
    lose: ['Yahhh kalah~ 😭', 'Nanti revenge ya say!', 'GG sayang~ next time!'],
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

    let selectedTier = null;

    config.UNITS.forEach((unit, i) => {
      const tier = i + 1;
      const icon = mySide === 'pig' ? unit.pigIcon : unit.chickenIcon;
      const dmg = config.BASE_DAMAGE ? config.BASE_DAMAGE[i] : '';
      const btn = document.createElement('div');
      btn.className = 'spawn-btn-circle';
      btn.dataset.tier = tier;
      btn.innerHTML = `
        <div class="spawn-circle-icon">${icon}</div>
        <div class="spawn-circle-cost">${unit.cost}</div>
        <div class="spawn-circle-power">${dmg}</div>
      `;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        // Toggle selection
        if (selectedTier === tier) {
          selectedTier = null;
          btn.classList.remove('selected');
        } else {
          // Deselect previous
          spawnPanel.querySelectorAll('.spawn-btn-circle').forEach((b) => b.classList.remove('selected'));
          selectedTier = tier;
          btn.classList.add('selected');
        }
      });
      spawnPanel.appendChild(btn);
    });
    overlay.appendChild(spawnPanel);

    // Listen for lane taps from the 3D scene raycaster
    const onLaneTap = (lane) => {
      if (selectedTier === null) return;
      const tierBtn = spawnPanel.querySelector(`.spawn-btn-circle[data-tier="${selectedTier}"]`);
      if (tierBtn && tierBtn.classList.contains('disabled')) return;
      network.spawnUnit(selectedTier, lane);
    };
    EventBus.on('lane:tapped', onLaneTap);

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
              // Auto-deselect if selected tier becomes unaffordable
              if (selectedTier === i + 1) {
                selectedTier = null;
                buttons[i].classList.remove('selected');
              }
            } else {
              buttons[i].classList.remove('disabled');
            }
          }
        });
      },

      destroy() {
        EventBus.off('lane:tapped', onLaneTap);
      },
    };
  },
};
