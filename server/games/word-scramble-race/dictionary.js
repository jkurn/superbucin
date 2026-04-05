/**
 * Validates English words via Free Dictionary API (no API key).
 * https://dictionaryapi.dev/
 */
const CACHE_MAX = 2000;
const cache = new Map();

export async function isValidEnglishWord(word) {
  const w = word.toLowerCase().trim();
  if (w.length < 3) return false;
  if (!/^[a-z]+$/i.test(w)) return false;

  if (cache.has(w)) return cache.get(w);

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`;
  let ok = false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    ok = res.ok;
  } catch {
    ok = false;
  }

  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(w, ok);
  return ok;
}
