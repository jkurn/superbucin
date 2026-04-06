/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { VendingMachineScene } from './VendingMachineScene.js';
import { GAME_CONFIG, applyServerConfig } from './config.js';
import { EventBus } from '../../shared/EventBus.js';

/** @type {GameDefinition} */
export const vendingMachineGame = {
  type: 'vending-machine',
  lobby: {
    name: 'Vending Tycoon',
    icon: '\uD83C\uDF38\uD83E\uDD64',
    badge: 'Strategy',
  },
  victoryMessages: {
    win: [
      'Vending Machine MOGUL! \uD83D\uDCB0\uD83C\uDF38',
      'Your machines reign supreme!',
      'Business genius sayang~ \uD83D\uDE0E',
      'Ka-ching! You won! \uD83C\uDF89',
    ],
    lose: [
      'Yahhh bankrupt~ \uD83D\uDE2D',
      'Maybe next time sayang~',
      'Your rival out-vended you!',
      'The machines have spoken... \uD83D\uDE14',
    ],
    draw: [
      'Equal empires! \uD83E\uDD1D',
      'A tie in the vending world!',
    ],
  },
  Scene: VendingMachineScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, _network) {
    const bar = document.createElement('div');
    bar.className = 'vm-hud';

    // Timer bar
    bar.innerHTML = `
      <div class="vm-timer-bar"><div class="vm-timer-fill" id="vm-timer-fill"></div></div>
    `;
    overlay.appendChild(bar);

    let timerRAF = null;
    let timerEndsAt = null;
    const timerDuration = GAME_CONFIG.turnTimeMs || 20000;

    function updateTimer() {
      const fill = document.getElementById('vm-timer-fill');
      if (!fill || !timerEndsAt) {
        if (fill) fill.style.width = '100%';
        timerRAF = requestAnimationFrame(updateTimer);
        return;
      }
      const remaining = Math.max(0, timerEndsAt - Date.now());
      const pct = (remaining / timerDuration) * 100;
      fill.style.width = `${pct}%`;
      if (pct < 20) {
        fill.classList.add('vm-timer-danger');
      } else {
        fill.classList.remove('vm-timer-danger');
      }
      if (remaining > 0) {
        timerRAF = requestAnimationFrame(updateTimer);
      }
    }

    function onVendingState(state) {
      if (state.timerEndsAt) {
        timerEndsAt = state.timerEndsAt;
      }
    }

    EventBus.on('vending:state', onVendingState);
    timerRAF = requestAnimationFrame(updateTimer);

    return {
      destroy() {
        EventBus.off('vending:state', onVendingState);
        if (timerRAF) cancelAnimationFrame(timerRAF);
        bar.remove();
      },
    };
  },
};
