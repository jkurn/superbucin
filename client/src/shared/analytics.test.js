import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import posthog from 'posthog-js';
import {
  __resetAnalyticsForTests,
  captureEvent,
  capturePageView,
  initAnalytics,
  resetAnalyticsIdentity,
  syncUserIdentity,
  trackScreen,
} from './analytics.js';

const originalWindow = globalThis.window;
const originalEnvOverride = globalThis.__SUPERBUCIN_ANALYTICS_ENV__;
const originalConsoleWarn = console.warn;
const originalFns = {
  init: posthog.init,
  register: posthog.register,
  capture: posthog.capture,
  identify: posthog.identify,
  reset: posthog.reset,
};

function setBrowserWindow(hostname = 'localhost') {
  globalThis.window = {
    location: {
      hostname,
      href: `https://${hostname}/path`,
    },
  };
}

describe('analytics', () => {
  let calls;
  let warnMessages;

  beforeEach(() => {
    calls = {
      init: [],
      register: [],
      capture: [],
      identify: [],
      reset: 0,
    };
    warnMessages = [];
    console.warn = (...args) => {
      warnMessages.push(args.join(' '));
    };
    posthog.init = (...args) => calls.init.push(args);
    posthog.register = (...args) => calls.register.push(args);
    posthog.capture = (...args) => calls.capture.push(args);
    posthog.identify = (...args) => calls.identify.push(args);
    posthog.reset = () => {
      calls.reset += 1;
    };
    __resetAnalyticsForTests();
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = undefined;
    delete globalThis.window;
  });

  afterEach(() => {
    posthog.init = originalFns.init;
    posthog.register = originalFns.register;
    posthog.capture = originalFns.capture;
    posthog.identify = originalFns.identify;
    posthog.reset = originalFns.reset;
    __resetAnalyticsForTests();
    console.warn = originalConsoleWarn;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = originalEnvOverride;
  });

  it('initAnalytics returns false without browser context', () => {
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = { VITE_POSTHOG_KEY: 'ph-key' };
    const ok = initAnalytics();
    assert.equal(ok, false);
    assert.equal(calls.init.length, 0);
  });

  it('initAnalytics initializes once with env override and browser window', () => {
    setBrowserWindow('localhost');
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = {
      VITE_POSTHOG_KEY: 'ph-key',
      VITE_POSTHOG_HOST: 'https://example.posthog',
      VITE_POSTHOG_DEFAULTS: '2026-01-30',
    };

    const first = initAnalytics();
    const second = initAnalytics();

    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(calls.init.length, 1);
    assert.equal(calls.register.length, 1);
    assert.equal(calls.register[0][0].environment, 'local');
  });

  it('initAnalytics falls back to built-in key when env key is missing', () => {
    setBrowserWindow('app.example.com');
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = {
      VITE_POSTHOG_HOST: 'https://example.posthog',
      VITE_POSTHOG_DEFAULTS: '2026-01-30',
    };

    const first = initAnalytics();
    const second = initAnalytics();

    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(calls.init.length, 1);
    assert.equal(warnMessages.length, 1);
    assert.ok(warnMessages[0].includes('using built-in fallback key'));
  });

  it('captureEvent/capturePageView/trackScreen forward expected events', () => {
    setBrowserWindow('app.example.com');
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = { VITE_POSTHOG_KEY: 'ph-key' };
    initAnalytics();

    captureEvent('evt', { ok: true });
    capturePageView('/lobby');
    trackScreen('lobby', { fromRouter: true });

    assert.deepEqual(calls.capture[0], ['evt', { ok: true }]);
    assert.equal(calls.capture[1][0], '$pageview');
    assert.equal(calls.capture[1][1].path, '/lobby');
    assert.equal(calls.capture[2][0], 'ui_screen_viewed');
    assert.equal(calls.capture[2][1].screen, 'lobby');
  });

  it('syncUserIdentity deduplicates and resetAnalyticsIdentity clears identity', () => {
    setBrowserWindow('app.example.com');
    globalThis.__SUPERBUCIN_ANALYTICS_ENV__ = { VITE_POSTHOG_KEY: 'ph-key' };
    initAnalytics();

    const userManager = {
      isGuest: false,
      profile: {
        id: 'u1',
        displayName: 'Jon',
        username: 'jkurn',
        avatarUrl: '/a.png',
      },
    };

    syncUserIdentity(userManager);
    syncUserIdentity(userManager);
    assert.equal(calls.identify.length, 1);

    resetAnalyticsIdentity();
    assert.equal(calls.reset, 1);
  });
});

