import { MemoryMatchScene } from './MemoryMatchScene.js';
import { GAME_CONFIG, applyServerConfig, MEMORY_PACK_CHOICES } from './config.js';

export const memoryMatchGame = {
  type: 'memory-match',
  lobby: {
    name: 'Memory Match',
    icon: '💕🃏',
    badge: 'Couple Edition',
  },
  Scene: MemoryMatchScene,
  applyConfig: applyServerConfig,

  createHUD(overlay, data, network) {
    const packId = data.memoryRoom?.packId || GAME_CONFIG.defaultPack || 'nickname';
    const grid = data.memoryRoom?.gridSize || 4;
    const speed = data.memoryRoom?.speedMode ? 'On' : 'Off';
    const packMeta = GAME_CONFIG.packs?.find((p) => p.id === packId);

    const bar = document.createElement('div');
    bar.className = 'memory-hud';
    bar.innerHTML = `
      <div class="memory-hud-row">
        <div class="memory-hud-scores">
          <span>You <strong id="mem-my-pairs">0</strong></span>
          <span class="memory-hud-dot">·</span>
          <span>Sayang <strong id="mem-opp-pairs">0</strong></span>
        </div>
        <div id="mem-timer" class="memory-hud-timer" style="display:none">⏱ 0s</div>
      </div>
      <div id="mem-turn" class="memory-hud-turn mem-turn-mine">Your turn ✨</div>
      <div class="memory-hud-meta">
        <span>${packMeta?.emoji || '💕'} ${packMeta?.label || 'Memory'}</span>
        <span class="memory-hud-dot">·</span>
        <span>${grid}×${grid}</span>
        <span class="memory-hud-dot">·</span>
        <span>Speed ${speed}</span>
        <span class="memory-hud-dot">·</span>
        <span id="mem-progress">0 / 0 pairs</span>
      </div>
    `;
    overlay.appendChild(bar);

    return {
      destroy() {
        bar.remove();
      },
    };
  },
};

export { MEMORY_PACK_CHOICES };
