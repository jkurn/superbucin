import { VICTORY_POOL_WINNER, QUOTES, recordMatchResult } from '../shared/StickerPack.js';
import { captureEvent } from '../shared/analytics.js';

export function render(overlay, deps, data) {
  const { network, userManager, showScreen } = deps;

  recordMatchResult(!data.tie && data.isWinner);

  const myProfile = userManager.profile;
  const opp = network.opponentIdentity;

  let msg;
  let sub;
  if (data.tie) {
    msg = 'Seri! \ud83e\udd1d';
    const ys = data.yourScore ?? data.p1Score ?? 0;
    const os = data.oppScore ?? data.p2Score ?? 0;
    sub = `${ys} \u2014 ${os}`;
  } else {
    const isWinner = data.isWinner;
    const messages = isWinner
      ? ['SAYANG MENANG! \ud83e\udd23\ud83e\udd23\ud83e\udd23', 'GG sayang~ kamu hebat!', 'LUCU BANGET menangnya! \ud83d\udc95']
      : ['Yahhh kalah~ \ud83d\ude2d', 'Nanti revenge ya say!', 'GG sayang~ next time!'];
    msg = messages[Math.floor(Math.random() * messages.length)];
    const scoreSum = (data.yourScore ?? 0) + (data.oppScore ?? 0);
    if (scoreSum > 0) {
      sub = `${isWinner ? 'You won!' : 'Better luck next time~'} \u00b7 ${data.yourScore} \u2014 ${data.oppScore}`;
    } else {
      sub = isWinner ? 'You won!' : 'Better luck next time~';
    }
  }

  const pointsEarned = data.pointsEarned || 0;
  const pointsHtml = pointsEarned > 0
    ? `<div class="victory-points">+${pointsEarned} points \u2b50</div>`
    : '';

  const isWinner = !data.tie && data.isWinner;
  const gameType = network.roomGameType || 'unknown';
  const bucinCategory = _deriveBucinCategory(data, pointsEarned);
  const resultOutcome = data.tie ? 'tie' : (isWinner ? 'win' : 'loss');
  const shareUrl = `${window.location.origin}/?challenge=${encodeURIComponent(bucinCategory)}&game=${encodeURIComponent(gameType)}`;
  const shareTitle = 'SUPERBUCIN';
  const shareText = `Aku dapat "${bucinCategory}" di SUPERBUCIN (${resultOutcome}). Coba lawan aku yaa 💕`;
  const hasNativeShare = typeof navigator.share === 'function';
  captureEvent('result_viewed', {
    game_type: gameType,
    result_outcome: resultOutcome,
    bucin_category: bucinCategory,
    points_earned: pointsEarned,
    your_score: data.yourScore ?? data.p1Score ?? 0,
    opp_score: data.oppScore ?? data.p2Score ?? 0,
  });
  const loserQuoteHtml = !isWinner && !data.tie
    ? `<div class="victory-loser-quote">${QUOTES.tanganBerat}</div>`
    : '';

  overlay.innerHTML = `
    <div class="victory-overlay" style="position:relative;">
      <div class="victory-sticker-rain" id="sticker-rain"></div>
      <div class="victory-players">
        <div class="victory-player">
          <img class="victory-avatar" src="${myProfile.avatarUrl}" />
          <span>${userManager.getDisplayLabel()}</span>
        </div>
        <span class="victory-vs">VS</span>
        <div class="victory-player">
          <img class="victory-avatar" src="${opp?.avatarUrl || '/avatars/panda.png'}" />
          <span>${opp?.displayName || 'Player 2'}</span>
        </div>
      </div>
      <div class="victory-text">${msg}</div>
      <div class="victory-sub">${sub}</div>
      <div class="victory-sub" style="margin-top:0.45rem;">Bucin level: <strong>${bucinCategory}</strong></div>
      ${pointsHtml}
      ${loserQuoteHtml}
      <div class="share-link-section" style="margin-top:1rem;max-width:360px;margin-left:auto;margin-right:auto;">
        <input class="share-link-input" id="result-share-link" value="${shareUrl}" readonly onclick="this.select()" />
        <div class="share-btn-row">
          <button class="btn btn-pink btn-share-action" id="btn-share-whatsapp">WhatsApp</button>
          <button class="btn btn-blue btn-small btn-share-action" id="btn-share-x">X</button>
          <button class="btn btn-blue btn-small btn-share-action" id="btn-share-copy">Copy</button>
          <button
            class="btn btn-blue btn-small btn-share-action"
            id="btn-share-native"
            ${hasNativeShare ? '' : 'disabled aria-disabled="true" title="Native share is not supported on this browser"'}
          >
            Share
          </button>
        </div>
        <div class="share-link-feedback" id="result-share-feedback"></div>
      </div>
      <button class="btn btn-pink" id="btn-rematch">Play Again \ud83d\udc95</button>
      <button class="btn btn-blue btn-small" id="btn-lobby" style="margin-top:0.75rem;">Back to Lobby</button>
    </div>
  `;
  document.getElementById('btn-rematch').addEventListener('click', () => network.requestRematch());
  document.getElementById('btn-lobby').addEventListener('click', () => showScreen('lobby'));
  _bindResultShareActions({
    shareTitle,
    shareText,
    shareUrl,
    gameType,
    bucinCategory,
    resultOutcome,
  });

  // Sticker rain on win (skip on tie or loss)
  if (isWinner) {
    const pool = VICTORY_POOL_WINNER;
    _launchStickerRain(document.getElementById('sticker-rain'), pool);
  }
}

/**
 * Spawns sticker rain into the given container.
 * Each sticker falls at a random horizontal position with randomised
 * duration and rotation so they never look mechanical.
 */
function _launchStickerRain(container, pool) {
  if (!container) return;
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const delay = i * 0.3 + Math.random() * 0.2;
    const src   = pool[i % pool.length];
    const left  = 5 + Math.random() * 82; // 5–87 vw
    const rot   = (Math.random() * 40 - 20).toFixed(1); // -20..+20 deg
    const dur   = (2.2 + Math.random() * 1.2).toFixed(2); // 2.2–3.4 s
    const size  = 70 + Math.floor(Math.random() * 36); // 70–105 px

    const img = document.createElement('img');
    img.src   = src;
    img.alt   = '';
    img.className = 'sticker sticker-rain';
    img.style.cssText = [
      `left:${left}%`,
      `width:${size}px`,
      `--rain-rot:${rot}deg`,
      `--rain-dur:${dur}s`,
      `animation-delay:${delay}s`,
    ].join(';');
    container.appendChild(img);
  }
}

function _deriveBucinCategory(data, pointsEarned) {
  if (data.tie) return 'Bucin Seimbang';
  if (data.isWinner && pointsEarned >= 15) return 'Bucin Akut';
  if (data.isWinner) return 'Bucin Solid';
  return 'Bucin Bangkit';
}

function _bindResultShareActions(payload) {
  const feedback = document.getElementById('result-share-feedback');
  const { shareTitle, shareText, shareUrl, gameType, bucinCategory, resultOutcome } = payload;

  const trackShareClicked = (platform) => {
    captureEvent('share_clicked', {
      share_platform: platform,
      share_context: 'result',
      game_type: gameType,
      bucin_category: bucinCategory,
      result_outcome: resultOutcome,
    });
  };

  const trackShareFailed = (platform, errorCode) => {
    captureEvent('share_failed', {
      share_platform: platform,
      share_context: 'result',
      game_type: gameType,
      bucin_category: bucinCategory,
      result_outcome: resultOutcome,
      error_code: errorCode || 'unknown',
    });
  };

  document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => {
    trackShareClicked('whatsapp');
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    _showFeedback(feedback, 'Opened WhatsApp share 💕');
  });

  document.getElementById('btn-share-x')?.addEventListener('click', () => {
    trackShareClicked('x');
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    _showFeedback(feedback, 'Opened X share');
  });

  document.getElementById('btn-share-copy')?.addEventListener('click', async () => {
    trackShareClicked('copy_link');
    const text = `${shareText}\n${shareUrl}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.getElementById('result-share-link');
        if (input) {
          input.select();
          document.execCommand('copy');
        } else {
          throw new Error('copy-input-missing');
        }
      }
      _showFeedback(feedback, 'Copied result link! 💕');
    } catch (err) {
      trackShareFailed('copy_link', err?.name || 'copy_failed');
      _showFeedback(feedback, 'Could not copy link');
    }
  });

  document.getElementById('btn-share-native')?.addEventListener('click', async () => {
    trackShareClicked('native');
    if (typeof navigator.share !== 'function') {
      trackShareFailed('native', 'unsupported');
      _showFeedback(feedback, 'Native share not supported on this browser');
      return;
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      _showFeedback(feedback, 'Shared! 💕');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        trackShareFailed('native', err?.name || 'native_share_failed');
        _showFeedback(feedback, 'Could not open share sheet');
      }
    }
  });
}

function _showFeedback(el, text) {
  if (!el) return;
  el.textContent = text;
  setTimeout(() => {
    if (el) el.textContent = '';
  }, 2200);
}
