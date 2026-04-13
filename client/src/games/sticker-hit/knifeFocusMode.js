/**
 * Client-only “knife focus” layout: add `?knifeFocus=1` (or `true` / `yes`) to the page URL
 * (e.g. `/room/ABCD?knifeFocus=1`) to hide PvP column, store entry, scene race strip, and
 * duplicate top-HUD pills; sets `data-knife-focus="true"` on `.sh-hud` and `.sh-layer`.
 */

export function isStickerHitKnifeFocusMode(loc) {
  const l = loc ?? (typeof globalThis !== 'undefined' ? globalThis.window?.location : null);
  if (!l?.search) return false;
  const v = new URLSearchParams(l.search).get('knifeFocus');
  return v === '1' || v === 'true' || v === 'yes';
}
