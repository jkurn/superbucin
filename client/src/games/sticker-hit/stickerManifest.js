/** Default client timeout when requesting sticker manifest from the game server. */
export const DEFAULT_STICKER_MANIFEST_TIMEOUT_MS = 8000;

/**
 * @param {string} pathname
 * @param {string} backendOrigin
 */
export function toBackendAssetUrl(pathname, backendOrigin) {
  if (!pathname) return '';
  return `${backendOrigin}${pathname}`;
}

/**
 * @param {{
 *   backendOrigin: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   manifestPath?: string,
 * }} opts
 * @returns {Promise<{ stickers: { src: string, durationMs: number }[], error: null | 'timeout' | 'http' | 'parse' | 'network' }>}
 */
export async function fetchStickerManifest(opts) {
  const {
    backendOrigin,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_STICKER_MANIFEST_TIMEOUT_MS,
    manifestPath = '/api/sticker-hit/sticker-manifest',
  } = opts;

  const url = `${backendOrigin}${manifestPath}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) {
      return { stickers: [], error: 'http' };
    }
    const data = await res.json();
    if (!Array.isArray(data?.stickers)) {
      return { stickers: [], error: 'parse' };
    }
    const stickers = data.stickers
      .filter((x) => x && typeof x.src === 'string' && x.src.length > 0)
      .map((x) => ({
        src: toBackendAssetUrl(x.src, backendOrigin),
        durationMs: Number.isFinite(x.durationMs) ? Math.max(200, Number(x.durationMs)) : 1200,
      }));
    return { stickers, error: null };
  } catch (e) {
    clearTimeout(tid);
    if (e?.name === 'AbortError') {
      return { stickers: [], error: 'timeout' };
    }
    return { stickers: [], error: 'network' };
  }
}
