/**
 * Lightweight History API router for SUPERBUCIN.
 *
 * Route table:
 *   /              -> Lobby
 *   /room/:code    -> Auto-join room (deep link)
 *   /u/:username   -> Public profile
 *   /profile       -> Own profile
 *   /auth          -> Auth screen
 *
 * Game screens (startGame, showVictory, showDisconnect) do NOT get URLs;
 * the URL stays as /room/:code during gameplay.
 */

let _ui = null;
let _network = null;
let _userManager = null;
let _currentPath = '/';

function matchRoute(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';

  if (p === '/') return { route: 'lobby' };
  if (p === '/auth') return { route: 'auth' };
  if (p === '/reset-password') return { route: 'reset-password' };

  const roomMatch = p.match(/^\/room\/([A-Za-z0-9]{1,6})$/);
  if (roomMatch) return { route: 'room', code: roomMatch[1].toUpperCase() };

  const userMatch = p.match(/^\/u\/([A-Za-z0-9_.-]+)$/);
  if (userMatch) return { route: 'user', username: userMatch[1] };

  return { route: 'lobby' };
}

function resolve(matched, { replace: _isReplace = false } = {}) {
  const { route } = matched;

  if (route === 'lobby') {
    _currentPath = '/';
    _ui.showLobby({ fromRouter: true });
  } else if (route === 'auth') {
    _currentPath = '/auth';
    _ui.showAuthScreen({ fromRouter: true });
  } else if (route === 'user') {
    _currentPath = `/u/${matched.username}`;
    _ui.showPublicProfile(matched.username);
  } else if (route === 'reset-password') {
    _currentPath = '/reset-password';
    _ui.showResetPassword();
  } else if (route === 'room') {
    const code = matched.code;
    _currentPath = `/room/${code}`;
    _ui.showJoiningRoom(code);
    _network.pendingJoinCode = code;
    // If already connected, fire the join immediately
    if (_network.socket && _network.socket.connected) {
      _network.joinRoom(code);
      _network.pendingJoinCode = null;
    }
  }
}

const Router = {
  /**
   * Call once after UIManager, NetworkManager and UserManager are wired up.
   */
  init(ui, network, userManager) {
    _ui = ui;
    _network = network;
    _userManager = userManager;

    // Listen for back/forward navigation
    window.addEventListener('popstate', () => {
      const matched = matchRoute(window.location.pathname);
      // During an active game, do not disrupt it; just update internal path
      if (_network._inGame) {
        _currentPath = window.location.pathname;
        return;
      }
      resolve(matched);
    });

    // Resolve initial URL
    const initial = matchRoute(window.location.pathname);
    resolve(initial);
  },

  /**
   * Push a new entry to the history stack.
   */
  navigate(path) {
    if (path === _currentPath) return;
    _currentPath = path;
    window.history.pushState(null, '', path);
  },

  /**
   * Replace the current history entry (no new back-button stop).
   */
  replace(path) {
    _currentPath = path;
    window.history.replaceState(null, '', path);
  },

  currentPath() {
    return _currentPath;
  },
};

export { Router };
