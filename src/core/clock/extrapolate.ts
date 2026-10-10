/**
 * Drift-corrected extrapolation for adapters that get sparse position reports
 * (Spotify embed: every ~0.5-1 s). Pure functions over an immutable state so
 * tests inject time explicitly (ARCHITECTURE.md "The song clock").
 *
 * Rules:
 * - While playing, position advances at 1x from the last anchor.
 * - On a report: error = reported - predicted. |error| > SNAP_THRESHOLD_MS
 *   snaps; otherwise the truth becomes the new anchor and the *displayed*
 *   value eases linearly from the old prediction to the truth over EASE_MS,
 *   so there is no visible jump at the report instant.
 * - While paused there is nothing to ease: reports and seeks snap.
 *
 * Note: a negative correction (we were ahead) makes displayed time run slower
 * or briefly backwards during the ease; at most SNAP_THRESHOLD_MS / EASE_MS
 * = 1.25x reverse. Scenes must tolerate tiny progress regressions.
 */

export const SNAP_THRESHOLD_MS = 250;
export const EASE_MS = 200;

export interface Correction {
  /** Host time the ease started. */
  readonly startAt: number;
  /** reported - predicted at that instant. Displayed = truth - amount * (1 - k). */
  readonly amount: number;
}

export interface ExtrapolatorState {
  /** True media position at `baseAt` (the last trusted anchor). */
  readonly basePos: number;
  /** Host time (performance.now ms) of the anchor. */
  readonly baseAt: number;
  readonly playing: boolean;
  readonly correction: Correction | null;
}

export function createExtrapolator(pos: number, now: number, playing: boolean): ExtrapolatorState {
  return { basePos: pos, baseAt: now, playing, correction: null };
}

/** Where the media really is, by our model, ignoring the visual ease. */
export function truePositionAt(s: ExtrapolatorState, now: number): number {
  return s.playing ? s.basePos + Math.max(0, now - s.baseAt) : s.basePos;
}

function residual(c: Correction | null, now: number): number {
  if (!c) return 0;
  const k = (now - c.startAt) / EASE_MS;
  if (k >= 1) return 0;
  return c.amount * (1 - (k < 0 ? 0 : k));
}

/** The position to present to scenes at host time `now`. */
export function positionAt(s: ExtrapolatorState, now: number): number {
  return truePositionAt(s, now) - residual(s.correction, now);
}

/** New position report from the media. */
export function applyReport(
  s: ExtrapolatorState,
  reportedPos: number,
  now: number,
  playing: boolean = s.playing,
): ExtrapolatorState {
  if (!Number.isFinite(reportedPos)) return s;
  const predicted = positionAt(s, now);
  const error = reportedPos - predicted;
  if (!playing || !s.playing || Math.abs(error) > SNAP_THRESHOLD_MS) {
    return { basePos: reportedPos, baseAt: now, playing, correction: null };
  }
  if (error === 0) return { basePos: reportedPos, baseAt: now, playing, correction: null };
  return { basePos: reportedPos, baseAt: now, playing, correction: { startAt: now, amount: error } };
}

/** User or API seek: always a hard jump. */
export function applySeek(s: ExtrapolatorState, pos: number, now: number): ExtrapolatorState {
  return { basePos: pos, baseAt: now, playing: s.playing, correction: null };
}

/** Play/pause transition at `now`. Keeps the current displayed position, drops any ease. */
export function setPlaying(s: ExtrapolatorState, playing: boolean, now: number): ExtrapolatorState {
  if (playing === s.playing) return s;
  return { basePos: positionAt(s, now), baseAt: now, playing, correction: null };
}
