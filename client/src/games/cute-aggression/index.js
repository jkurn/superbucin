/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { CuteAggressionScene } from './CuteAggressionScene.js';
import { applyServerConfig } from './config.js';

/** @type {GameDefinition} */
export const cuteAggressionGame = {
  type: 'cute-aggression',
  lobby: {
    name: 'Virus vs Virus',
    icon: '\uD83E\uDDA0\u2694\uFE0F\uD83E\uDDEC',  // 🦠⚔️🧬
    badge: 'GEMAS!!',
    sides: [
      { side: 'merah', label: 'Virus Merah', emoji: '\uD83D\uDD34' },
      { side: 'biru',  label: 'Virus Biru',  emoji: '\uD83D\uDD35' },
    ],
  },
  sideSelect: {
    title: 'VIRUS VS VIRUS',
    pickTitle: 'Pilih virus kamu sayang~ \uD83E\uDDA0',
    options: [
      { side: 'merah', label: 'Virus Merah', emoji: '\uD83D\uDD34' },
      { side: 'biru',  label: 'Virus Biru',  emoji: '\uD83D\uDD35' },
    ],
  },
  victoryMessages: {
    win: [
      'VIRUS KAMU MENANG!! \uD83E\uDDA0\uD83C\uDFC6',
      'INFEKSI TOTAL!! Lawan KO \uD83E\uDDA0\uD83D\uDD25',
      'Tap cepet, otak encer, juara!! \uD83C\uDF89',
      'Virusmu terlalu ganas!! \uD83E\uDDA0\uD83E\uDDE0\uD83D\uDCAB',
      'Speed dan otak = CHAMPION!! \u26A1\uD83C\uDFC6',
      'Si lawan kewalahan~ \uD83D\uDE24\uD83E\uDDA0',
    ],
    lose: [
      'Yahhh virus kamu kalah~ \uD83E\uDDA0\uD83D\uDE2D',
      'Tapnya kurang cepet nih sayang \uD83E\uDDA0',
      'Virusnya kekecilan~ tap lebih cepet! \uD83E\uDDA0',
      'GG sayang! Rematch?? \uD83E\uDD7A\uD83D\uDC96',
      'Otaknya perlu warm up lagi~ \uD83E\uDDE0',
      'Blunder terus sayanggg~ \uD83D\uDE2D',
    ],
    draw: [
      'DRAW?! Dua virus sama kuatnya!! \uD83E\uDDA0\uD83E\uDDA0',
      'Sama-sama ganas!! Rematch!! \uD83D\uDD25\uD83D\uDD25',
    ],
  },
  Scene: CuteAggressionScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, _network) {
    // Scene is fully self-contained — no extra HUD needed.
    const el = document.createElement('div');
    el.className = 'ca-hud-placeholder';
    overlay.appendChild(el);
    return { destroy() { el.remove(); } };
  },
};
