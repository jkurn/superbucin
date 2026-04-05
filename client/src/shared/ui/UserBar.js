export function renderUserBar(userManager) {
  const profile = userManager.profile;
  const label = userManager.getDisplayLabel();
  return `
    <div class="user-bar">
      <div class="user-bar-left" id="user-bar-profile">
        <img class="user-bar-avatar" src="${profile.avatarUrl}" alt="avatar" />
        <div class="user-bar-info">
          <div class="user-bar-name">${label}</div>
          <div class="user-bar-points">${userManager.isGuest ? 'Guest' : `${profile.points} pts`}</div>
        </div>
      </div>
      <button class="user-bar-btn" id="user-bar-action">
        ${userManager.isGuest ? '\ud83d\udd11 Sign In' : '\ud83d\udc64 Profile'}
      </button>
    </div>
  `;
}

export function bindUserBar(userManager, deps) {
  const profileBtn = document.getElementById('user-bar-profile');
  const actionBtn = document.getElementById('user-bar-action');

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      if (!userManager.isGuest) deps.showScreen('profile');
    });
  }

  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      if (userManager.isGuest) {
        deps.showScreen('auth');
      } else {
        deps.showScreen('profile');
      }
    });
  }
}
