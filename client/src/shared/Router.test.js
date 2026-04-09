import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  Router,
  matchRoute,
  __resetRouterForTests,
} from './Router.js';

describe('matchRoute', () => {
  it('maps root and trims trailing slashes', () => {
    assert.deepEqual(matchRoute('/'), { route: 'lobby' });
    assert.deepEqual(matchRoute(''), { route: 'lobby' });
    assert.deepEqual(matchRoute('///'), { route: 'lobby' });
  });

  it('maps /auth and /reset-password', () => {
    assert.deepEqual(matchRoute('/auth'), { route: 'auth' });
    assert.deepEqual(matchRoute('/auth/'), { route: 'auth' });
    assert.deepEqual(matchRoute('/reset-password'), { route: 'reset-password' });
  });

  it('maps /room/:code with uppercase normalization (1–6 alnum)', () => {
    assert.deepEqual(matchRoute('/room/abc1'), { route: 'room', code: 'ABC1' });
    assert.deepEqual(matchRoute('/room/AbCdEf'), { route: 'room', code: 'ABCDEF' });
  });

  it('maps /u/:username', () => {
    assert.deepEqual(matchRoute('/u/jon_k-9'), { route: 'user', username: 'jon_k-9' });
  });

  it('falls back to lobby for unknown paths and invalid room segments', () => {
    assert.deepEqual(matchRoute('/nope'), { route: 'lobby' });
    assert.deepEqual(matchRoute('/room/'), { route: 'lobby' });
    assert.deepEqual(matchRoute('/room/too-long-code'), { route: 'lobby' });
    assert.deepEqual(matchRoute('/room/bad!'), { route: 'lobby' });
  });

  it('treats /profile like unknown path (lobby) until a dedicated route exists', () => {
    assert.deepEqual(matchRoute('/profile'), { route: 'lobby' });
  });
});

describe('Router (History + init)', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com/',
    });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.history = dom.window.history;
  });

  afterEach(() => {
    __resetRouterForTests();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.history;
  });

  it('navigate pushes state and updates currentPath; skips no-op', () => {
    const pushed = [];
    window.history.pushState = (...args) => pushed.push(args);
    assert.equal(Router.currentPath(), '/');
    Router.navigate('/lobby-alt');
    assert.equal(Router.currentPath(), '/lobby-alt');
    assert.equal(pushed.length, 1);
    Router.navigate('/lobby-alt');
    assert.equal(pushed.length, 1);
  });

  it('replace updates currentPath via replaceState', () => {
    const replaced = [];
    window.history.replaceState = (...args) => replaced.push(args);
    Router.replace('/auth');
    assert.equal(Router.currentPath(), '/auth');
    assert.equal(replaced.length, 1);
  });

  it('init resolves lobby and calls showLobby', () => {
    const ui = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    let lobbyCalls = 0;
    ui.showLobby = () => { lobbyCalls += 1; };
    const network = { pendingJoinCode: null, _inGame: false };
    window.history.replaceState(null, '', '/');
    Router.init(ui, network);
    assert.equal(lobbyCalls, 1);
    assert.equal(Router.currentPath(), '/');
  });

  it('init on /u/:username calls showPublicProfile', () => {
    const seen = [];
    const ui = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: (u) => seen.push(u),
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const network = { pendingJoinCode: null, _inGame: false };
    window.history.replaceState(null, '', '/u/jane_doe');
    Router.init(ui, network);
    assert.deepEqual(seen, ['jane_doe']);
    assert.equal(Router.currentPath(), '/u/jane_doe');
  });

  it('init on /auth and /reset-password call the matching UI hooks', () => {
    const authSeen = [];
    const resetSeen = [];
    const uiAuth = {
      showLobby: () => {},
      showAuthScreen: () => { authSeen.push(1); },
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const uiReset = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => { resetSeen.push(1); },
      showJoiningRoom: () => {},
    };
    const network = { pendingJoinCode: null, _inGame: false };
    window.history.replaceState(null, '', '/auth');
    Router.init(uiAuth, network);
    assert.equal(authSeen.length, 1);
    assert.equal(Router.currentPath(), '/auth');
    __resetRouterForTests();
    window.history.replaceState(null, '', '/reset-password');
    Router.init(uiReset, network);
    assert.equal(resetSeen.length, 1);
    assert.equal(Router.currentPath(), '/reset-password');
  });

  it('second init removes the previous popstate listener', () => {
    const ui = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const network = { pendingJoinCode: null, _inGame: false };
    window.history.replaceState(null, '', '/');
    let removes = 0;
    const orig = window.removeEventListener.bind(window);
    window.removeEventListener = (type, fn, ...rest) => {
      if (type === 'popstate') removes += 1;
      return orig(type, fn, ...rest);
    };
    Router.init(ui, network);
    Router.init(ui, network);
    assert.equal(removes, 1);
    window.removeEventListener = orig;
  });

  it('popstate when not in game re-resolves the route', () => {
    const screens = [];
    const ui = {
      showLobby: () => { screens.push('lobby'); },
      showAuthScreen: () => { screens.push('auth'); },
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const network = { pendingJoinCode: null, _inGame: false };
    window.history.replaceState(null, '', '/');
    Router.init(ui, network);
    assert.ok(screens.includes('lobby'));
    window.history.replaceState(null, '', '/auth');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.ok(screens.includes('auth'));
  });

  it('init on /room/:code sets pendingJoinCode when socket disconnected', () => {
    const ui = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    let joining = null;
    ui.showJoiningRoom = (code) => { joining = code; };
    const network = {
      pendingJoinCode: null,
      socket: null,
      _inGame: false,
      joinRoom: () => {},
    };
    window.history.replaceState(null, '', '/room/xy12');
    Router.init(ui, network);
    assert.equal(joining, 'XY12');
    assert.equal(network.pendingJoinCode, 'XY12');
    assert.equal(Router.currentPath(), '/room/XY12');
  });

  it('init on /room/:code joins immediately when socket already connected', () => {
    const ui = {
      showLobby: () => {},
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const joined = [];
    const network = {
      pendingJoinCode: null,
      socket: { connected: true },
      _inGame: false,
      joinRoom: (code) => joined.push(code),
    };
    window.history.replaceState(null, '', '/room/ab12');
    Router.init(ui, network);
    assert.deepEqual(joined, ['AB12']);
    assert.equal(network.pendingJoinCode, null);
  });

  it('popstate during active game only syncs currentPath', () => {
    const ui = {
      showLobby: () => { throw new Error('should not leave game'); },
      showAuthScreen: () => {},
      showPublicProfile: () => {},
      showResetPassword: () => {},
      showJoiningRoom: () => {},
    };
    const network = { pendingJoinCode: null, _inGame: true };
    window.history.replaceState(null, '', '/room/aa11');
    Router.init(ui, network);
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.equal(Router.currentPath(), '/');
  });
});
