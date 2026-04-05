import { GameRegistry } from './GameRegistry.js';
import { MEMORY_PACK_CHOICES } from '../games/memory-match/config.js';

const AVATARS = [
  'bear', 'buffalo', 'chick', 'chicken', 'cow', 'crocodile', 'dog', 'duck',
  'elephant', 'frog', 'giraffe', 'goat', 'gorilla', 'hippo', 'horse', 'monkey',
  'moose', 'narwhal', 'owl', 'panda', 'parrot', 'penguin', 'pig', 'rabbit',
  'rhino', 'sloth', 'snake', 'walrus', 'whale', 'zebra',
];

export class UIManager {
  constructor() {
    this.overlay = null;
    this.network = null;
    this.sceneManager = null;
    this.userManager = null;
    this.gameScene = null;
    this.activeHUD = null;
    this.selectedSide = null;
    this._router = null;
  }

  /** Called by main.js after Router.init() to give UIManager a reference. */
  setRouter(router) {
    this._router = router;
  }

  /**
   * @param {import('./NetworkManager.js').NetworkManager} network
   * @param {import('./SceneManager.js').SceneManager} sceneManager
   * @param {import('./UserManager.js').UserManager} userManager — profile UI, identify payload, history
   */
  init(network, sceneManager, userManager) {
    this.network = network;
    this.sceneManager = sceneManager;
    this.userManager = userManager;
    this.overlay = document.getElementById('ui-overlay');
  }

  clear() {
    this.overlay.innerHTML = '';
  }

  // ==================== USER IDENTITY BAR ====================
  _renderUserBar() {
    const profile = this.userManager.profile;
    const label = this.userManager.getDisplayLabel();
    return `
      <div class="user-bar">
        <div class="user-bar-left" id="user-bar-profile">
          <img class="user-bar-avatar" src="${profile.avatarUrl}" alt="avatar" />
          <div class="user-bar-info">
            <div class="user-bar-name">${label}</div>
            <div class="user-bar-points">${this.userManager.isGuest ? 'Guest' : `${profile.points} pts`}</div>
          </div>
        </div>
        <button class="user-bar-btn" id="user-bar-action">
          ${this.userManager.isGuest ? '🔑 Sign In' : '👤 Profile'}
        </button>
      </div>
    `;
  }

  _bindUserBar() {
    const profileBtn = document.getElementById('user-bar-profile');
    const actionBtn = document.getElementById('user-bar-action');

    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        if (!this.userManager.isGuest) this.showProfile();
      });
    }

    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        if (this.userManager.isGuest) {
          this.showAuthScreen();
        } else {
          this.showProfile();
        }
      });
    }
  }

  // ==================== AUTH SCREEN ====================
  showAuthScreen(options) {
    if (this._router && !(options && options.fromRouter)) {
      this._router.navigate('/auth');
    }
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title" style="font-size:1.8rem;">SIGN IN</div>
        <div class="lobby-subtitle">Save your stats & achievements 💕</div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Log In</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
        </div>

        <div class="auth-form" id="auth-login-form">
          <input class="auth-input" id="auth-email" type="email" placeholder="Email" autocomplete="email" />
          <input class="auth-input" id="auth-password" type="password" placeholder="Password" autocomplete="current-password" />
          <button class="btn btn-pink" id="btn-login">Log In</button>
          <button class="auth-link" id="btn-forgot" type="button">Forgot password?</button>
          <div id="auth-error" class="auth-error"></div>
        </div>

        <div class="auth-form hidden" id="auth-signup-form">
          <input class="auth-input" id="signup-email" type="email" placeholder="Email" autocomplete="email" />
          <input class="auth-input" id="signup-username" type="text" placeholder="Username" autocomplete="username" maxlength="20" />
          <input class="auth-input" id="signup-display" type="text" placeholder="Display Name" maxlength="30" />
          <div class="avatar-picker" id="avatar-picker">
            <div class="avatar-picker-label">Pick your avatar</div>
            <div class="avatar-picker-grid">
              ${AVATARS.map((a) => `<img class="avatar-pick-item" src="/avatars/${a}.png" data-avatar="/avatars/${a}.png" />`).join('')}
            </div>
          </div>
          <input class="auth-input" id="signup-password" type="password" placeholder="Password (min 6 chars)" autocomplete="new-password" />
          <button class="btn btn-pink" id="btn-signup">Create Account</button>
          <div id="signup-error" class="auth-error"></div>
        </div>

        <button class="btn btn-blue btn-small" id="btn-back-lobby" style="margin-top:1rem;">← Back to Lobby</button>
      </div>
    `;

    let selectedAvatar = this.userManager.profile.avatarUrl;
    const picks = this.overlay.querySelectorAll('.avatar-pick-item');
    picks.forEach((img) => {
      if (img.dataset.avatar === selectedAvatar) img.classList.add('selected');
      img.addEventListener('click', () => {
        picks.forEach((p) => p.classList.remove('selected'));
        img.classList.add('selected');
        selectedAvatar = img.dataset.avatar;
      });
    });

    this.overlay.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.overlay.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('auth-login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
        document.getElementById('auth-signup-form').classList.toggle('hidden', tab.dataset.tab !== 'signup');
      });
    });

    document.getElementById('btn-login').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const errEl = document.getElementById('auth-error');
      errEl.textContent = '';
      try {
        await this.userManager.signIn(email, password);
        this.showLobby();
      } catch (e) {
        errEl.textContent = e.message || 'Login failed';
      }
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
      const email = document.getElementById('signup-email').value.trim();
      const username = document.getElementById('signup-username').value.trim();
      const displayName = document.getElementById('signup-display').value.trim() || username;
      const password = document.getElementById('signup-password').value;
      const errEl = document.getElementById('signup-error');
      errEl.textContent = '';

      if (!email || !password) { errEl.textContent = 'Email and password required'; return; }
      if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }
      if (!username) { errEl.textContent = 'Username required'; return; }

      try {
        await this.userManager.signUp(email, password, username, displayName, selectedAvatar);
        this.showLobby();
      } catch (e) {
        errEl.textContent = e.message || 'Signup failed';
      }
    });

    document.getElementById('btn-forgot').addEventListener('click', () => this.showForgotPassword());
    document.getElementById('btn-back-lobby').addEventListener('click', () => this.showLobby());
  }

  // ==================== FORGOT / RESET PASSWORD ====================
  showForgotPassword() {
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title" style="font-size:1.8rem;">RESET PASSWORD</div>
        <div class="lobby-subtitle">Enter your email and we'll send a reset link</div>
        <div class="auth-form">
          <input class="auth-input" id="reset-email" type="email" placeholder="Email" autocomplete="email" />
          <button class="btn btn-pink" id="btn-send-reset">Send Reset Link</button>
          <div id="reset-msg" class="auth-error"></div>
        </div>
        <button class="btn btn-blue btn-small" id="btn-back-auth" style="margin-top:1rem;">← Back to Sign In</button>
      </div>
    `;

    document.getElementById('btn-send-reset').addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const msgEl = document.getElementById('reset-msg');
      msgEl.style.color = '';
      msgEl.textContent = '';

      if (!email) { msgEl.textContent = 'Please enter your email'; return; }

      try {
        await this.userManager.resetPassword(email);
        msgEl.style.color = '#7dffb3';
        msgEl.textContent = 'Reset link sent! Check your email 💕';
        document.getElementById('btn-send-reset').disabled = true;
        document.getElementById('btn-send-reset').textContent = 'Sent!';
      } catch (e) {
        msgEl.textContent = e.message || 'Failed to send reset link';
      }
    });

    document.getElementById('btn-back-auth').addEventListener('click', () => this.showAuthScreen());
  }

  showResetPassword() {
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title" style="font-size:1.8rem;">NEW PASSWORD</div>
        <div class="lobby-subtitle">Pick a new password for your account</div>
        <div class="auth-form">
          <input class="auth-input" id="new-password" type="password" placeholder="New password (min 6 chars)" autocomplete="new-password" />
          <input class="auth-input" id="confirm-password" type="password" placeholder="Confirm password" autocomplete="new-password" />
          <button class="btn btn-pink" id="btn-update-password">Update Password</button>
          <div id="reset-pw-msg" class="auth-error"></div>
        </div>
      </div>
    `;

    document.getElementById('btn-update-password').addEventListener('click', async () => {
      const pw = document.getElementById('new-password').value;
      const confirmPw = document.getElementById('confirm-password').value;
      const msgEl = document.getElementById('reset-pw-msg');
      msgEl.style.color = '';
      msgEl.textContent = '';

      if (!pw || pw.length < 6) { msgEl.textContent = 'Password must be at least 6 characters'; return; }
      if (pw !== confirmPw) { msgEl.textContent = 'Passwords do not match'; return; }

      try {
        await this.userManager.updatePassword(pw);
        msgEl.style.color = '#7dffb3';
        msgEl.textContent = 'Password updated! Redirecting... 💕';
        setTimeout(() => this.showLobby(), 1500);
      } catch (e) {
        msgEl.textContent = e.message || 'Failed to update password';
      }
    });
  }

  // ==================== PROFILE SCREEN ====================
  async showProfile(options) {
    if (this.userManager.isGuest) { this.showAuthScreen(); return; }
    const username = this.userManager.profile.username;
    if (this._router && !(options && options.fromRouter)) {
      this._router.navigate(`/u/${username}`);
    }

    this.clear();
    const profile = this.userManager.profile;

    this.overlay.innerHTML = `
      <div class="profile-layout">
        <div class="profile-scroll">
          <div class="profile-header">
            <img class="profile-avatar" src="${profile.avatarUrl}" alt="avatar" />
            <div class="profile-name">${this.userManager.getDisplayLabel()}</div>
            <div class="profile-bio">${profile.bio || 'No bio yet~'}</div>
            <div class="profile-points">${profile.points} points ⭐</div>
          </div>
          <div class="profile-section-tabs">
            <button class="profile-tab active" data-section="stats">Stats</button>
            <button class="profile-tab" data-section="achievements">Achievements</button>
            <button class="profile-tab" data-section="history">History</button>
            <button class="profile-tab" data-section="settings">Settings</button>
          </div>
          <div class="profile-content" id="profile-content">
            <div class="profile-loading">Loading...</div>
          </div>
        </div>
        <div class="profile-bottom-bar">
          <button class="btn btn-blue btn-small" id="btn-back-lobby-profile">← Lobby</button>
          <button class="btn btn-small" id="btn-signout" style="background:rgba(255,255,255,0.1);color:#ff6b9d;">Sign Out</button>
        </div>
      </div>
    `;

    this._bindProfileTabs();
    this._showStatsSection();

    document.getElementById('btn-back-lobby-profile').addEventListener('click', () => this.showLobby());
    document.getElementById('btn-signout').addEventListener('click', async () => {
      await this.userManager.signOut();
      this.showLobby();
    });
  }

  _bindProfileTabs() {
    this.overlay.querySelectorAll('.profile-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.overlay.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const section = tab.dataset.section;
        if (section === 'stats') this._showStatsSection();
        else if (section === 'achievements') this._showAchievementsSection();
        else if (section === 'history') this._showHistorySection();
        else if (section === 'settings') this._showSettingsSection();
      });
    });
  }

  async _showStatsSection() {
    const container = document.getElementById('profile-content');
    container.innerHTML = '<div class="profile-loading">Loading stats...</div>';

    const stats = await this.userManager.fetchStats();
    if (!stats.length) {
      container.innerHTML = '<div class="profile-empty">No games played yet! Go play some games 🎮</div>';
      return;
    }

    const gameNames = {
      'pig-vs-chick': '🐷 Pig vs Chick',
      'word-scramble-race': '📝 Word Scramble',
      'doodle-guess': '🎨 Doodle Guess',
      'memory-match': '🧠 Memory Match',
    };

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
            <div class="stat-card-title">${gameNames[s.game_type] || s.game_type}</div>
            <div class="stat-card-row"><span>Wins</span><strong>${s.wins}</strong></div>
            <div class="stat-card-row"><span>Losses</span><strong>${s.losses}</strong></div>
            <div class="stat-card-row"><span>Ties</span><strong>${s.ties}</strong></div>
            <div class="stat-card-row"><span>Points</span><strong>${s.total_points}</strong></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async _showAchievementsSection() {
    const container = document.getElementById('profile-content');
    container.innerHTML = '<div class="profile-loading">Loading achievements...</div>';

    const { all, earned } = await this.userManager.fetchAchievements();
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
              ${isEarned ? '<div class="achievement-check">✓</div>' : ''}
            </div>
          `;
  }).join('')}
      </div>
    `;
  }

  async _showHistorySection() {
    const container = document.getElementById('profile-content');
    container.innerHTML = '<div class="profile-loading">Loading match history...</div>';

    const matches = await this.userManager.fetchMatchHistory();
    if (!matches.length) {
      container.innerHTML = '<div class="profile-empty">No match history yet!</div>';
      return;
    }

    const myId = this.userManager.profile.id;
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
    const gameNames = {
      'pig-vs-chick': '🐷', 'word-scramble-race': '📝',
      'doodle-guess': '🎨', 'memory-match': '🧠',
    };
    const timeAgo = this._timeAgo(m.played_at);
    return `
              <div class="history-item">
                <div class="history-game">${gameNames[m.game_type] || '🎮'}</div>
                <div class="history-opp">
                  ${oppAvatar ? `<img class="history-opp-avatar" src="${oppAvatar}" />` : '<div class="history-opp-avatar-placeholder">👤</div>'}
                  <span>${oppName}</span>
                </div>
                <div class="history-score">${myScore} – ${oppScore}</div>
                <div class="history-result ${resultClass}">${result}</div>
                <div class="history-time">${timeAgo}</div>
              </div>
            `;
  }).join('')}
      </div>
    `;
  }

  _showSettingsSection() {
    const container = document.getElementById('profile-content');
    const profile = this.userManager.profile;

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
        await this.userManager.updateProfile({
          displayName: document.getElementById('setting-display').value.trim(),
          bio: document.getElementById('setting-bio').value.trim(),
          avatarUrl: selectedAvatar,
        });
        msgEl.textContent = 'Saved! 💕';
        setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2000);
      } catch (e) {
        msgEl.style.color = '#ff6b9d';
        msgEl.textContent = e.message || 'Save failed';
      }
    });
  }

  _timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  // ==================== ACHIEVEMENT TOAST ====================
  showAchievementToast(achievements) {
    achievements.forEach((ach, i) => {
      setTimeout(() => {
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
          <div class="achievement-toast-icon">${ach.icon}</div>
          <div class="achievement-toast-text">
            <div class="achievement-toast-title">Achievement Unlocked!</div>
            <div class="achievement-toast-name">${ach.name}</div>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }, i * 1500);
    });
  }

  // ==================== JOINING ROOM (deep-link loading screen) ====================
  showJoiningRoom(code) {
    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui">
        <div class="lobby-title">SUPERBUCIN</div>
        <div class="lobby-subtitle">sayang's game collection</div>
        <div class="room-section">
          <div class="waiting-text">Joining room ${code}...</div>
        </div>
      </div>
    `;
  }

  // ==================== PUBLIC PROFILE ====================
  async showPublicProfile(username) {
    // If viewing own profile, show the editable version
    const ownUsername = this.userManager.profile?.username;
    if (!this.userManager.isGuest && ownUsername && ownUsername === username) {
      this.showProfile({ fromRouter: true });
      return;
    }

    this.clear();
    this.overlay.innerHTML = `
      <div class="lobby-ui profile-screen">
        <div class="profile-header">
          <div class="profile-loading">Loading profile...</div>
        </div>
      </div>
    `;

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (!res.ok) {
        this.overlay.innerHTML = `
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
        document.getElementById('btn-back-lobby-pub').addEventListener('click', () => this.showLobby());
        return;
      }

      const data = await res.json();
      const p = data.profile;
      const stats = data.stats || [];
      const achievements = data.achievements || [];

      const gameNames = {
        'pig-vs-chick': '\ud83d\udc37 Pig vs Chick',
        'word-scramble-race': '\ud83d\udcdd Word Scramble',
        'doodle-guess': '\ud83c\udfa8 Doodle Guess',
        'memory-match': '\ud83e\udde0 Memory Match',
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

      this.overlay.innerHTML = `
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
      document.getElementById('btn-back-lobby-pub').addEventListener('click', () => this.showLobby());
    } catch (err) {
      console.error('Failed to load public profile:', err);
      this.overlay.innerHTML = `
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
      document.getElementById('btn-back-lobby-pub').addEventListener('click', () => this.showLobby());
    }
  }

  // ==================== LOBBY ====================
  showLobby(options) {
    if (this._router && !(options && options.fromRouter)) {
      this._router.navigate('/');
    }
    this.clear();

    const registered = GameRegistry.list();
    const cardsHTML = registered.map((g, i) => `
      <div class="game-card${i === 0 ? ' active' : ''}" data-game-type="${g.type}">
        <div class="game-card-icon">${g.icon}</div>
        <div class="game-card-title">${g.name}</div>
        <div class="game-card-badge">${g.badge}</div>
      </div>
    `).join('');

    const padHTML = Array(1).fill(`
      <div class="game-card disabled">
        <div class="game-card-icon">🔒</div>
        <div class="game-card-title">Coming Soon</div>
        <div class="game-card-badge">???</div>
      </div>
    `).join('');

    const packOptionsHtml = MEMORY_PACK_CHOICES.map(
      (p) => `<option value="${p.id}">${p.label}</option>`,
    ).join('');

    this.overlay.innerHTML = `
      ${this._renderUserBar()}
      <div class="lobby-ui" style="padding-top:3.5rem;">
        <div class="lobby-title">SUPERBUCIN</div>
        <div class="lobby-subtitle">sayang's game collection 💕</div>
        <div class="game-grid">
          ${cardsHTML}${padHTML}
        </div>
        <div class="game-options-panel" id="game-options-panel" style="display:none;">
          <button class="game-options-toggle" id="game-options-toggle" type="button">
            <span id="game-options-label">Game Options</span>
            <span class="game-options-chevron" id="game-options-chevron">›</span>
          </button>
          <div class="game-options-body" id="game-options-body" style="display:none;">
            <div id="memory-room-options" style="display:none;">
              <div class="game-options-group">
                <label class="game-options-field-label">Card pack</label>
                <select id="memory-pack" class="memory-pack-select">${packOptionsHtml}</select>
              </div>
              <div class="game-options-group">
                <label class="game-options-field-label">Difficulty</label>
                <div class="game-options-pills">
                  <label class="game-options-pill"><input type="radio" name="memgrid" value="4" checked /><span>Easy 4×4</span></label>
                  <label class="game-options-pill"><input type="radio" name="memgrid" value="6" /><span>Hard 6×6</span></label>
                </div>
              </div>
              <label class="game-options-check"><input type="checkbox" id="memory-speed" /><span>Speed mode (timer)</span></label>
            </div>
            <div id="doodle-custom-wrap" style="display:none;">
              <div class="game-options-group">
                <label class="game-options-field-label">Custom prompts <span style="color:#666;">(optional)</span></label>
                <textarea class="doodle-custom-textarea" id="doodle-custom-prompts" placeholder="Inside jokes, memories, nicknames… one per line" rows="3" maxlength="8000"></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="room-section">
          <button class="btn btn-pink" id="btn-create">Create Room</button>
          <div class="or-divider">— or —</div>
          <input class="room-code-input" id="input-code" placeholder="Enter code" maxlength="4" />
          <button class="btn btn-blue btn-small" id="btn-join">Join Room</button>
        </div>
      </div>
    `;

    this._bindUserBar();

    let selectedGameType = registered[0]?.type || 'pig-vs-chick';
    const optionsPanel = document.getElementById('game-options-panel');
    const optionsToggle = document.getElementById('game-options-toggle');
    const optionsBody = document.getElementById('game-options-body');
    const optionsChevron = document.getElementById('game-options-chevron');
    const optionsLabel = document.getElementById('game-options-label');
    const customWrap = document.getElementById('doodle-custom-wrap');
    const memOpts = document.getElementById('memory-room-options');
    let optionsOpen = false;

    const GAME_OPTION_LABELS = {
      'memory-match': 'Memory Match Options',
      'doodle-guess': 'Doodle Options',
    };

    optionsToggle.addEventListener('click', () => {
      optionsOpen = !optionsOpen;
      optionsBody.style.display = optionsOpen ? 'block' : 'none';
      optionsChevron.classList.toggle('open', optionsOpen);
    });

    const syncGameOptionPanels = () => {
      const hasOptions = selectedGameType === 'doodle-guess' || selectedGameType === 'memory-match';
      optionsPanel.style.display = hasOptions ? 'block' : 'none';
      optionsLabel.textContent = GAME_OPTION_LABELS[selectedGameType] || 'Game Options';
      if (customWrap) customWrap.style.display = selectedGameType === 'doodle-guess' ? 'block' : 'none';
      if (memOpts) memOpts.style.display = selectedGameType === 'memory-match' ? 'block' : 'none';
      if (!hasOptions) {
        optionsOpen = false;
        optionsBody.style.display = 'none';
        optionsChevron.classList.remove('open');
      }
    };

    this.overlay.querySelectorAll('.game-card[data-game-type]').forEach((card) => {
      card.addEventListener('click', () => {
        this.overlay.querySelectorAll('.game-card[data-game-type]').forEach((c) => c.classList.remove('active'));
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
        const gridEl = this.overlay.querySelector('input[name="memgrid"]:checked');
        const gridSize = gridEl ? Number(gridEl.value) : 4;
        const speedMode = !!document.getElementById('memory-speed')?.checked;
        this.network.createRoom({
          gameType: 'memory-match',
          packId,
          gridSize,
          speedMode,
        });
      } else {
        this.network.createRoom(selectedGameType, customPrompts);
      }
    });
    document.getElementById('btn-join').addEventListener('click', () => {
      const code = document.getElementById('input-code').value.trim();
      if (code.length === 4) this.network.joinRoom(code);
    });
    document.getElementById('input-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-join').click();
    });
  }

  showWaitingRoom(roomCode) {
    if (this._router) {
      this._router.replace('/room/' + roomCode);
    }
    this.clear();
    const profile = this.userManager.profile;
    const shareUrl = `${window.location.origin}/room/${roomCode}`;
    this.overlay.innerHTML = `
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
            <div class="waiting-player-name">${this.userManager.getDisplayLabel()}</div>
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

  showSideSelect(roomCode) {
    this.clear();
    this.selectedSide = null;

    const gameType = this.network.roomGameType || 'pig-vs-chick';
    const game = GameRegistry.get(gameType);
    const ss = game?.sideSelect;
    const title = ss?.title || 'SUPERBUCIN';
    const pickTitle = ss?.pickTitle || 'Pick your side!';
    const options = ss?.options?.length
      ? ss.options
      : [
          { id: 'pig', emoji: '🐷', label: 'Pig' },
          { id: 'chicken', emoji: '🐔', label: 'Chicken' },
        ];

    const opp = this.network.opponentIdentity;
    const oppSection = opp ? `
      <div class="side-select-players">
        <div class="side-select-player">
          <img class="side-player-avatar" src="${this.userManager.profile.avatarUrl}" />
          <span>${this.userManager.getDisplayLabel()}</span>
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

    this.overlay.innerHTML = `
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
    document.querySelectorAll('.side-option').forEach((el) => {
      el.addEventListener('click', () => {
        const side = el.dataset.side;
        this.selectedSide = side;
        document.querySelectorAll('.side-option').forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        this.network.selectSide(side);
        document.getElementById('side-status').textContent = `Locked in! Waiting for sayang~`;
      });
    });
  }

  updateSideSelect(data) {
    const el = document.getElementById('side-status');
    if (el && data.message) el.textContent = data.message;

    // Auto-highlight remaining side when opponent picks
    if (data.opponentSide && !this.selectedSide) {
      const options = document.querySelectorAll('.side-option');
      options.forEach((opt) => {
        if (opt.dataset.side !== data.opponentSide) {
          opt.classList.add('suggested');
        }
      });
    }
  }

  // ==================== GAME ====================
  startGame(data) {
    const gameType = data.gameType || 'pig-vs-chick';
    const game = GameRegistry.get(gameType);
    if (!game) {
      this.showError(`Unknown game: ${gameType}`);
      return;
    }

    game.applyConfig(data.gameConfig);
    this.clear();

    this.activeHUD = game.createHUD(this.overlay, data, this.network);

    this.gameScene = new game.Scene(this.sceneManager, this.network, this, data);
    this.gameScene.init();
  }

  showCountdown(number) {
    let existing = document.querySelector('.countdown-overlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'countdown-overlay';
      this.overlay.appendChild(existing);
    }
    if (number === 'GO!') {
      existing.innerHTML = `<div class="countdown-text">${number}</div>`;
      setTimeout(() => existing.remove(), 600);
    } else {
      existing.innerHTML = `<div class="countdown-number">${number}</div>`;
    }
  }

  updateHP(playerHP) {
    if (this.activeHUD) this.activeHUD.updateHP(playerHP, this.network.playerId);
  }

  updateEnergy(current) {
    if (this.activeHUD) this.activeHUD.updateEnergy(current);
  }

  updateSpawnButtons(energy) {
    if (this.activeHUD) this.activeHUD.updateSpawnButtons(energy);
  }

  showVictory(data) {
    if (this.gameScene) this.gameScene.destroy();
    this.gameScene = null;
    if (this.activeHUD && this.activeHUD.destroy) this.activeHUD.destroy();
    this.activeHUD = null;
    this.clear();

    const myProfile = this.userManager.profile;
    const opp = this.network.opponentIdentity;

    let msg;
    let sub;
    if (data.tie) {
      msg = 'Seri! 🤝';
      const ys = data.yourScore ?? data.p1Score ?? 0;
      const os = data.oppScore ?? data.p2Score ?? 0;
      sub = `${ys} — ${os}`;
    } else {
      const isWinner = data.isWinner;
      const messages = isWinner
        ? ['SAYANG MENANG! 🤣🤣🤣', 'GG sayang~ kamu hebat!', 'LUCU BANGET menangnya! 💕']
        : ['Yahhh kalah~ 😭', 'Nanti revenge ya say!', 'GG sayang~ next time!'];
      msg = messages[Math.floor(Math.random() * messages.length)];
      const scoreSum = (data.yourScore ?? 0) + (data.oppScore ?? 0);
      if (scoreSum > 0) {
        sub = `${isWinner ? 'You won!' : 'Better luck next time~'} · ${data.yourScore} — ${data.oppScore}`;
      } else {
        sub = isWinner ? 'You won!' : 'Better luck next time~';
      }
    }

    const pointsEarned = data.pointsEarned || 0;
    const pointsHtml = pointsEarned > 0
      ? `<div class="victory-points">+${pointsEarned} points ⭐</div>`
      : '';

    this.overlay.innerHTML = `
      <div class="victory-overlay">
        <div class="victory-players">
          <div class="victory-player">
            <img class="victory-avatar" src="${myProfile.avatarUrl}" />
            <span>${this.userManager.getDisplayLabel()}</span>
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
        <button class="btn btn-pink" id="btn-rematch">Play Again 💕</button>
        <button class="btn btn-blue btn-small" id="btn-lobby" style="margin-top:0.75rem;">Back to Lobby</button>
      </div>
    `;
    document.getElementById('btn-rematch').addEventListener('click', () => this.network.requestRematch());
    document.getElementById('btn-lobby').addEventListener('click', () => {
      this.gameScene = null;
      this.activeHUD = null;
      this.showLobby();
    });
  }

  showDisconnect() {
    if (this.gameScene) this.gameScene.destroy();
    this.gameScene = null;
    if (this.activeHUD && this.activeHUD.destroy) this.activeHUD.destroy();
    this.activeHUD = null;
    this.clear();
    this.overlay.innerHTML = `
      <div class="victory-overlay">
        <div class="victory-text">Opponent disconnected 😢</div>
        <button class="btn btn-pink" id="btn-lobby" style="margin-top:1.5rem;">Back to Lobby</button>
      </div>
    `;
    document.getElementById('btn-lobby').addEventListener('click', () => {
      this.gameScene = null;
      this.activeHUD = null;
      this.showLobby();
    });
  }

  showReconnecting() {
    let overlay = document.getElementById('reconnect-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reconnect-overlay';
      overlay.className = 'reconnect-overlay';
      overlay.innerHTML = `
        <div class="reconnect-text">Sayang disconnected...</div>
        <div class="reconnect-sub">Waiting for reconnect ⏳</div>
      `;
      this.overlay.appendChild(overlay);
    }
  }

  hideReconnecting() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) overlay.remove();
    this.showError('Sayang reconnected! 💕');
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
