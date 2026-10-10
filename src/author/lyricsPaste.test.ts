import { describe, expect, it } from 'vitest';
import { lineId, linesFromPaste, orderedLineIds, pasteFromLines } from './lyricsPaste';

// Test strings are placeholders, not lyrics.
describe('lyricsPaste', () => {
  it('numbers non-empty trimmed lines L01..Lnn', () => {
    expect(linesFromPaste('  alpha \n\n beta\r\ngamma\n\n')).toEqual({ L01: 'alpha', L02: 'beta', L03: 'gamma' });
    expect(lineId(9)).toBe('L10');
    expect(lineId(99)).toBe('L100');
  });

  it('orders ids numerically and round-trips', () => {
    const map = { L10: 'j', L02: 'b', L01: 'a' };
    expect(orderedLineIds(map)).toEqual(['L01', 'L02', 'L10']);
    expect(pasteFromLines(map)).toBe('a\nb\nj');
    expect(linesFromPaste(pasteFromLines(linesFromPaste('x\ny')))).toEqual({ L01: 'x', L02: 'y' });
  });
});
