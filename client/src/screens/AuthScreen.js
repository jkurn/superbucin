import { AVATARS } from '../shared/ui/constants.js';

export function render(overlay, deps, options) {
  const { userManager, router, showScreen } = deps;

  if (router && !(options && options.fromRouter)) {
    router.navigate('/auth');
  }

  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title" style="font-size:1.8rem;">SIGN IN</div>
      <div class="lobby-subtitle">Save your stats & achievements \ud83d\udc95</div>
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

      <button class="btn btn-blue btn-small" id="btn-back-lobby" style="margin-top:1rem;">\u2190 Back to Lobby</button>
    </div>
  `;

  let selectedAvatar = userManager.profile.avatarUrl;
  const picks = overlay.querySelectorAll('.avatar-pick-item');
  picks.forEach((img) => {
    if (img.dataset.avatar === selectedAvatar) img.classList.add('selected');
    img.addEventListener('click', () => {
      picks.forEach((p) => p.classList.remove('selected'));
      img.classList.add('selected');
      selectedAvatar = img.dataset.avatar;
    });
  });

  overlay.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
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
      await userManager.signIn(email, password);
      showScreen('lobby');
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
      await userManager.signUp(email, password, username, displayName, selectedAvatar);
      showScreen('lobby');
    } catch (e) {
      errEl.textContent = e.message || 'Signup failed';
    }
  });

  document.getElementById('btn-forgot').addEventListener('click', () => renderForgotPassword(overlay, deps));
  document.getElementById('btn-back-lobby').addEventListener('click', () => showScreen('lobby'));
}

function renderForgotPassword(overlay, deps) {
  const { userManager, showScreen } = deps;

  overlay.innerHTML = `
    <div class="lobby-ui">
      <div class="lobby-title" style="font-size:1.8rem;">RESET PASSWORD</div>
      <div class="lobby-subtitle">Enter your email and we'll send a reset link</div>
      <div class="auth-form">
        <input class="auth-input" id="reset-email" type="email" placeholder="Email" autocomplete="email" />
        <button class="btn btn-pink" id="btn-send-reset">Send Reset Link</button>
        <div id="reset-msg" class="auth-error"></div>
      </div>
      <button class="btn btn-blue btn-small" id="btn-back-auth" style="margin-top:1rem;">\u2190 Back to Sign In</button>
    </div>
  `;

  document.getElementById('btn-send-reset').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const msgEl = document.getElementById('reset-msg');
    msgEl.style.color = '';
    msgEl.textContent = '';

    if (!email) { msgEl.textContent = 'Please enter your email'; return; }

    try {
      await userManager.resetPassword(email);
      msgEl.style.color = '#7dffb3';
      msgEl.textContent = 'Reset link sent! Check your email \ud83d\udc95';
      document.getElementById('btn-send-reset').disabled = true;
      document.getElementById('btn-send-reset').textContent = 'Sent!';
    } catch (e) {
      msgEl.textContent = e.message || 'Failed to send reset link';
    }
  });

  document.getElementById('btn-back-auth').addEventListener('click', () => showScreen('auth'));
}

export function renderResetPassword(overlay, deps) {
  const { userManager, showScreen } = deps;

  overlay.innerHTML = `
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
      await userManager.updatePassword(pw);
      msgEl.style.color = '#7dffb3';
      msgEl.textContent = 'Password updated! Redirecting... \ud83d\udc95';
      setTimeout(() => showScreen('lobby'), 1500);
    } catch (e) {
      msgEl.textContent = e.message || 'Failed to update password';
    }
  });
}
