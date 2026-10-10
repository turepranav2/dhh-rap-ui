import { describe, expect, it, vi } from 'vitest';
import { ManualClock } from './ManualClock';
import type { ClockStatus } from './SongClock';

/** Fake monotonic time source. */
function fakeNow(start = 1000) {
  let t = start;
  return { fn: () => t, advance: (ms: number) => (t += ms) };
}

describe('ManualClock', () => {
  it('starts paused at startMs and does not advance until play', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 10_000, nowFn: fn, startMs: 250 });
    expect(c.status).toBe('paused');
    expect(c.now()).toBe(250);
    advance(500);
    expect(c.now()).toBe(250);
  });

  it('advances with the time source while playing and freezes on pause', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 10_000, nowFn: fn });
    c.play();
    advance(300);
    expect(c.now()).toBe(300);
    c.pause();
    advance(1000);
    expect(c.now()).toBe(300);
    c.play();
    advance(200);
    expect(c.now()).toBe(500);
  });

  it('seek works while paused and while playing, clamps, and emits onSeek', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 10_000, nowFn: fn });
    const seeks: number[] = [];
    c.onSeek((ms) => seeks.push(ms));

    c.seek(4000);
    expect(c.now()).toBe(4000);
    c.play();
    advance(100);
    c.seek(2000);
    advance(50);
    expect(c.now()).toBe(2050);
    c.seek(-5);
    c.seek(99_999);
    expect(seeks).toEqual([4000, 2000, 0, 10_000]);
  });

  it('flips to ended at duration and restarts from 0 on play', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 1000, nowFn: fn });
    const statuses: ClockStatus[] = [];
    c.onPlayPause((s) => statuses.push(s));

    c.play();
    advance(1500);
    expect(c.now()).toBe(1000);
    expect(c.status).toBe('ended');
    c.pause(); // no-op when ended
    expect(c.status).toBe('ended');
    c.play();
    expect(c.now()).toBe(0);
    expect(statuses).toEqual(['playing', 'ended', 'playing']);
  });

  it('seeking after ended returns to paused', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 1000, nowFn: fn });
    c.play();
    advance(2000);
    c.now();
    c.seek(500);
    expect(c.status).toBe('paused');
    expect(c.now()).toBe(500);
  });

  it('does not emit duplicate status events', () => {
    const c = new ManualClock({ durationMs: 1000, nowFn: fakeNow().fn });
    const spy = vi.fn();
    c.onPlayPause(spy);
    c.play();
    c.play();
    c.pause();
    c.pause();
    expect(spy.mock.calls.map((a) => a[0])).toEqual(['playing', 'paused']);
  });

  it('unsubscribe and destroy stop delivery; destroyed clock is inert', () => {
    const { fn, advance } = fakeNow();
    const c = new ManualClock({ durationMs: 1000, nowFn: fn });
    const a = vi.fn();
    const b = vi.fn();
    const offA = c.onPlayPause(a);
    c.onPlayPause(b);
    offA();
    c.play();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    c.destroy();
    expect(c.status).toBe('idle');
    c.play();
    c.seek(100);
    advance(100);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c.status).toBe('idle');
  });
});
