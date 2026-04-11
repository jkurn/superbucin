import { fetchPublicProfile } from './publicProfileFetch.js';

export async function render(overlay, deps, username) {
  const { userManager, showScreen } = deps;

  // If viewing own profile, show the editable version
  const ownUsername = userManager.profile?.username;
  if (!userManager.isGuest && ownUsername && ownUsername === username) {
    showScreen('profile', { fromRouter: true });
    return;
  }

  overlay.innerHTML = `
    <div class="lobby-ui profile-screen">
      <div class="profile-header">
        <div class="profile-loading">Loading profile...</div>
      </div>
    </div>
  `;

  try {
    const result = await fetchPublicProfile(username);
    if (!result.ok && result.kind === 'http') {
      overlay.innerHTML = `
        <div class="lobby-ui profile-screen">
          <div class="profile-header">
            <div class="profile-name">Player not found</div>
            <div class="profile-bio">No player with username "${username}" exists.</div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-blue btn-small" id="btn-back-lobby-pub">\u2190 Back to Lobby</button>
          </div>
        </div>
      `;
      document.getElementById('btn-back-lobby-pub').addEventListener('click', () => showScreen('lobby'));
      return;
    }

    if (!result.ok) {
      overlay.innerHTML = `
        <div class="lobby-ui profile-screen">
          <div class="profile-header">
            <div class="profile-name">Error</div>
            <div class="profile-bio">Could not load profile. Try again later.</div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-blue btn-small" id="btn-back-lobby-pub">\u2190 Back to Lobby</button>
          </div>
        </div>
      `;
      document.getElementById('btn-back-lobby-pub').addEventListener('click', () => showScreen('lobby'));
      return;
    }

    const data = result.data;
    const p = data.profile;
    const stats = data.stats || [];
    const achievements = data.achievements || [];

    const gameNames = {
      'pig-vs-chick': '\ud83d\udc37 Pig vs Chick',
      'word-scramble-race': '\ud83d\udcdd Word Scramble',
      'doodle-guess': '\ud83c\udfa8 Doodle Guess',
      'memory-match': '\ud83e\udde0 Memory Match',
      'sticker-hit': '\ud83c\udff7\ufe0f\ud83c\udfaf Sticker Hit',
    };

    const totalWins = stats.reduce((s, x) => s + (x.wins || 0), 0);
    const totalGames = stats.reduce((s, x) => s + (x.games_played || 0), 0);
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

    const statsHtml = stats.length ? `
      <div class="stats-summary">
        <div class="stat-big"><span class="stat-big-num">${totalGames}</span><span class="stat-big-label">Games</span></div>
        <div class="stat-big"><span class="stat-big-num">${totalWins}</span><span class="stat-big-label">Wins</span></div>
        <div class="stat-big"><span class="stat-big-num">${winRate}%</span><span class="stat-big-label">Win Rate</span></div>
      </div>
      <div class="stats-grid">
        ${stats.map((s) => `
          <div class="stat-card">
            <div class="stat-card-title">${gameNames[s.game_type] || s.game_type}</div>
            <div class="stat-card-row"><span>Wins</span><strong>${s.wins}</strong></div>
            <div class="stat-card-row"><span>Losses</span><strong>${s.losses}</strong></div>
            <div class="stat-card-row"><span>Ties</span><strong>${s.ties}</strong></div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="profile-empty">No games played yet!</div>';

    const achievementsHtml = achievements.length ? `
      <div class="achievements-grid" style="margin-top:1rem;">
        ${achievements.map((ach) => `
          <div class="achievement-card earned">
            <div class="achievement-icon">${ach.icon || '\ud83c\udfc6'}</div>
            <div class="achievement-info">
              <div class="achievement-name">${ach.name}</div>
              <div class="achievement-desc">${ach.description || ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    overlay.innerHTML = `
      <div class="lobby-ui profile-screen">
        <div class="profile-header">
          <img class="profile-avatar" src="${p.avatar_url || '/avatars/panda.png'}" alt="avatar" />
          <div class="profile-name">${p.display_name || p.username}</div>
          <div class="profile-bio">${p.bio || ''}</div>
          <div class="profile-points">${p.points || 0} points \u2b50</div>
        </div>
        ${statsHtml}
        ${achievementsHtml}
        <div class="profile-actions" style="margin-top:1rem;">
          <button class="btn btn-blue btn-small" id="btn-back-lobby-pub">\u2190 Back to Lobby</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back-lobby-pub').addEventListener('click', () => showScreen('lobby'));
  } catch (_err) {
    overlay.innerHTML = `
      <div class="lobby-ui profile-screen">
        <div class="profile-header">
          <div class="profile-name">Error</div>
          <div class="profile-bio">Could not load profile. Try again later.</div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-blue btn-small" id="btn-back-lobby-pub">\u2190 Back to Lobby</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back-lobby-pub').addEventListener('click', () => showScreen('lobby'));
  }
}
