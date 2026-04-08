import { STICKERS, QUOTES } from '../shared/StickerPack.js';

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
            <button class="btn btn-pink btn-share-action" id="btn-copy-link">\uD83D\uDCCB Copy Link</button>
            <button
              class="btn btn-blue btn-small btn-share-action"
              id="btn-native-share"
              ${hasNativeShare ? '' : 'disabled aria-disabled="true" title="Native share is not supported on this browser"'}
            >
              \uD83D\uDCE4 Share
            </button>
          </div>
          <div class="share-link-feedback" id="share-link-feedback"></div>
        </div>
        <div class="waiting-player-card">
          <img class="waiting-player-avatar" src="${profile.avatarUrl}" alt="avatar" />
          <div class="waiting-player-name">${userManager.getDisplayLabel()}</div>
        </div>
        <div class="waiting-sticker-wrap">
          <img class="waiting-sticker sticker-wiggle" src="${STICKERS.pricyLaughing}" alt="" />
          <div class="waiting-quote">${QUOTES.janganSenyum}</div>
        </div>
        <div class="waiting-text">Waiting for sayang...</div>
        <img class="virtual-hug-sticker sticker-float-slow" src="${STICKERS.virtualHug}" alt="" />
      </div>
    </div>
  `;

  const feedback = document.getElementById('share-link-feedback');

  document.getElementById('btn-copy-link').addEventListener('click', () => {
    _copyToClipboard(shareUrl, feedback);
  });

  const shareBtn = document.getElementById('btn-native-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (typeof navigator.share !== 'function') {
        _showFeedback(feedback, 'Native share not available on this browser');
        return;
      }
      try {
        await navigator.share({
          title: 'SUPERBUCIN',
          text: shareText,
          url: shareUrl,
        });
        _showFeedback(feedback, 'Shared! \uD83D\uDC95');
      } catch (err) {
        if (err.name !== 'AbortError') {
          _showFeedback(feedback, 'Could not open share sheet');
        }
      }
    });
  }
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
