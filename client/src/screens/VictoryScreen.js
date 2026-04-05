export function render(overlay, deps, data) {
  const { network, userManager, showScreen } = deps;

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

  overlay.innerHTML = `
    <div class="victory-overlay">
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
      <button class="btn btn-pink" id="btn-rematch">Play Again \ud83d\udc95</button>
      <button class="btn btn-blue btn-small" id="btn-lobby" style="margin-top:0.75rem;">Back to Lobby</button>
    </div>
  `;
  document.getElementById('btn-rematch').addEventListener('click', () => network.requestRematch());
  document.getElementById('btn-lobby').addEventListener('click', () => showScreen('lobby'));
}
