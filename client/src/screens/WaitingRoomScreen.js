export function render(overlay, deps, roomCode) {
  const { userManager, router } = deps;
  if (router) router.replace('/room/' + roomCode);

  const profile = userManager.profile;
  const shareUrl = `${window.location.origin}/room/${roomCode}`;

  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title">SUPERBUCIN</div>
      <div class="lobby-subtitle">Share this code with sayang~</div>
      <div class="room-section">
        <div class="room-code-display">${roomCode}</div>
        <div class="share-link-section">
          <input class="share-link-input" id="share-link-url" value="${shareUrl}" readonly onclick="this.select()" />
          <button class="btn btn-pink btn-small" id="btn-share-link">Share Link</button>
          <div class="share-link-feedback" id="share-link-feedback"></div>
        </div>
        <div class="waiting-player-card">
          <img class="waiting-player-avatar" src="${profile.avatarUrl}" alt="avatar" />
          <div class="waiting-player-name">${userManager.getDisplayLabel()}</div>
        </div>
        <div class="waiting-text">Waiting for player 2...</div>
      </div>
    </div>
  `;

  document.getElementById('btn-share-link').addEventListener('click', () => {
    const urlInput = document.getElementById('share-link-url');
    const feedback = document.getElementById('share-link-feedback');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        feedback.textContent = 'Copied! \ud83d\udc95';
        setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2000);
      }).catch(() => {
        urlInput.select();
        feedback.textContent = 'Select & copy the link above';
        setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2000);
      });
    } else {
      urlInput.select();
      document.execCommand('copy');
      feedback.textContent = 'Copied! \ud83d\udc95';
      setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2000);
    }
  });
}
