/**
 * Timeline engine: maps song time (ms) to the active line.
 *
 * - Lines are sorted, non-overlapping; at most one is active at any t.
 * - A line is active for t in [startMs, endMs). Gaps (instrumentals) are -1.
 * - Pure and seek-safe: every query is a function of t alone. `diff` is a
 *   state delta between two times, not a replay of everything in between, so a
 *   seek never produces a wrong scene (ARCHITECTURE.md "Timeline engine").
 * - Zero-duration lines (an unsynced song.json has startMs = endMs = 0) are
 *   valid input but can never be active.
 */
import type { LineId } from '@/types/song';

/** Minimal shape the engine needs; `Line` from song.json satisfies it. */
export interface TimelineLine {
  readonly id: LineId;
  readonly startMs: number;
  readonly endMs: number;
}

export type TimelineEvent =
  | { readonly type: 'exit'; readonly index: number; readonly lineId: LineId }
  | { readonly type: 'enter'; readonly index: number; readonly lineId: LineId };

export interface Timeline {
  readonly lines: readonly TimelineLine[];
  /** Index of the line active at t, or -1 when none (before first, in a gap, after last). */
  activeIndexAt(t: number): number;
  /** 0..1 within the active line at t, or null when no line is active. */
  progressAt(t: number): number | null;
  /** Index of the first line whose startMs is strictly after t, or -1. Used for pre-roll. */
  nextLineAt(t: number): number;
  /** Events needed to move from the state at prevT to the state at nextT (0, 1 or 2 events). */
  diff(prevT: number, nextT: number): TimelineEvent[];
}

export class TimelineError extends Error {
  override readonly name = 'TimelineError';
}

function validate(lines: readonly TimelineLine[]): void {
  const seen = new Set<LineId>();
  let prev: TimelineLine | undefined;
  for (const [i, line] of lines.entries()) {
    if (!Number.isFinite(line.startMs) || !Number.isFinite(line.endMs)) {
      throw new TimelineError(`${line.id} (#${i}): startMs/endMs must be finite numbers`);
    }
    if (line.endMs < line.startMs) {
      throw new TimelineError(`${line.id} (#${i}): endMs ${line.endMs} < startMs ${line.startMs}`);
    }
    if (seen.has(line.id)) throw new TimelineError(`duplicate line id ${line.id} (#${i})`);
    seen.add(line.id);
    if (prev) {
      if (line.startMs < prev.startMs) {
        throw new TimelineError(`${line.id} (#${i}) starts before ${prev.id}; lines must be sorted by startMs`);
      }
      if (line.startMs < prev.endMs) {
        throw new TimelineError(`${line.id} (#${i}) overlaps ${prev.id} (${prev.endMs} > ${line.startMs})`);
      }
    }
    prev = line;
  }
}

/** Largest index i with lines[i].startMs <= t, or -1. O(log n). */
function lastStartedBefore(lines: readonly TimelineLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const line = lines[mid];
    if (line !== undefined && line.startMs <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function createTimeline(input: readonly TimelineLine[]): Timeline {
  validate(input);
  const lines: readonly TimelineLine[] = input.map((l) => ({ id: l.id, startMs: l.startMs, endMs: l.endMs }));

  const activeIndexAt = (t: number): number => {
    // Several lines may share a startMs only if all but the last are zero-length
    // (non-overlap guarantees it), so the last started is the only candidate.
    const i = lastStartedBefore(lines, t);
    const line = lines[i];
    return line !== undefined && t < line.endMs ? i : -1;
  };

  const progressAt = (t: number): number | null => {
    const line = lines[activeIndexAt(t)];
    if (line === undefined) return null;
    const p = (t - line.startMs) / (line.endMs - line.startMs);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  };

  const nextLineAt = (t: number): number => {
    const next = lastStartedBefore(lines, t) + 1;
    return next < lines.length ? next : -1;
  };

  const diff = (prevT: number, nextT: number): TimelineEvent[] => {
    const from = activeIndexAt(prevT);
    const to = activeIndexAt(nextT);
    if (from === to) return [];
    const events: TimelineEvent[] = [];
    const fromLine = lines[from];
    if (fromLine !== undefined) events.push({ type: 'exit', index: from, lineId: fromLine.id });
    const toLine = lines[to];
    if (toLine !== undefined) events.push({ type: 'enter', index: to, lineId: toLine.id });
    return events;
  };

  return { lines, activeIndexAt, progressAt, nextLineAt, diff };
}
