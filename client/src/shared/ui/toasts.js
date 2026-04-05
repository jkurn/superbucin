export function showError(message) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showAchievementToast(achievements) {
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
