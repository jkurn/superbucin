import { VICTORY_POOL_WINNER, QUOTES, recordMatchResult } from '../shared/StickerPack.js';

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
      ${pointsHtml}
      ${loserQuoteHtml}
      <button class="btn btn-pink" id="btn-rematch">Play Again \ud83d\udc95</button>
      <button class="btn btn-blue btn-small" id="btn-lobby" style="margin-top:0.75rem;">Back to Lobby</button>
    </div>
  `;
  document.getElementById('btn-rematch').addEventListener('click', () => network.requestRematch());
  document.getElementById('btn-lobby').addEventListener('click', () => showScreen('lobby'));

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
