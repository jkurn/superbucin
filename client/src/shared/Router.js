import { capturePageView } from './analytics.js';

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
let _currentPath = '/';
let _popstateHandler = null;

/** Pure path → route match (exported for unit tests and tooling). */
export function matchRoute(pathname) {
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

  if (!_isReplace) {
    capturePageView(_currentPath);
  }
}

const Router = {
  /**
   * Call once after UIManager and NetworkManager are wired up.
   */
  init(ui, network) {
    _ui = ui;
    _network = network;

    if (typeof window !== 'undefined' && _popstateHandler) {
      window.removeEventListener('popstate', _popstateHandler);
      _popstateHandler = null;
    }

    _popstateHandler = () => {
      const matched = matchRoute(window.location.pathname);
      // During an active game, do not disrupt it; just update internal path
      if (_network._inGame) {
        _currentPath = window.location.pathname;
        return;
      }
      resolve(matched);
    };
    window.addEventListener('popstate', _popstateHandler);

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
    capturePageView(path);
  },

  /**
   * Replace the current history entry (no new back-button stop).
   */
  replace(path) {
    _currentPath = path;
    window.history.replaceState(null, '', path);
    capturePageView(path);
  },

  currentPath() {
    return _currentPath;
  },
};

/** @internal Resets module state between node tests; removes popstate listener if present. */
export function __resetRouterForTests() {
  if (typeof window !== 'undefined' && _popstateHandler) {
    window.removeEventListener('popstate', _popstateHandler);
  }
  _popstateHandler = null;
  _ui = null;
  _network = null;
  _currentPath = '/';
}

export { Router };
