import { describe, expect, it } from 'vitest';
import {
  applyReport,
  applySeek,
  createExtrapolator,
  EASE_MS,
  positionAt,
  setPlaying,
  SNAP_THRESHOLD_MS,
  truePositionAt,
} from './extrapolate';

describe('extrapolate', () => {
  it('advances at 1x while playing and holds while paused', () => {
    const playing = createExtrapolator(10_000, 1000, true);
    expect(positionAt(playing, 1000)).toBe(10_000);
    expect(positionAt(playing, 1500)).toBe(10_500);
    expect(positionAt(playing, 900)).toBe(10_000); // never before the anchor

    const paused = createExtrapolator(10_000, 1000, false);
    expect(positionAt(paused, 5000)).toBe(10_000);
  });

  it('a report matching the prediction changes nothing visible', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1000, 1000);
    expect(s1.correction).toBeNull();
    expect(positionAt(s1, 1000)).toBe(1000);
    expect(positionAt(s1, 1250)).toBe(1250);
  });

  it('a small positive error is eased over EASE_MS with no jump at the report', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1100, 1000); // we predicted 1000, truth is 1100 (+100)
    expect(positionAt(s1, 1000)).toBe(1000); // continuity at the report instant
    expect(positionAt(s1, 1000 + EASE_MS / 2)).toBe(1100 + EASE_MS / 2 - 50);
    expect(positionAt(s1, 1000 + EASE_MS)).toBe(1100 + EASE_MS);
    expect(positionAt(s1, 1000 + EASE_MS + 300)).toBe(1100 + EASE_MS + 300);
    expect(truePositionAt(s1, 1000)).toBe(1100);
  });

  it('a small negative error eases too (we were ahead)', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 920, 1000); // -80
    expect(positionAt(s1, 1000)).toBe(1000);
    expect(positionAt(s1, 1000 + EASE_MS)).toBe(920 + EASE_MS);
    // Never worse than the documented bound during the ease.
    const mid = positionAt(s1, 1000 + EASE_MS / 2);
    expect(mid).toBeGreaterThanOrEqual(1000 - SNAP_THRESHOLD_MS);
  });

  it('an error above the snap threshold snaps immediately', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1000 + SNAP_THRESHOLD_MS + 1, 1000);
    expect(s1.correction).toBeNull();
    expect(positionAt(s1, 1000)).toBe(1000 + SNAP_THRESHOLD_MS + 1);

    const s2 = applyReport(s0, 100, 1000); // far behind: snap backwards
    expect(positionAt(s2, 1000)).toBe(100);
  });

  it('errors exactly at the threshold are eased, not snapped', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1000 + SNAP_THRESHOLD_MS, 1000);
    expect(s1.correction?.amount).toBe(SNAP_THRESHOLD_MS);
  });

  it('a report arriving mid-ease keeps continuity against the displayed value', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1100, 1000); // +100, easing
    const tMid = 1000 + EASE_MS / 2;
    const shown = positionAt(s1, tMid);
    const s2 = applyReport(s1, shown + 60, tMid); // new truth is 60 ahead of what we show
    expect(positionAt(s2, tMid)).toBeCloseTo(shown, 9);
    expect(s2.correction?.amount).toBeCloseTo(60, 9);
    expect(positionAt(s2, tMid + EASE_MS)).toBeCloseTo(shown + 60 + EASE_MS, 9);
  });

  it('reports while paused snap, and pausing drops any ease', () => {
    const paused = createExtrapolator(5000, 0, false);
    const r = applyReport(paused, 5100, 100);
    expect(r.correction).toBeNull();
    expect(positionAt(r, 100)).toBe(5100);

    const playing = applyReport(createExtrapolator(0, 0, true), 1100, 1000);
    const p = setPlaying(playing, false, 1050);
    expect(p.playing).toBe(false);
    expect(p.correction).toBeNull();
    expect(positionAt(p, 1050)).toBe(positionAt(playing, 1050));
    expect(positionAt(p, 9999)).toBe(positionAt(playing, 1050));
  });

  it('a report that also changes the playing flag snaps', () => {
    const s0 = createExtrapolator(0, 0, true);
    const s1 = applyReport(s0, 1050, 1000, false);
    expect(s1.playing).toBe(false);
    expect(s1.correction).toBeNull();
    expect(positionAt(s1, 2000)).toBe(1050);
  });

  it('seek is a hard jump that clears corrections', () => {
    const s0 = applyReport(createExtrapolator(0, 0, true), 1100, 1000);
    const s1 = applySeek(s0, 60_000, 1020);
    expect(s1.correction).toBeNull();
    expect(positionAt(s1, 1020)).toBe(60_000);
    expect(positionAt(s1, 1120)).toBe(60_100);
  });

  it('ignores non-finite reports and is a no-op for same-state setPlaying', () => {
    const s0 = createExtrapolator(0, 0, true);
    expect(applyReport(s0, Number.NaN, 10)).toBe(s0);
    expect(setPlaying(s0, true, 10)).toBe(s0);
  });
});
