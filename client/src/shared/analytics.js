import posthog from 'posthog-js';

const _env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const POSTHOG_KEY = _env?.VITE_POSTHOG_KEY;
const POSTHOG_HOST = _env?.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
/** PostHog-recommended SDK defaults version (matches install snippet from dashboard). */
const POSTHOG_DEFAULTS = _env?.VITE_POSTHOG_DEFAULTS || '2026-01-30';
const APP_ENV = _env?.VITE_APP_ENV || null;

let initialized = false;
let identifiedId = null;

function hasBrowser() {
  return typeof window !== 'undefined';
}

function resolveEnvironment() {
  if (APP_ENV) return APP_ENV;
  if (!hasBrowser()) return 'unknown';
  const host = window.location.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'local';
  return 'production';
}

export function initAnalytics() {
  if (initialized) return true;
  if (!hasBrowser() || !POSTHOG_KEY) return false;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: POSTHOG_DEFAULTS,
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
