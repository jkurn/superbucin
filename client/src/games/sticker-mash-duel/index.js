import { StickerMashDuelScene } from './StickerMashDuelScene.js';
import { applyServerConfig } from './config.js';

export const stickerMashDuelGame = {
  type: 'sticker-mash-duel',
  lobby: {
    name: 'Sticker Duel',
    icon: '🏷️⚡',
    badge: 'Fast tap duel',
  },
  victoryMessages: {
    win: ['Mash monster. High score secured!'],
    lose: ['So close. One more round and you got this.'],
    draw: ['Exact tie! Same mashing rhythm.'],
  },
  Scene: StickerMashDuelScene,
  applyConfig: applyServerConfig,
  createHUD() {
    return {
      destroy() {},
    };
  },
};
