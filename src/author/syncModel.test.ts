import { describe, expect, it } from 'vitest';
import { createSync, currentId, fromLines, isComplete, nudge, retapFrom, tap, toLines, undo } from './syncModel';
import type { Line } from '@/types/song';

const IDS = ['L01', 'L02', 'L03'];
const OPTS = { durationMs: 20_000, section: 'main', defaultVoice: 'A' };

describe('syncModel', () => {
  it('taps advance the cursor and must be strictly after the previous start', () => {
    let s = createSync(IDS);
    expect(currentId(s)).toBe('L01');
    s = tap(s, 1000, 'A');
    s = tap(s, 900, 'A'); // ignored: not after 1000
    expect(s.cursor).toBe(1);
    s = tap(s, 2500, 'B');
    s = tap(s, 4000, 'A');
    expect(isComplete(s)).toBe(true);
    expect(tap(s, 9000, 'A')).toBe(s); // complete: ignored
    expect(s.voices.get('L02')).toBe('B');
  });

  it('undo and retapFrom drop taps', () => {
    let s = createSync(IDS);
    s = tap(tap(tap(s, 1000, 'A'), 2000, 'A'), 3000, 'A');
    s = undo(s);
    expect(s.cursor).toBe(2);
    expect(s.starts.has('L03')).toBe(false);
    s = retapFrom(s, 0);
    expect(s.cursor).toBe(0);
    expect(s.starts.size).toBe(0);
    expect(undo(s)).toBe(s);
  });

  it('nudge keeps order with neighbours', () => {
    let s = createSync(IDS);
    s = tap(tap(tap(s, 1000, 'A'), 2000, 'A'), 3000, 'A');
    s = nudge(s, 'L02', -5000);
    expect(s.starts.get('L02')).toBe(1001);
    s = nudge(s, 'L02', +5000);
    expect(s.starts.get('L02')).toBe(2999);
    s = nudge(s, 'L01', -5000);
    expect(s.starts.get('L01')).toBe(0);
    expect(nudge(s, 'L09', 10)).toBe(s);
  });

  it('toLines: ends at the next start, last line gets lastLineMs capped by duration, offset applied', () => {
    let s = createSync(IDS);
    s = tap(tap(tap(s, 1000, 'A'), 2500, 'B'), 18_000, 'A');
    const lines = toLines(s, { ...OPTS, reactionOffsetMs: -100 });
    expect(lines.map((l) => [l.id, l.startMs, l.endMs, l.voice, l.intent, l.scene])).toEqual([
      ['L01', 900, 2400, 'A', '', 'L01'],
      ['L02', 2400, 17_900, 'B', '', 'L02'],
      ['L03', 17_900, 20_000, 'A', '', 'L03'],
    ]);
    expect(lines.every((l) => l.section === 'main')).toBe(true);
  });

  it('toLines only emits the tapped prefix and never produces zero-length lines', () => {
    let s = createSync(IDS);
    s = tap(s, 5000, 'A');
    s = tap(s, 5000.4, 'A');
    const lines = toLines(s, OPTS);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.endMs).toBeGreaterThan(lines[0]?.startMs ?? 0);
    expect(lines[1]?.startMs).toBe(5000);
    expect(lines[1]?.endMs).toBe(9000);
  });

  it('toLines preserves intent/scene/tags from existing lines by id', () => {
    const existing: Line[] = [
      { id: 'L01', startMs: 0, endMs: 1, section: 'hook', voice: 'Z', intent: 'about x', scene: 'L01', tags: ['t'] },
    ];
    let s = createSync(IDS);
    s = tap(s, 100, 'A');
    const [l] = toLines(s, { ...OPTS, existing });
    expect(l?.intent).toBe('about x');
    expect(l?.section).toBe('hook');
    expect(l?.voice).toBe('A'); // tapped voice wins
    expect(l?.tags).toEqual(['t']);
  });

  it('fromLines pre-fills a leading synced run only', () => {
    const lines: Line[] = [
      { id: 'L01', startMs: 100, endMs: 200, section: 's', voice: 'A', intent: '', scene: 'L01' },
      { id: 'L02', startMs: 0, endMs: 0, section: 's', voice: 'A', intent: '', scene: 'L02' },
      { id: 'L03', startMs: 300, endMs: 400, section: 's', voice: 'A', intent: '', scene: 'L03' },
    ];
    const s = fromLines(IDS, lines);
    expect(s.cursor).toBe(1);
    expect(s.starts.get('L01')).toBe(100);
    expect(s.starts.has('L03')).toBe(false);
  });
});
