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
      'Tap cepet, reflex kenceng, paddle pro!! \uD83C\uDF89',
      'Gatekeeper terbaik!! 10 catch!! \uD83D\uDEAA\uD83C\uDFC6',
      'Virusmu terlalu ganas!! \uD83E\uDDA0\uD83E\uDDE0\uD83D\uDCAB',
      'Quick Draw champion!! \u26A1\uD83C\uDFC6',
    ],
    lose: [
      'Yahhh virus kamu kalah~ \uD83E\uDDA0\uD83D\uDE2D',
      'Paddle-nya kurang cepet nih sayang \uD83C\uDFD3',
      'False start!! Duluan dong\u2026 \uD83D\uDE31',
      'Virusnya kekecilan~ tap lebih cepet! \uD83E\uDDA0',
      'GG sayang! Rematch?? \uD83E\uDD7A\uD83D\uDC96',
      'Gatenya salah buka sayang~ \uD83D\uDEAA',
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
