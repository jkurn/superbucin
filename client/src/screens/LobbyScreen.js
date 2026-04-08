import { GameRegistry } from '../shared/GameRegistry.js';
import { MEMORY_PACK_CHOICES } from '../games/memory-match/config.js';
import { renderUserBar, bindUserBar } from '../shared/ui/UserBar.js';
import { STICKERS, QUOTES } from '../shared/StickerPack.js';

export function render(overlay, deps, options) {
  const { network, userManager, router, showScreen } = deps;

  if (router && !(options && options.fromRouter)) {
    router.navigate('/');
  }

  const registered = GameRegistry.list();
  const cardsHTML = registered.map((g, i) => `
    <button type="button" class="game-card${i === 0 ? ' active' : ''}" data-game-type="${g.type}" aria-label="Select ${g.name}">
      <div class="game-card-icon">${g.icon}</div>
      <div class="game-card-title">${g.name}</div>
      <div class="game-card-badge">${g.badge}</div>
    </button>
  `).join('');

  const padHTML = Array(1).fill(`
    <button type="button" class="game-card disabled" disabled aria-disabled="true">
      <div class="game-card-icon">\ud83d\udd12</div>
      <div class="game-card-title">Coming Soon</div>
      <div class="game-card-badge">???</div>
    </button>
  `).join('');

  const packOptionsHtml = MEMORY_PACK_CHOICES.map(
    (p) => `<option value="${p.id}">${p.label}</option>`,
  ).join('');

  const { isEleven11, lossStreak } = _getBucinMoments();

  overlay.innerHTML = `
    ${renderUserBar(userManager)}
    <div class="lobby-sticker-layer" style="pointer-events:none" aria-hidden="true">
      <img class="sticker sticker-float"
           style="width:72px;top:12%;left:3%;animation-delay:0s;"
           src="${STICKERS.mochiHeart}" alt="" />
      <img class="sticker sticker-float-slow"
           style="width:80px;bottom:22%;right:2%;animation-delay:-1.8s;"
           src="${STICKERS.coupleBlob}" alt="" />
      <img class="sticker sticker-drift"
           style="width:90px;top:5%;animation-delay:-3s;"
           src="${STICKERS.pricyRocket}" alt="" />
      ${lossStreak >= 5 ? `<img class="easter-sign visible" src="${STICKERS.sayangilahPricy}" alt="" />` : ''}
    </div>
    <div class="lobby-ui" style="padding-top:4.25rem;">
      <div class="lobby-title">SUPERBUCIN</div>
      <div class="lobby-quote">${QUOTES.kangenKamu}</div>
      <div class="game-grid">
        ${cardsHTML}${padHTML}
      </div>
      <div class="game-options-panel" id="game-options-panel" style="display:none;" hidden aria-hidden="true" inert>
        <button class="game-options-toggle" id="game-options-toggle" type="button">
          <span id="game-options-label">Game Options</span>
          <span class="game-options-chevron" id="game-options-chevron">\u203a</span>
        </button>
        <div class="game-options-body" id="game-options-body" style="display:none;" hidden aria-hidden="true"></div>
      </div>
      ${isEleven11 ? `<img class="easter-overthinking" src="${STICKERS.overthinking}" alt="" />` : ''}
      <div class="room-section">
        <button class="btn btn-pink" id="btn-create">Create Room</button>
        <div class="or-divider">\u2014 or \u2014</div>
        <input class="room-code-input" id="input-code" placeholder="Enter code" maxlength="4" />
        <button class="btn btn-blue btn-small" id="btn-join">Join Room</button>
        <div id="join-feedback" class="auth-error" role="alert" aria-live="polite"></div>
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
  let optionsOpen = false;

  const GAME_OPTION_LABELS = {
    'memory-match': 'Memory Match Options',
    'doodle-guess': 'Doodle Options',
  };

  optionsToggle.addEventListener('click', () => {
    optionsOpen = !optionsOpen;
    optionsBody.style.display = optionsOpen ? 'block' : 'none';
    optionsBody.hidden = !optionsOpen;
    optionsBody.setAttribute('aria-hidden', String(!optionsOpen));
    optionsChevron.classList.toggle('open', optionsOpen);
  });

  const syncGameOptionPanels = () => {
    const hasOptions = selectedGameType === 'doodle-guess' || selectedGameType === 'memory-match';
    optionsPanel.style.display = hasOptions ? 'block' : 'none';
    optionsPanel.hidden = !hasOptions;
    optionsPanel.setAttribute('aria-hidden', String(!hasOptions));
    if (hasOptions) optionsPanel.removeAttribute('inert');
    else optionsPanel.setAttribute('inert', '');
    optionsLabel.textContent = GAME_OPTION_LABELS[selectedGameType] || 'Game Options';
    if (hasOptions) {
      optionsBody.innerHTML = selectedGameType === 'memory-match'
        ? `
          <div id="memory-room-options">
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
        `
        : `
          <div id="doodle-custom-wrap">
            <div class="game-options-group">
              <label class="game-options-field-label">Custom prompts <span style="color:#666;">(optional)</span></label>
              <textarea class="doodle-custom-textarea" id="doodle-custom-prompts" placeholder="Inside jokes, memories, nicknames\u2026 one per line" rows="3" maxlength="8000"></textarea>
            </div>
          </div>
        `;
    } else {
      optionsBody.innerHTML = '';
    }
    if (!hasOptions) {
      optionsOpen = false;
      optionsBody.style.display = 'none';
      optionsBody.hidden = true;
      optionsBody.setAttribute('aria-hidden', 'true');
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
    const feedbackEl = document.getElementById('join-feedback');
    const code = document.getElementById('input-code').value.trim();
    feedbackEl.textContent = '';
    if (code.length !== 4) {
      feedbackEl.textContent = 'Please enter a 4-character room code';
      return;
    }
    network.joinRoom(code);
  });
  document.getElementById('input-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
  });

  // 11:11 easter egg — show overthinking sticker for 4 seconds
  if (isEleven11) {
    const el = overlay.querySelector('.easter-overthinking');
    if (el) {
      setTimeout(() => { el.classList.add('visible'); }, 300);
      setTimeout(() => { el.classList.remove('visible'); }, 4500);
    }
  }
}

/** Returns bucin moment flags for this session. */
function _getBucinMoments() {
  const now = new Date();
  const isEleven11 = now.getHours() === 11 && now.getMinutes() === 11;
  const lossStreak = Number(localStorage.getItem('superbucin_loss_streak') || 0);
  return { isEleven11, lossStreak };
}

