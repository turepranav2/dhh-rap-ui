/**
 * Tap-to-sync model (pure). The owner presses a key at each line start; the
 * cursor advances. Timings become song.json lines via toLines().
 */
import type { Line, LineId } from '@/types/song';

export interface SyncState {
  readonly ids: readonly LineId[];
  /** Raw tapped start per id (no reaction offset applied yet). */
  readonly starts: ReadonlyMap<LineId, number>;
  readonly voices: ReadonlyMap<LineId, string>;
  /** Index of the next line to tap. */
  readonly cursor: number;
}

export function createSync(ids: readonly LineId[]): SyncState {
  return { ids, starts: new Map(), voices: new Map(), cursor: 0 };
}

/** Pre-fill from existing song.json lines (only a leading run of synced lines counts). */
export function fromLines(ids: readonly LineId[], lines: readonly Line[]): SyncState {
  const byId = new Map(lines.map((l) => [l.id, l] as const));
  const starts = new Map<LineId, number>();
  const voices = new Map<LineId, string>();
  let cursor = 0;
  for (const id of ids) {
    const l = byId.get(id);
    if (!l || l.endMs <= l.startMs) break;
    starts.set(id, l.startMs);
    voices.set(id, l.voice);
    cursor++;
  }
  return { ids, starts, voices, cursor };
}

export const currentId = (s: SyncState): LineId | undefined => s.ids[s.cursor];
export const isComplete = (s: SyncState): boolean => s.cursor >= s.ids.length;

/** Record a tap at tMs for the cursor line. Ignored if complete or not after the previous start. */
export function tap(s: SyncState, tMs: number, voice: string): SyncState {
  const id = currentId(s);
  if (id === undefined) return s;
  const prevId = s.ids[s.cursor - 1];
  const prevStart = prevId === undefined ? -Infinity : (s.starts.get(prevId) ?? -Infinity);
  if (!(tMs > prevStart)) return s;
  const starts = new Map(s.starts).set(id, Math.max(0, tMs));
  const voices = new Map(s.voices).set(id, voice);
  return { ...s, starts, voices, cursor: s.cursor + 1 };
}

export function undo(s: SyncState): SyncState {
  if (s.cursor === 0) return s;
  const id = s.ids[s.cursor - 1];
  const starts = new Map(s.starts);
  const voices = new Map(s.voices);
  if (id !== undefined) {
    starts.delete(id);
    voices.delete(id);
  }
  return { ...s, starts, voices, cursor: s.cursor - 1 };
}

/** Move the cursor back to `index`, dropping that line and everything after it. */
export function retapFrom(s: SyncState, index: number): SyncState {
  let out = s;
  while (out.cursor > Math.max(0, index)) out = undo(out);
  return out;
}

/** Nudge a tapped start by deltaMs, keeping order with its neighbours. */
export function nudge(s: SyncState, id: LineId, deltaMs: number): SyncState {
  const cur = s.starts.get(id);
  const i = s.ids.indexOf(id);
  if (cur === undefined || i < 0) return s;
  const prevId = s.ids[i - 1];
  const nextId = s.ids[i + 1];
  const lo = prevId === undefined ? 0 : (s.starts.get(prevId) ?? 0) + 1;
  const hiRaw = nextId === undefined ? undefined : s.starts.get(nextId);
  const hi = hiRaw === undefined ? Infinity : hiRaw - 1;
  const next = Math.min(hi, Math.max(lo, cur + deltaMs));
  return { ...s, starts: new Map(s.starts).set(id, next) };
}

export interface ToLinesOptions {
  durationMs: number;
  section: string;
  defaultVoice: string;
  /** Added to every tapped start (negative compensates reaction time). */
  reactionOffsetMs?: number;
  /** Length of the last line, which has no "next start". */
  lastLineMs?: number;
  /** Keep intent/scene/tags from these when ids match (re-sync of an authored song). */
  existing?: readonly Line[];
}

/** Lines for the tapped prefix, sorted, non-overlapping, intent blank unless preserved. */
export function toLines(s: SyncState, o: ToLinesOptions): Line[] {
  const off = o.reactionOffsetMs ?? 0;
  const lastLen = o.lastLineMs ?? 4000;
  const keep = new Map((o.existing ?? []).map((l) => [l.id, l] as const));
  const tapped = s.ids.slice(0, s.cursor);
  const starts = tapped.map((id) => Math.min(o.durationMs, Math.max(0, (s.starts.get(id) ?? 0) + off)));
  return tapped.map((id, i) => {
    const startMs = Math.round(starts[i] ?? 0);
    const nextStart = starts[i + 1];
    const endRaw = nextStart === undefined ? Math.min(o.durationMs, startMs + lastLen) : nextStart;
    const endMs = Math.max(startMs + 1, Math.round(endRaw));
    const prev = keep.get(id);
    const line: Line = {
      id,
      startMs,
      endMs,
      section: prev?.section ?? o.section,
      voice: s.voices.get(id) ?? prev?.voice ?? o.defaultVoice,
      intent: prev?.intent ?? '',
      scene: prev?.scene ?? id,
    };
    if (prev?.tags) line.tags = prev.tags;
    return line;
  });
}
