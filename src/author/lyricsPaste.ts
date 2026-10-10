/** Pure helpers for the lyrics paste box. No I/O. */
import type { LineId, LocalLyrics } from '@/types/song';

export const lineId = (index: number): LineId => `L${String(index + 1).padStart(2, '0')}`;

/** One lyric line per text line; blank lines are dropped; ids are L01..Lnn in order. */
export function linesFromPaste(text: string): LocalLyrics {
  const out: Record<LineId, string> = {};
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((l, i) => {
      out[lineId(i)] = l;
    });
  return out;
}

/** Ids in numeric order (L01, L02, ... L10), independent of object key order. */
export function orderedLineIds(lyrics: LocalLyrics): LineId[] {
  return Object.keys(lyrics).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export function pasteFromLines(lyrics: LocalLyrics): string {
  return orderedLineIds(lyrics)
    .map((id) => lyrics[id] ?? '')
    .join('\n');
}
