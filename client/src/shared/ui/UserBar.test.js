import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderUserBar, bindUserBar } from './UserBar.js';

function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

describe('UserBar', () => {
  beforeEach(() => {
    installDom();
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  it('bindUserBar action sends guests to auth', () => {
    const screens = [];
    const userManager = {
      profile: { avatarUrl: '/a.png', points: 0 },
      getDisplayLabel: () => 'Guesty',
      isGuest: true,
    };
    const wrap = document.createElement('div');
    wrap.innerHTML = renderUserBar(userManager);
    document.body.appendChild(wrap);
    bindUserBar(userManager, { showScreen: (s) => screens.push(s) });
    document.getElementById('user-bar-action').click();
    assert.deepEqual(screens, ['auth']);
  });

  it('bindUserBar action and profile tap send signed-in users to profile', () => {
    const screens = [];
    const userManager = {
      profile: { avatarUrl: '/a.png', points: 12 },
      getDisplayLabel: () => 'Member',
      isGuest: false,
    };
    const wrap = document.createElement('div');
    wrap.innerHTML = renderUserBar(userManager);
    document.body.appendChild(wrap);
    bindUserBar(userManager, { showScreen: (s) => screens.push(s) });
    document.getElementById('user-bar-profile').click();
    document.getElementById('user-bar-action').click();
    assert.deepEqual(screens, ['profile', 'profile']);
  });

  it('guest profile tap does not navigate (only action does)', () => {
    const screens = [];
    const userManager = {
      profile: { avatarUrl: '/a.png', points: 0 },
      getDisplayLabel: () => 'G',
      isGuest: true,
    };
    const wrap = document.createElement('div');
    wrap.innerHTML = renderUserBar(userManager);
    document.body.appendChild(wrap);
    bindUserBar(userManager, { showScreen: (s) => screens.push(s) });
    document.getElementById('user-bar-profile').click();
    assert.deepEqual(screens, []);
  });
});
