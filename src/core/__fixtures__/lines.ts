/**
 * Synthetic timeline for dev and tests. Ids are F01.. (not L..) so nothing
 * here can be mistaken for an authored line, and there is no lyric content.
 * 8 lines over ~12 s with a gap after F04 and a longer "hook" line at F08.
 */
import type { TimelineLine } from '@/core/timeline/timeline';

export const FIXTURE_LINES: readonly TimelineLine[] = [
  { id: 'F01', startMs: 500, endMs: 1500 },
  { id: 'F02', startMs: 1500, endMs: 2500 },
  { id: 'F03', startMs: 2500, endMs: 3500 },
  { id: 'F04', startMs: 3500, endMs: 4500 },
  { id: 'F05', startMs: 5500, endMs: 6500 },
  { id: 'F06', startMs: 6500, endMs: 7500 },
  { id: 'F07', startMs: 7500, endMs: 8500 },
  { id: 'F08', startMs: 8500, endMs: 11_500 },
];

export const FIXTURE_DURATION_MS = 12_000;
