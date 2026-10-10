import { describe, expect, it } from 'vitest';
import { createTimeline, TimelineError, type TimelineLine } from './timeline';

// Fixture ids are synthetic; no lyric content anywhere in tests.
const L = (id: string, startMs: number, endMs: number): TimelineLine => ({ id, startMs, endMs });

/** Three lines with a gap between L02 and L03: [1000,2000) [2000,3000) gap [3500,4000) */
const lines = [L('L01', 1000, 2000), L('L02', 2000, 3000), L('L03', 3500, 4000)];

describe('createTimeline validation', () => {
  it('accepts an empty list', () => {
    const tl = createTimeline([]);
    expect(tl.activeIndexAt(0)).toBe(-1);
    expect(tl.progressAt(0)).toBeNull();
    expect(tl.nextLineAt(0)).toBe(-1);
    expect(tl.diff(0, 10_000)).toEqual([]);
  });

  it('rejects unsorted input', () => {
    expect(() => createTimeline([L('a', 2000, 3000), L('b', 1000, 2000)])).toThrow(TimelineError);
  });

  it('rejects overlapping lines', () => {
    expect(() => createTimeline([L('a', 0, 1500), L('b', 1000, 2000)])).toThrow(/overlaps/);
  });

  it('rejects endMs before startMs', () => {
    expect(() => createTimeline([L('a', 500, 400)])).toThrow(/endMs/);
  });

  it('rejects duplicate ids and non-finite times', () => {
    expect(() => createTimeline([L('a', 0, 1), L('a', 1, 2)])).toThrow(/duplicate/);
    expect(() => createTimeline([L('a', 0, Number.NaN)])).toThrow(/finite/);
  });

  it('allows zero-duration (unsynced) lines; they are never active', () => {
    const tl = createTimeline([L('L01', 0, 0), L('L02', 0, 0), L('L03', 0, 0)]);
    expect(tl.activeIndexAt(0)).toBe(-1);
    expect(tl.activeIndexAt(1)).toBe(-1);
    expect(tl.nextLineAt(-1)).toBe(0);
    expect(tl.nextLineAt(0)).toBe(-1);
  });

  it('does not alias the caller array', () => {
    const src = [L('a', 0, 10)];
    const tl = createTimeline(src);
    src.push(L('b', 10, 20));
    expect(tl.lines).toHaveLength(1);
  });
});

describe('activeIndexAt', () => {
  const tl = createTimeline(lines);

  it('is -1 before the first line', () => {
    expect(tl.activeIndexAt(0)).toBe(-1);
    expect(tl.activeIndexAt(999.99)).toBe(-1);
  });

  it('start is inclusive, end is exclusive', () => {
    expect(tl.activeIndexAt(1000)).toBe(0);
    expect(tl.activeIndexAt(1999.99)).toBe(0);
    expect(tl.activeIndexAt(2000)).toBe(1); // L01's end == L02's start: belongs to L02
    expect(tl.activeIndexAt(2999)).toBe(1);
  });

  it('is -1 inside a gap', () => {
    expect(tl.activeIndexAt(3000)).toBe(-1);
    expect(tl.activeIndexAt(3250)).toBe(-1);
    expect(tl.activeIndexAt(3499)).toBe(-1);
  });

  it('handles the last line and after it', () => {
    expect(tl.activeIndexAt(3500)).toBe(2);
    expect(tl.activeIndexAt(3999)).toBe(2);
    expect(tl.activeIndexAt(4000)).toBe(-1);
    expect(tl.activeIndexAt(1e9)).toBe(-1);
  });
});

describe('progressAt', () => {
  const tl = createTimeline(lines);

  it('is 0 at start, 0.5 mid-line, approaches 1 at the end', () => {
    expect(tl.progressAt(1000)).toBe(0);
    expect(tl.progressAt(1500)).toBe(0.5);
    expect(tl.progressAt(1999)).toBeCloseTo(0.999, 5);
  });

  it('is null when nothing is active', () => {
    expect(tl.progressAt(500)).toBeNull();
    expect(tl.progressAt(3200)).toBeNull();
    expect(tl.progressAt(4000)).toBeNull();
  });
});

describe('nextLineAt (pre-roll)', () => {
  const tl = createTimeline(lines);

  it('returns the upcoming line from before, inside and in a gap', () => {
    expect(tl.nextLineAt(0)).toBe(0);
    expect(tl.nextLineAt(999)).toBe(0);
    expect(tl.nextLineAt(1000)).toBe(1); // already started L01 -> next is L02
    expect(tl.nextLineAt(1500)).toBe(1);
    expect(tl.nextLineAt(3100)).toBe(2); // in the gap, L03 is upcoming
  });

  it('returns -1 once the last line has started', () => {
    expect(tl.nextLineAt(3500)).toBe(-1);
    expect(tl.nextLineAt(9999)).toBe(-1);
  });

  it('pre-roll window: 300 ms before L03 while in the gap', () => {
    const t = 3200;
    const next = tl.nextLineAt(t);
    const line = tl.lines[next];
    expect(line).toBeDefined();
    expect((line?.startMs ?? 0) - t).toBe(300);
  });
});

describe('diff', () => {
  const tl = createTimeline(lines);

  it('is empty when the active line does not change', () => {
    expect(tl.diff(1000, 1500)).toEqual([]);
    expect(tl.diff(3000, 3400)).toEqual([]); // gap to gap
    expect(tl.diff(0, 0)).toEqual([]);
  });

  it('emits exit then enter across a line boundary', () => {
    expect(tl.diff(1900, 2100)).toEqual([
      { type: 'exit', index: 0, lineId: 'L01' },
      { type: 'enter', index: 1, lineId: 'L02' },
    ]);
  });

  it('emits only enter from a gap, only exit into a gap', () => {
    expect(tl.diff(500, 1000)).toEqual([{ type: 'enter', index: 0, lineId: 'L01' }]);
    expect(tl.diff(2500, 3000)).toEqual([{ type: 'exit', index: 1, lineId: 'L02' }]);
  });

  it('seek forward over several lines yields a single exit/enter pair (no replay)', () => {
    expect(tl.diff(1200, 3700)).toEqual([
      { type: 'exit', index: 0, lineId: 'L01' },
      { type: 'enter', index: 2, lineId: 'L03' },
    ]);
  });

  it('seek backward works the same way', () => {
    expect(tl.diff(3700, 1200)).toEqual([
      { type: 'exit', index: 2, lineId: 'L03' },
      { type: 'enter', index: 0, lineId: 'L01' },
    ]);
  });
});

describe('scale', () => {
  const N = 1000;
  // 1000 contiguous 500 ms lines with a 100 ms gap after every 10th.
  const big: TimelineLine[] = [];
  let t = 0;
  for (let i = 0; i < N; i++) {
    big.push(L(`L${String(i + 1).padStart(4, '0')}`, t, t + 500));
    t += 500 + (i % 10 === 9 ? 100 : 0);
  }
  const tl = createTimeline(big);
  const total = t;

  it('matches a linear scan at every 7 ms across the song', () => {
    const linear = (x: number) => big.findIndex((l) => x >= l.startMs && x < l.endMs);
    for (let x = -50; x < total + 50; x += 7) {
      expect(tl.activeIndexAt(x)).toBe(linear(x));
    }
  });

  it('answers 100k lookups quickly (binary search, generous bound)', () => {
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += tl.activeIndexAt((i * 7919) % total);
    const ms = performance.now() - t0;
    expect(acc).not.toBeNaN();
    expect(ms).toBeLessThan(500);
  });
});
