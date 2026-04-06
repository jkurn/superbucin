/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { BonkBrawlScene } from './BonkBrawlScene.js';
import { applyServerConfig } from './config.js';

/** @type {GameDefinition} */
export const bonkBrawlGame = {
  type: 'bonk-brawl',
  lobby: {
    name: 'Bonk Brawl',
    icon: '\uD83D\uDC30\uD83D\uDCA5\uD83D\uDC31',
    badge: 'Fighter',
    sides: [
      { side: 'bunny', label: 'Usagi', emoji: '\uD83D\uDC30' },
      { side: 'kitty', label: 'Neko', emoji: '\uD83D\uDC31' },
    ],
  },
  sideSelect: {
    title: 'BONK BRAWL',
    pickTitle: 'Pick your fighter!',
    options: [
      { side: 'bunny', label: 'Usagi', emoji: '\uD83D\uDC30' },
      { side: 'kitty', label: 'Neko', emoji: '\uD83D\uDC31' },
    ],
  },
  victoryMessages: {
    win: [
      'BONK CHAMPION! \uD83D\uDC30\uD83C\uDFC6',
      'K.O.!! Sayang kalah~ \uD83D\uDE0E',
      'Total bonk domination!',
      'The crowd goes wild! \uD83C\uDF89',
    ],
    lose: [
      'Yahhh di-bonk~ \uD83D\uDE35',
      'GG sayang! Rematch??',
      'Bonked into oblivion~ \uD83D\uDCAB',
      'Your fighter needs a nap \uD83D\uDE34',
    ],
    draw: [
      'Double K.O.!? \uD83E\uDD2F',
    ],
  },
  Scene: BonkBrawlScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, _network) {
    // HUD is built into the scene itself, so we just return a no-op
    const el = document.createElement('div');
    el.className = 'bk-hud-placeholder';
    overlay.appendChild(el);
    return {
      destroy() { el.remove(); },
    };
  },
};
