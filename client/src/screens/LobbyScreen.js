import { GameRegistry } from '../shared/GameRegistry.js';
import { MEMORY_PACK_CHOICES } from '../games/memory-match/config.js';
import { renderUserBar, bindUserBar } from '../shared/ui/UserBar.js';

export function render(overlay, deps, options) {
  const { network, userManager, router, showScreen } = deps;

  if (router && !(options && options.fromRouter)) {
    router.navigate('/');
  }

  const registered = GameRegistry.list();
  const cardsHTML = registered.map((g, i) => `
    <div class="game-card${i === 0 ? ' active' : ''}" data-game-type="${g.type}">
      <div class="game-card-icon">${g.icon}</div>
      <div class="game-card-title">${g.name}</div>
      <div class="game-card-badge">${g.badge}</div>
    </div>
  `).join('');

  const padHTML = Array(1).fill(`
    <div class="game-card disabled">
      <div class="game-card-icon">\ud83d\udd12</div>
      <div class="game-card-title">Coming Soon</div>
      <div class="game-card-badge">???</div>
    </div>
  `).join('');

  const packOptionsHtml = MEMORY_PACK_CHOICES.map(
    (p) => `<option value="${p.id}">${p.label}</option>`,
  ).join('');

  overlay.innerHTML = `
    ${renderUserBar(userManager)}
    <div class="lobby-ui" style="padding-top:3.5rem;">
      <div class="lobby-title">SUPERBUCIN</div>
      <div class="lobby-subtitle">sayang's game collection \ud83d\udc95</div>
      <div class="game-grid">
        ${cardsHTML}${padHTML}
      </div>
      <div class="game-options-panel" id="game-options-panel" style="display:none;">
        <button class="game-options-toggle" id="game-options-toggle" type="button">
          <span id="game-options-label">Game Options</span>
          <span class="game-options-chevron" id="game-options-chevron">\u203a</span>
        </button>
        <div class="game-options-body" id="game-options-body" style="display:none;">
          <div id="memory-room-options" style="display:none;">
            <div class="game-options-group">
              <label class="game-options-field-label">Card pack</label>
              <select id="memory-pack" class="memory-pack-select">${packOptionsHtml}</select>
            </div>
            <div class="game-options-group">
              <label class="game-options-field-label">Difficulty</label>
              <div class="game-options-pills">
                <label class="game-options-pill"><input type="radio" name="memgrid" value="4" checked /><span>Easy 4\u00d74</span></label>
                <label class="game-options-pill"><input type="radio" name="memgrid" value="6" /><span>Hard 6\u00d76</span></label>
              </div>
            </div>
            <label class="game-options-check"><input type="checkbox" id="memory-speed" /><span>Speed mode (timer)</span></label>
          </div>
          <div id="doodle-custom-wrap" style="display:none;">
            <div class="game-options-group">
              <label class="game-options-field-label">Custom prompts <span style="color:#666;">(optional)</span></label>
              <textarea class="doodle-custom-textarea" id="doodle-custom-prompts" placeholder="Inside jokes, memories, nicknames\u2026 one per line" rows="3" maxlength="8000"></textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="room-section">
        <button class="btn btn-pink" id="btn-create">Create Room</button>
        <div class="or-divider">\u2014 or \u2014</div>
        <input class="room-code-input" id="input-code" placeholder="Enter code" maxlength="4" />
        <button class="btn btn-blue btn-small" id="btn-join">Join Room</button>
      </div>
    </div>
  `;

  bindUserBar(userManager, { showScreen });

  let selectedGameType = registered[0]?.type || 'pig-vs-chick';
  const optionsPanel = document.getElementById('game-options-panel');
  const optionsToggle = document.getElementById('game-options-toggle');
  const optionsBody = document.getElementById('game-options-body');
  const optionsChevron = document.getElementById('game-options-chevron');
  const optionsLabel = document.getElementById('game-options-label');
  const customWrap = document.getElementById('doodle-custom-wrap');
  const memOpts = document.getElementById('memory-room-options');
  let optionsOpen = false;

  const GAME_OPTION_LABELS = {
    'memory-match': 'Memory Match Options',
    'doodle-guess': 'Doodle Options',
  };

  optionsToggle.addEventListener('click', () => {
    optionsOpen = !optionsOpen;
    optionsBody.style.display = optionsOpen ? 'block' : 'none';
    optionsChevron.classList.toggle('open', optionsOpen);
  });

  const syncGameOptionPanels = () => {
    const hasOptions = selectedGameType === 'doodle-guess' || selectedGameType === 'memory-match';
    optionsPanel.style.display = hasOptions ? 'block' : 'none';
    optionsLabel.textContent = GAME_OPTION_LABELS[selectedGameType] || 'Game Options';
    if (customWrap) customWrap.style.display = selectedGameType === 'doodle-guess' ? 'block' : 'none';
    if (memOpts) memOpts.style.display = selectedGameType === 'memory-match' ? 'block' : 'none';
    if (!hasOptions) {
      optionsOpen = false;
      optionsBody.style.display = 'none';
      optionsChevron.classList.remove('open');
    }
  };

  overlay.querySelectorAll('.game-card[data-game-type]').forEach((card) => {
    card.addEventListener('click', () => {
      overlay.querySelectorAll('.game-card[data-game-type]').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      selectedGameType = card.dataset.gameType;
      syncGameOptionPanels();
    });
  });
  syncGameOptionPanels();

  document.getElementById('btn-create').addEventListener('click', () => {
    let customPrompts;
    if (selectedGameType === 'doodle-guess') {
      const raw = document.getElementById('doodle-custom-prompts')?.value || '';
      customPrompts = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    }
    if (selectedGameType === 'memory-match') {
      const packId = document.getElementById('memory-pack')?.value || 'nickname';
      const gridEl = overlay.querySelector('input[name="memgrid"]:checked');
      const gridSize = gridEl ? Number(gridEl.value) : 4;
      const speedMode = !!document.getElementById('memory-speed')?.checked;
      network.createRoom({
        gameType: 'memory-match',
        packId,
        gridSize,
        speedMode,
      });
    } else {
      network.createRoom(selectedGameType, customPrompts);
    }
  });
  document.getElementById('btn-join').addEventListener('click', () => {
    const code = document.getElementById('input-code').value.trim();
    if (code.length === 4) network.joinRoom(code);
  });
  document.getElementById('input-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
  });
}
