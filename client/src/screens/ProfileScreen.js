import { AVATARS } from '../shared/ui/constants.js';
import { timeAgo } from '../shared/ui/timeAgo.js';

export async function render(overlay, deps, options) {
  const { userManager, router, showScreen } = deps;

  if (userManager.isGuest) { showScreen('auth'); return; }
  const username = userManager.profile.username;
  if (router && !(options && options.fromRouter)) {
    router.navigate(`/u/${username}`);
  }

  const profile = userManager.profile;

  overlay.innerHTML = `
    <div class="profile-layout">
      <div class="profile-scroll">
        <div class="profile-header">
          <img class="profile-avatar" src="${profile.avatarUrl}" alt="avatar" />
          <div class="profile-name">${userManager.getDisplayLabel()}</div>
          <div class="profile-bio">${profile.bio || 'No bio yet~'}</div>
          <div class="profile-points">${profile.points} points \u2b50</div>
        </div>
        <div class="profile-section-tabs">
          <button class="profile-tab active" data-section="stats">Stats</button>
          <button class="profile-tab" data-section="rivals">Rivals</button>
          <button class="profile-tab" data-section="achievements">Achievements</button>
          <button class="profile-tab" data-section="history">History</button>
          <button class="profile-tab" data-section="settings">Settings</button>
        </div>
        <div class="profile-content" id="profile-content">
          <div class="profile-loading">Loading...</div>
        </div>
      </div>
      <div class="profile-bottom-bar">
        <button class="btn btn-blue btn-small" id="btn-back-lobby-profile">\u2190 Lobby</button>
        <button class="btn btn-small" id="btn-signout" style="background:rgba(255,255,255,0.1);color:#ff6b9d;">Sign Out</button>
      </div>
    </div>
  `;

  bindTabs(overlay, userManager);
  showStatsSection(userManager);

  document.getElementById('btn-back-lobby-profile').addEventListener('click', () => showScreen('lobby'));
  document.getElementById('btn-signout').addEventListener('click', async () => {
    await userManager.signOut();
    showScreen('lobby');
  });
}

function bindTabs(overlay, userManager) {
  overlay.querySelectorAll('.profile-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const section = tab.dataset.section;
      if (section === 'stats') showStatsSection(userManager);
      else if (section === 'rivals') showRivalsSection(userManager);
      else if (section === 'achievements') showAchievementsSection(userManager);
      else if (section === 'history') showHistorySection(userManager);
      else if (section === 'settings') showSettingsSection(userManager);
    });
  });
}

const GAME_NAMES = {
  'pig-vs-chick': '\ud83d\udc37 Pig vs Chick',
  'word-scramble-race': '\ud83d\udcdd Word Scramble',
  'doodle-guess': '\ud83c\udfa8 Doodle Guess',
  'memory-match': '\ud83e\udde0 Memory Match',
  'speed-match': '\u26a1 Speed Match',
  'othello': '\u26ab Othello',
};

async function showStatsSection(userManager) {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="profile-loading">Loading stats...</div>';

  const stats = await userManager.fetchStats();
  if (!stats.length) {
    container.innerHTML = '<div class="profile-empty">No games played yet! Go play some games \ud83c\udfae</div>';
    return;
  }

  const totalWins = stats.reduce((s, x) => s + x.wins, 0);
  const totalGames = stats.reduce((s, x) => s + x.games_played, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  container.innerHTML = `
    <div class="stats-summary">
      <div class="stat-big"><span class="stat-big-num">${totalGames}</span><span class="stat-big-label">Games</span></div>
      <div class="stat-big"><span class="stat-big-num">${totalWins}</span><span class="stat-big-label">Wins</span></div>
      <div class="stat-big"><span class="stat-big-num">${winRate}%</span><span class="stat-big-label">Win Rate</span></div>
    </div>
    <div class="stats-grid">
      ${stats.map((s) => `
        <div class="stat-card">
          <div class="stat-card-title">${GAME_NAMES[s.game_type] || s.game_type}</div>
          <div class="stat-card-row"><span>Wins</span><strong>${s.wins}</strong></div>
          <div class="stat-card-row"><span>Losses</span><strong>${s.losses}</strong></div>
          <div class="stat-card-row"><span>Ties</span><strong>${s.ties}</strong></div>
          <div class="stat-card-row"><span>Points</span><strong>${s.total_points}</strong></div>
        </div>
      `).join('')}
    </div>
  `;
}

async function showRivalsSection(userManager) {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="profile-loading">Loading rivals...</div>';

  const rivals = await userManager.fetchHeadToHead();
  if (!rivals.length) {
    container.innerHTML = '<div class="profile-empty">No rivals yet! Play some games first \ud83c\udfae</div>';
    return;
  }

  container.innerHTML = `
    <div class="rivals-list">
      ${rivals.map((r) => {
    const winRate = r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0;
    const barW = winRate;
    const barL = r.total > 0 ? Math.round((r.losses / r.total) * 100) : 0;
    const barT = 100 - barW - barL;
    return `
          <div class="rival-card">
            <div class="rival-header">
              ${r.avatar ? `<img class="rival-avatar" src="${r.avatar}" />` : '<div class="rival-avatar-placeholder">\ud83d\udc64</div>'}
              <div class="rival-info">
                <div class="rival-name">${r.name}</div>
                <div class="rival-record">${r.wins}W \u2013 ${r.losses}L${r.ties > 0 ? ` \u2013 ${r.ties}T` : ''} (${r.total} games)</div>
              </div>
              <div class="rival-winrate ${winRate >= 50 ? 'positive' : 'negative'}">${winRate}%</div>
            </div>
            <div class="rival-bar">
              <div class="rival-bar-win" style="width:${barW}%"></div>
              <div class="rival-bar-tie" style="width:${barT}%"></div>
              <div class="rival-bar-loss" style="width:${barL}%"></div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

async function showAchievementsSection(userManager) {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="profile-loading">Loading achievements...</div>';

  const { all, earned } = await userManager.fetchAchievements();
  const earnedIds = new Set(earned.map((e) => e.achievement_id));

  container.innerHTML = `
    <div class="achievements-grid">
      ${all.map((ach) => {
    const isEarned = earnedIds.has(ach.id);
    return `
          <div class="achievement-card ${isEarned ? 'earned' : 'locked'}">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
              <div class="achievement-name">${ach.name}</div>
              <div class="achievement-desc">${ach.description}</div>
            </div>
            ${isEarned ? '<div class="achievement-check">\u2713</div>' : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;
}

async function showHistorySection(userManager) {
  const container = document.getElementById('profile-content');
  container.innerHTML = '<div class="profile-loading">Loading match history...</div>';

  const matches = await userManager.fetchMatchHistory();
  if (!matches.length) {
    container.innerHTML = '<div class="profile-empty">No match history yet!</div>';
    return;
  }

  const myId = userManager.profile.id;
  const gameIcons = {
    'pig-vs-chick': '\ud83d\udc37', 'word-scramble-race': '\ud83d\udcdd',
    'doodle-guess': '\ud83c\udfa8', 'memory-match': '\ud83e\udde0',
    'speed-match': '\u26a1', 'othello': '\u26ab',
  };

  container.innerHTML = `
    <div class="history-list">
      ${matches.map((m) => {
    const isP1 = m.player1_id === myId;
    const myScore = isP1 ? m.player1_score : m.player2_score;
    const oppScore = isP1 ? m.player2_score : m.player1_score;
    const oppName = isP1 ? m.player2_name : m.player1_name;
    const oppAvatar = isP1 ? m.player2_avatar : m.player1_avatar;
    const won = m.winner_id === myId;
    const tie = m.is_tie;
    const result = tie ? 'TIE' : won ? 'WIN' : 'LOSS';
    const resultClass = tie ? 'tie' : won ? 'win' : 'loss';
    const ago = timeAgo(m.played_at);
    return `
            <div class="history-item">
              <div class="history-game">${gameIcons[m.game_type] || '\ud83c\udfae'}</div>
              <div class="history-opp">
                ${oppAvatar ? `<img class="history-opp-avatar" src="${oppAvatar}" />` : '<div class="history-opp-avatar-placeholder">\ud83d\udc64</div>'}
                <span>${oppName}</span>
              </div>
              <div class="history-score">${myScore} \u2013 ${oppScore}</div>
              <div class="history-result ${resultClass}">${result}</div>
              <div class="history-time">${ago}</div>
            </div>
          `;
  }).join('')}
    </div>
  `;
}

function showSettingsSection(userManager) {
  const container = document.getElementById('profile-content');
  const profile = userManager.profile;

  container.innerHTML = `
    <div class="settings-form">
      <label class="settings-label">Display Name</label>
      <input class="auth-input" id="setting-display" value="${profile.displayName}" maxlength="30" />
      <label class="settings-label">Bio</label>
      <textarea class="auth-input" id="setting-bio" rows="3" maxlength="200" placeholder="Tell us about yourself~">${profile.bio || ''}</textarea>
      <label class="settings-label">Avatar</label>
      <div class="avatar-picker-grid">
        ${AVATARS.map((a) => `<img class="avatar-pick-item ${profile.avatarUrl === `/avatars/${a}.png` ? 'selected' : ''}" src="/avatars/${a}.png" data-avatar="/avatars/${a}.png" />`).join('')}
      </div>
      <button class="btn btn-pink btn-small" id="btn-save-settings" style="margin-top:0.75rem;">Save Changes</button>
      <div id="settings-msg" class="auth-error" style="color:#7dffb3;"></div>
    </div>
  `;

  let selectedAvatar = profile.avatarUrl;
  const picks = container.querySelectorAll('.avatar-pick-item');
  picks.forEach((img) => {
    img.addEventListener('click', () => {
      picks.forEach((p) => p.classList.remove('selected'));
      img.classList.add('selected');
      selectedAvatar = img.dataset.avatar;
    });
  });

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const msgEl = document.getElementById('settings-msg');
    try {
      await userManager.updateProfile({
        displayName: document.getElementById('setting-display').value.trim(),
        bio: document.getElementById('setting-bio').value.trim(),
        avatarUrl: selectedAvatar,
      });
      msgEl.textContent = 'Saved! \ud83d\udc95';
      setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2000);
    } catch (e) {
      msgEl.style.color = '#ff6b9d';
      msgEl.textContent = e.message || 'Save failed';
    }
  });
}
