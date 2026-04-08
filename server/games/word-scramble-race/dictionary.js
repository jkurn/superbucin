/**
 * Validates English words via Free Dictionary API (no API key).
 * https://dictionaryapi.dev/
 *
 * Reliability policy:
 * - 2xx => valid
 * - 404 => invalid
 * - network failure / timeout / 5xx => fail-open (accept) so gameplay never hard-breaks
 */
const CACHE_MAX = 2000;
const cache = new Map();

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, value);
}

export async function isValidEnglishWord(word) {
  const w = word.toLowerCase().trim();
  if (w.length < 3) return false;
  if (!/^[a-z]+$/i.test(w)) return false;

  if (cache.has(w)) return cache.get(w);

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      cacheSet(w, true);
      return true;
    }
    if (res.status === 404) {
      cacheSet(w, false);
      return false;
    }
    // Service errors should not make Word Scramble unplayable.
    cacheSet(w, true);
    return true;
  } catch {
    // Network/timeouts are treated as temporary dictionary outage => allow word.
    cacheSet(w, true);
    return true;
  }
}
