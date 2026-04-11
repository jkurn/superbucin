import posthog from 'posthog-js';

// Public PostHog project key (client-side key, not a secret).
const DEFAULT_POSTHOG_KEY = 'phc_vmb7NHFvtRdRsA7C42LFpWmyz3kT6veXrqe9AACAHhJh';
const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

function envSource() {
  const override = globalThis.__SUPERBUCIN_ANALYTICS_ENV__;
  if (override && typeof override === 'object') return override;
  return typeof import.meta !== 'undefined' ? import.meta.env : undefined;
}

let initialized = false;
let identifiedId = null;
let missingKeyWarned = false;
/** True after we warn that `posthog-js` has no `init` (e.g. Node test runner vs browser bundle). */
let sdkSurfaceUnavailableWarned = false;

function hasBrowser() {
  return typeof window !== 'undefined';
}

function resolveEnvironment() {
  const appEnv = envSource()?.VITE_APP_ENV || null;
  if (appEnv) return appEnv;
  if (!hasBrowser()) return 'unknown';
  const host = window.location.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'local';
  return 'production';
}

function resolvePosthogConfig() {
  const env = envSource();
  const keyFromEnv = env?.VITE_POSTHOG_KEY;
  const usingFallbackKey = !keyFromEnv;
  return {
    key: keyFromEnv || DEFAULT_POSTHOG_KEY,
    usingFallbackKey,
    host: env?.VITE_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
    // PostHog-recommended SDK defaults version (matches install snippet from dashboard).
    defaults: env?.VITE_POSTHOG_DEFAULTS || '2026-01-30',
  };
}

export function initAnalytics() {
  const cfg = resolvePosthogConfig();
  if (initialized) return true;
  if (!hasBrowser()) return false;
  if (!cfg.key) {
    if (!missingKeyWarned) {
      missingKeyWarned = true;
      console.warn('[analytics] PostHog key missing. Analytics disabled.');
    }
    return false;
  }
  if (cfg.usingFallbackKey && !missingKeyWarned) {
    missingKeyWarned = true;
    console.warn('[analytics] VITE_POSTHOG_KEY missing; using built-in fallback key.');
  }

  if (typeof posthog.init !== 'function') {
    if (!sdkSurfaceUnavailableWarned) {
      sdkSurfaceUnavailableWarned = true;
      console.warn('[analytics] PostHog SDK init is unavailable in this environment; analytics disabled.');
    }
    return false;
  }

  posthog.init(cfg.key, {
    api_host: cfg.host,
    defaults: cfg.defaults,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    person_profiles: 'identified_only',
  });

  posthog.register({
    app: 'superbucin',
    environment: resolveEnvironment(),
  });

  initialized = true;
  return true;
}

function analyticsReady() {
  return initialized || initAnalytics();
}

export function captureEvent(eventName, properties = {}) {
  if (!analyticsReady()) return;
  if (typeof posthog.capture !== 'function') return;
  posthog.capture(eventName, properties);
}

export function capturePageView(path) {
  if (!analyticsReady() || !hasBrowser()) return;
  if (typeof posthog.capture !== 'function') return;
  posthog.capture('$pageview', {
    path,
    url: window.location.href,
  });
}

/** Full-screen UI step (SPA routes that do not always change the URL). */
export function trackScreen(screen, properties = {}) {
  captureEvent('ui_screen_viewed', { screen, ...properties });
}

export function syncUserIdentity(userManager) {
  if (!analyticsReady() || !userManager?.profile) return;

  const profile = userManager.profile;
  const distinctId = userManager.isGuest
    ? `guest:${profile.id || 'anonymous'}`
    : `user:${profile.id}`;

  if (identifiedId === distinctId) return;

  identifiedId = distinctId;
  if (typeof posthog.identify !== 'function') return;
  posthog.identify(distinctId, {
    displayName: profile.displayName || null,
    username: profile.username || null,
    avatarUrl: profile.avatarUrl || null,
    isGuest: !!userManager.isGuest,
  });
}

export function resetAnalyticsIdentity() {
  if (!analyticsReady()) return;
  identifiedId = null;
  if (typeof posthog.reset !== 'function') return;
  posthog.reset();
}

export function __resetAnalyticsForTests() {
  initialized = false;
  identifiedId = null;
  missingKeyWarned = false;
  sdkSurfaceUnavailableWarned = false;
}
