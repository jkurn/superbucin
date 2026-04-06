/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { CuteAggressionScene } from './CuteAggressionScene.js';
import { applyServerConfig } from './config.js';

/** @type {GameDefinition} */
export const cuteAggressionGame = {
  type: 'cute-aggression',
  lobby: {
    name: 'Cute Aggression',
    icon: '\uD83D\uDE21\uD83D\uDC96\uD83E\uDD0F',
    badge: 'Gemas!',
    sides: [
      { side: 'merah', label: 'Si Merah', emoji: '\u2764\uFE0F' },
      { side: 'biru', label: 'Si Biru', emoji: '\uD83D\uDC99' },
    ],
  },
  sideSelect: {
    title: 'CUTE AGGRESSION',
    pickTitle: 'Pilih blob kamu!',
    options: [
      { side: 'merah', label: 'Si Merah', emoji: '\uD83D\uDD34' },
      { side: 'biru', label: 'Si Biru', emoji: '\uD83D\uDD35' },
    ],
  },
  victoryMessages: {
    win: [
      'GEMAS BANGET!! \uD83D\uDE24\uD83D\uDC96',
      'Nggak kuat gemesnya~ kamu menang!!',
      'CUBIT CUBIT CUBIT!! \uD83E\uDD0F\uD83C\uDFC6',
      'Sayang terlalu gemas~ K.O.!! \uD83D\uDC8B',
      'Kamu bikin lawan meleleh!! \uD83E\uDEE0\uD83D\uDC95',
    ],
    lose: [
      'Yahhh di-gemasin~ \uD83D\uDE35',
      'Kena cubit sampe K.O. \uD83D\uDE2D',
      'Terlalu gemas buat menang~ \uD83D\uDC94',
      'GG sayang! Rematch?? \uD83E\uDD7A',
    ],
    draw: [
      'Double K.O. gemas!? \uD83E\uDD2F\uD83D\uDC96',
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
