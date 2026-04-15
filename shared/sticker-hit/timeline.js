/**
 * Sticker Hit — shared timeline math (server + client must stay identical).
 *
 *   serverNow ──► elapsed ──► segment integration ──► rotation degrees
 */

export function normalizeDeg(v) {
  const n = v % 360;
  return n < 0 ? n + 360 : n;
}

/**
 * Current active segment's rotation speed (degrees per second, signed).
 * Positive = CW in disc-local frame, negative = CCW. Returns 0 if no segment applies.
 *
 * @param {{ startedAt: number, segments: { atMs: number, dps: number }[] } | null | undefined} timeline
 * @param {number} [now]
 */
export function currentSegmentDps(timeline, now = Date.now()) {
  if (!timeline) return 0;
  const elapsed = Math.max(0, now - timeline.startedAt);
  const segments = timeline.segments || [];
  let active = 0;
  for (let i = 0; i < segments.length; i += 1) {
    if (elapsed >= segments[i].atMs) active = segments[i].dps;
    else break;
  }
  return active;
}

/**
 * @param {{ startedAt: number, initialAngle: number, segments: { atMs: number, dps: number }[] }} timeline
 * @param {number} [now]
 */
export function targetRotationDeg(timeline, now = Date.now()) {
  if (!timeline) return 0;
  const elapsed = Math.max(0, now - timeline.startedAt);
  let angle = timeline.initialAngle;
  const segments = timeline.segments || [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const segStart = seg.atMs;
    if (elapsed <= segStart) break;
    const nextStart = segments[i + 1]?.atMs ?? elapsed;
    const segEnd = Math.min(elapsed, nextStart);
    const segElapsed = Math.max(0, segEnd - segStart);
    angle += (seg.dps * segElapsed) / 1000;
    if (segEnd >= elapsed) break;
  }
  return normalizeDeg(angle);
}
