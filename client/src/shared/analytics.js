import posthog from 'posthog-js';

function envSource() {
  const override = globalThis.__SUPERBUCIN_ANALYTICS_ENV__;
  if (override && typeof override === 'object') return override;
  return typeof import.meta !== 'undefined' ? import.meta.env : undefined;
}

let initialized = false;
let identifiedId = null;

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
  return {
    key: env?.VITE_POSTHOG_KEY,
    host: env?.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    // PostHog-recommended SDK defaults version (matches install snippet from dashboard).
    defaults: env?.VITE_POSTHOG_DEFAULTS || '2026-01-30',
  };
}

export function initAnalytics() {
  const cfg = resolvePosthogConfig();
  if (initialized) return true;
  if (!hasBrowser() || !cfg.key) return false;

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
  posthog.capture(eventName, properties);
}

export function capturePageView(path) {
  if (!analyticsReady() || !hasBrowser()) return;
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
  posthog.reset();
}

export function __resetAnalyticsForTests() {
  initialized = false;
  identifiedId = null;
}
