/**
 * Client-only “knife focus” layout: add `?knifeFocus=1` (or `true` / `yes`) to the page URL
 * (e.g. `/room/ABCD?knifeFocus=1`) to hide PvP column, store entry, scene race strip, and
 * duplicate top-HUD pills; sets `data-knife-focus="true"` on `.sh-hud` and `.sh-layer`.
 *
 * Persistence: the Router strips query strings on `/` → `/room/{code}` navigation, so the
 * flag is also cached in `sessionStorage` so it survives within a single tab session.
 * Pass `?knifeFocus=0` (or `false` / `no`) to clear the cache and disable the mode.
 */

const STORAGE_KEY = 'stickerHitKnifeFocus';

function readSession(storage) {
  try { return storage?.getItem?.(STORAGE_KEY); } catch (_e) { return null; }
}

function writeSession(storage, value) {
  try {
    if (value === null) storage?.removeItem?.(STORAGE_KEY);
    else storage?.setItem?.(STORAGE_KEY, value);
  } catch (_e) { /* quota / private mode */ }
}

/**
 * @param {{ search?: string } | null | undefined} [loc]
 * @param {Storage | null | undefined} [storage] — defaults to globalThis.sessionStorage
 */
export function isStickerHitKnifeFocusMode(loc, storage) {
  const l = loc ?? (typeof globalThis !== 'undefined' ? globalThis.window?.location : null);
  const s = storage ?? (typeof globalThis !== 'undefined' ? globalThis.sessionStorage : null);
  if (l?.search) {
    const v = new URLSearchParams(l.search).get('knifeFocus');
    if (v !== null) {
      const on = v === '1' || v === 'true' || v === 'yes';
      const off = v === '0' || v === 'false' || v === 'no';
      if (on) {
        writeSession(s, '1');
        return true;
      }
      if (off) {
        writeSession(s, null);
        return false;
      }
      // Unknown value → fall through to session cache so we don't thrash state.
    }
  }
  return readSession(s) === '1';
}
