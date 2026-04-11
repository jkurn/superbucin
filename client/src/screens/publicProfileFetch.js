/** Default timeout for `/api/profile/:username` (slow CDN / cold server). */
export const DEFAULT_PUBLIC_PROFILE_TIMEOUT_MS = 12_000;

/**
 * Fetches public profile JSON with AbortSignal timeout (dependency degradation).
 * @param {string} username
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<
 *   | { ok: true, data: { profile: object, stats?: unknown[], achievements?: unknown[] } }
 *   | { ok: false, kind: 'http', status: number }
 *   | { ok: false, kind: 'timeout' }
 *   | { ok: false, kind: 'network' }
 *   | { ok: false, kind: 'parse' }
 * >}
 */
export async function fetchPublicProfile(username, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PUBLIC_PROFILE_TIMEOUT_MS;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`/api/profile/${encodeURIComponent(username)}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(tid);
    if (!res.ok) {
      return { ok: false, kind: 'http', status: res.status };
    }
    const data = await res.json();
    if (!data || typeof data !== 'object' || !data.profile) {
      return { ok: false, kind: 'parse' };
    }
    return { ok: true, data };
  } catch (e) {
    clearTimeout(tid);
    if (e?.name === 'AbortError') {
      return { ok: false, kind: 'timeout' };
    }
    return { ok: false, kind: 'network' };
  }
}
