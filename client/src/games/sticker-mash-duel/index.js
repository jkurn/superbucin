import { StickerMashDuelScene } from './StickerMashDuelScene.js';
import { applyServerConfig } from './config.js';

export const stickerMashDuelGame = {
  type: 'sticker-mash-duel',
  lobby: {
    name: 'Sticker Mash Duel',
    icon: '🏷️⚡',
    badge: 'Countdown + endless tap score race',
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
