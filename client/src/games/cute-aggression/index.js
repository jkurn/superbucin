/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { CuteAggressionScene } from './CuteAggressionScene.js';
import { applyServerConfig } from './config.js';

/** @type {GameDefinition} */
export const cuteAggressionGame = {
  type: 'cute-aggression',
  lobby: {
    name: 'Cute Aggression',
    icon: '\uD83D\uDE21\uD83E\uDE77\uD83E\uDD0F',
    badge: 'GEMAS!',
    sides: [
      { side: 'merah', label: 'Si Merah', emoji: '\u2764\uFE0F' },
      { side: 'biru', label: 'Si Biru', emoji: '\uD83D\uDC99' },
    ],
  },
  sideSelect: {
    title: 'CUTE AGGRESSION',
    pickTitle: 'Pilih blob kamu sayang~',
    options: [
      { side: 'merah', label: 'Si Merah', emoji: '\uD83D\uDD34' },
      { side: 'biru', label: 'Si Biru', emoji: '\uD83D\uDD35' },
    ],
  },
  victoryMessages: {
    win: [
      'GEMAS BANGET NGGAK KUAT!! \uD83D\uDE24\uD83D\uDC96',
      'CUBIT GIGIT CIUM semuanya!! \uD83E\uDD0F\uD83E\uDE77\uD83D\uDC8B',
      'Nggak kuat gemesnya~ K.O.!! \uD83C\uDFC6\uD83D\uDC95',
      'Terlalu bucin sampe menang!! \uD83E\uDD70\uD83D\uDD25',
      'Kamu bikin lawan meleleh!! \uD83E\uDEE0\uD83D\uDCAB',
      'COMBO GIGIT SAMPE PINGSAN!! \uD83E\uDE77\uD83E\uDE77\uD83E\uDE77',
      'Dicubit sampe sayang~ champion!! \uD83E\uDD0F\uD83C\uDFC6',
    ],
    lose: [
      'Yahhh di-gemasin sampe K.O.~ \uD83D\uDE35\u200D\uD83D\uDCAB',
      'Kena GIGIT CUBIT CIUM semuanya \uD83D\uDE2D',
      'Terlalu gemas buat menang~ \uD83D\uDC94\uD83D\uDC95',
      'GG sayang! Rematch?? \uD83E\uDD7A\uD83D\uDC96',
      'Di-combo gigit sampe lemes~ \uD83E\uDE77\uD83D\uDE35',
      'Kena cium super sampe meleleh \uD83D\uDC8B\uD83E\uDEE0',
    ],
    draw: [
      'DOUBLE K.O. GEMAS!? \uD83E\uDD2F\uD83D\uDC96\uD83D\uDC96',
      'Dua-duanya terlalu bucin!! \uD83E\uDD70\uD83E\uDD70',
    ],
  },
  Scene: CuteAggressionScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, _network) {
    const el = document.createElement('div');
    el.className = 'ca-hud-placeholder';
    overlay.appendChild(el);
    return {
      destroy() { el.remove(); },
    };
  },
};
