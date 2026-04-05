import { GameRegistry } from '../shared/GameRegistry.js';

export function render(overlay, deps, roomCode) {
  const { network, userManager } = deps;

  const gameType = network.roomGameType || 'pig-vs-chick';
  const game = GameRegistry.get(gameType);
  const ss = game?.sideSelect;
  const title = ss?.title || 'SUPERBUCIN';
  const pickTitle = ss?.pickTitle || 'Pick your side!';
  const options = ss?.options?.length
    ? ss.options
    : [
      { side: 'pig', emoji: '\ud83d\udc37', label: 'Pig' },
      { side: 'chicken', emoji: '\ud83d\udc14', label: 'Chicken' },
    ];

  const opp = network.opponentIdentity;
  const oppSection = opp ? `
    <div class="side-select-players">
      <div class="side-select-player">
        <img class="side-player-avatar" src="${userManager.profile.avatarUrl}" />
        <span>${userManager.getDisplayLabel()}</span>
      </div>
      <span class="side-vs">VS</span>
      <div class="side-select-player">
        <img class="side-player-avatar" src="${opp.avatarUrl || '/avatars/panda.png'}" />
        <span>${opp.displayName || 'Player 2'}</span>
      </div>
    </div>
  ` : '';

  const optionsHtml = options
    .map(
      (o) => `
          <div class="side-option" data-side="${o.side}">
            <div class="emoji">${o.emoji}</div>
            <div class="label">${o.label}</div>
          </div>`,
    )
    .join('');

  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title" style="font-size:1.5rem;">${title}</div>
      <div class="lobby-subtitle">Room: ${roomCode}</div>
      ${oppSection}
      <div class="side-select">
        <h2>${pickTitle}</h2>
        <div class="sides-row">
          ${optionsHtml}
        </div>
        <div id="side-status" class="waiting-text" style="min-height:1.5rem;"></div>
      </div>
    </div>
  `;

  let selectedSide = null;
  document.querySelectorAll('.side-option').forEach((el) => {
    el.addEventListener('click', () => {
      const side = el.dataset.side;
      selectedSide = side;
      document.querySelectorAll('.side-option').forEach((o) => o.classList.remove('selected'));
      el.classList.add('selected');
      network.selectSide(side);
      document.getElementById('side-status').textContent = 'Locked in! Waiting for sayang~';
    });
  });

  // Return handle for UIManager to track selectedSide
  return { getSelectedSide: () => selectedSide };
}

export function updateSideSelect(data, selectedSide) {
  const el = document.getElementById('side-status');
  if (el && data.message) el.textContent = data.message;

  // Auto-highlight remaining side when opponent picks
  if (data.opponentSide && !selectedSide) {
    const options = document.querySelectorAll('.side-option');
    options.forEach((opt) => {
      if (opt.dataset.side !== data.opponentSide) {
        opt.classList.add('suggested');
      }
    });
  }
}
