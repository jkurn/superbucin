/**
 * Parse ?challenge=…&game=… from viral result-share URLs (see VictoryScreen).
 * Game type validity is checked by the caller against GameRegistry.
 */

const MAX_CHALLENGE_LEN = 120;

/**
 * @param {string} [search]
 * @returns {{ challenge: string|null, raw_game: string|null }}
 */
export function parseLobbyDeepLinkSearch(search) {
  if (!search || search === '?') {
    return { challenge: null, raw_game: null };
  }
  const q = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  let challenge = params.get('challenge');
  if (challenge) {
    challenge = challenge.trim();
    if (challenge.length > MAX_CHALLENGE_LEN) {
      challenge = challenge.slice(0, MAX_CHALLENGE_LEN);
    }
    if (!challenge) challenge = null;
  }
  const raw = params.get('game');
  const raw_game = raw && String(raw).trim() ? String(raw).trim() : null;
  return { challenge, raw_game };
}
