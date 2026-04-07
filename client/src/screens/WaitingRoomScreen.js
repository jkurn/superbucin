export function render(overlay, deps, roomCode) {
  const { userManager, router } = deps;
  if (router) router.replace('/room/' + roomCode);

  const profile = userManager.profile;
  const shareUrl = `${window.location.origin}/room/${roomCode}`;
  const shareText = 'Join my game on SUPERBUCIN! \uD83D\uDC95\uD83E\uDDA0';
  const hasNativeShare = typeof navigator.share === 'function';

  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title">SUPERBUCIN</div>
      <div class="lobby-subtitle">Share this code with sayang~</div>
      <div class="room-section">
        <div class="room-code-display">${roomCode}</div>
        <div class="share-link-section">
          <input class="share-link-input" id="share-link-url" value="${shareUrl}" readonly onclick="this.select()" />
          <div class="share-btn-row">
            <button class="btn btn-pink" id="btn-share-link">
              ${hasNativeShare ? '\uD83D\uDCE4 Share' : '\uD83D\uDCCB Copy Link'}
            </button>
          </div>
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

  document.getElementById('btn-share-link').addEventListener('click', async () => {
    const feedback = document.getElementById('share-link-feedback');

    // ── Primary: native OS share sheet (mobile) ──────────────────────────
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'SUPERBUCIN',
          text: shareText,
          url: shareUrl,
        });
        if (feedback) { feedback.textContent = 'Shared! \uD83D\uDC95'; }
      } catch (err) {
        // User cancelled share sheet — not an error, just fall through
        if (err.name !== 'AbortError') {
          // Real error: fall back to clipboard
          _copyToClipboard(shareUrl, feedback);
        }
      }
      return;
    }

    // ── Fallback: clipboard copy (desktop / old browsers) ────────────────
    _copyToClipboard(shareUrl, feedback);
  });
}

/** Copy URL to clipboard with user feedback. */
function _copyToClipboard(url, feedbackEl) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      _showFeedback(feedbackEl, 'Copied! \uD83D\uDC95');
    }).catch(() => {
      _selectInput();
      _showFeedback(feedbackEl, 'Select & copy the link above');
    });
  } else {
    _selectInput();
    document.execCommand('copy');
    _showFeedback(feedbackEl, 'Copied! \uD83D\uDC95');
  }
}

function _selectInput() {
  const urlInput = document.getElementById('share-link-url');
  if (urlInput) urlInput.select();
}

function _showFeedback(el, text) {
  if (!el) return;
  el.textContent = text;
  setTimeout(() => { if (el) el.textContent = ''; }, 2500);
}
