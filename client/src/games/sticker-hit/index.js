/** @typedef {import('../../shared/GameTypes.js').GameDefinition} GameDefinition */

import { EventBus } from '../../shared/EventBus.js';
import { StickerHitScene } from './StickerHitScene.js';
import { applyServerConfig } from './config.js';
import { isStickerHitKnifeFocusMode } from './knifeFocusMode.js';

/** @type {GameDefinition} */
export const stickerHitGame = {
  type: 'sticker-hit',
  lobby: {
    name: 'Sticker Hit',
    icon: '🏷️🎯',
    badge: 'Knife-style timing · 1v1',
  },
  victoryMessages: {
    win: [
      'Clean hits — knife timing mastered! ✨',
      'You found the gaps; cleared first.',
      'You cleared faster, sayang~',
    ],
    lose: [
      'Landed on a blade — try the next gap.',
      'So close! Next run wins.',
      'Timing was off by a blink~',
    ],
    draw: [
      'Photo finish tie! 🤝',
      'Both of you stuck the rhythm.',
    ],
  },
  Scene: StickerHitScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, _data, _network) {
    const hud = document.createElement('div');
    hud.className = 'sh-hud';
    if (isStickerHitKnifeFocusMode()) hud.setAttribute('data-knife-focus', 'true');
    hud.innerHTML = `
      <div class="sh-hud-row">
        <span class="sh-pill">You: <strong id="sh-hud-you">0/0</strong></span>
        <span class="sh-pill">Sayang: <strong id="sh-hud-opp">0/0</strong></span>
      </div>
      <div class="sh-hud-row sh-hud-apples">
        <span class="sh-pill">🍎 You: <strong id="sh-hud-apple-you">0</strong></span>
        <span class="sh-pill">🍎 Sayang: <strong id="sh-hud-apple-opp">0</strong></span>
      </div>
      <div class="sh-hud-race">Knife-style: stick in empty rim slots (judged on landing). First through all stages wins. Crash = loss.</div>
      <div class="sh-hud-status" id="sh-hud-status">Tap to throw!</div>
    `;
    overlay.appendChild(hud);

    const onState = (state) => {
      const total = state.totalStages || 0;
      const myStage = (state.you?.stageIndex ?? 0) + 1;
      const oppStage = (state.opponent?.stageIndex ?? 0) + 1;
      const myCrashed = !!state.you?.crashed;
      const oppCrashed = !!state.opponent?.crashed;
      const myFinished = !!state.you?.finished;
      const oppFinished = !!state.opponent?.finished;

      const myEl = document.getElementById('sh-hud-you');
      const oppEl = document.getElementById('sh-hud-opp');
      const myAppleEl = document.getElementById('sh-hud-apple-you');
      const oppAppleEl = document.getElementById('sh-hud-apple-opp');
      const statusEl = document.getElementById('sh-hud-status');
      if (myEl) myEl.textContent = `${Math.min(myStage, total)}/${total}`;
      if (oppEl) oppEl.textContent = `${Math.min(oppStage, total)}/${total}`;
      const myApples = Number(state.you?.apples);
      const oppApples = Number(state.opponent?.apples);
      if (myAppleEl) myAppleEl.textContent = String(Number.isFinite(myApples) ? myApples : 0);
      if (oppAppleEl) oppAppleEl.textContent = String(Number.isFinite(oppApples) ? oppApples : 0);

      if (!statusEl) return;
      if (state.phase === 'countdown') {
        statusEl.textContent = 'Ready... steady... STICK!';
      } else if (myCrashed) {
        statusEl.textContent = 'You crashed!';
      } else if (oppCrashed) {
        statusEl.textContent = 'Opponent crashed!';
      } else if (myFinished) {
        statusEl.textContent = 'You cleared all stages!';
      } else if (oppFinished) {
        statusEl.textContent = 'Opponent cleared all stages!';
      } else {
        statusEl.textContent = 'Tap or press Space to throw.';
      }
    };

    EventBus.on('sticker-hit:state', onState);
    return {
      destroy() {
        EventBus.off('sticker-hit:state', onState);
        hud.remove();
      },
    };
  },
};

