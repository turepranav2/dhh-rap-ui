import { beforeEach, describe, expect, it } from 'vitest';
import { useSongStore } from './store';
import { ManualClock } from './clock/ManualClock';
import { FIXTURE_DURATION_MS, FIXTURE_LINES } from './__fixtures__/lines';
import type { Song } from '@/types/song';

const SONG: Song = {
  id: 'test',
  title: 't',
  artists: ['a'],
  voices: ['a'],
  album: 'b',
  trackNumber: 1,
  durationMs: FIXTURE_DURATION_MS,
  spotifyTrackId: 'x',
  offsetMs: 0,
  theme: { bg: '#000', fg: '#fff', accent: '#f00', font: 'sans-serif' },
  sections: [],
  lines: [],
};

function fakeNow() {
  let t = 0;
  return { fn: () => t, advance: (ms: number) => (t += ms) };
}

describe('song store', () => {
  beforeEach(() => {
    useSongStore.getState().setClock(null);
    useSongStore.setState({ song: null, lyrics: null, timeline: null, offsetMs: 0, usingFixture: false });
  });

  it('derives active line and progress from the clock through the timeline', () => {
    const { fn, advance } = fakeNow();
    const s = useSongStore.getState();
    s.setSong(SONG, null, FIXTURE_LINES);
    expect(useSongStore.getState().usingFixture).toBe(true);

    const clock = new ManualClock({ durationMs: FIXTURE_DURATION_MS, nowFn: fn });
    s.setClock(clock);
    expect(useSongStore.getState().activeLineId).toBeNull(); // t=0 is before F01
    expect(useSongStore.getState().nextIndex).toBe(0);

    clock.play();
    advance(1000); // inside F01 [500,1500) at 0.5
    s.tick();
    let st = useSongStore.getState();
    expect(st.status).toBe('playing');
    expect(st.activeLineId).toBe('F01');
    expect(st.progress).toBe(0.5);
    expect(st.nextIndex).toBe(1);

    advance(4000); // 5000: in the gap between F04 and F05
    s.tick();
    st = useSongStore.getState();
    expect(st.activeLineId).toBeNull();
    expect(st.progress).toBeNull();
    expect(st.nextIndex).toBe(4);
  });

  it('applies offsetMs centrally', () => {
    const { fn } = fakeNow();
    const s = useSongStore.getState();
    s.setSong(SONG, null, FIXTURE_LINES);
    const clock = new ManualClock({ durationMs: FIXTURE_DURATION_MS, nowFn: fn, startMs: 400 });
    s.setClock(clock);
    expect(useSongStore.getState().activeLineId).toBeNull();
    s.setOffsetMs(100); // 400 + 100 = 500 -> F01 starts
    expect(useSongStore.getState().positionMs).toBe(500);
    expect(useSongStore.getState().activeLineId).toBe('F01');
  });

  it('uses song.lines when no override is given and reads song.offsetMs', () => {
    const s = useSongStore.getState();
    s.setSong({ ...SONG, offsetMs: -30, lines: [] }, null);
    const st = useSongStore.getState();
    expect(st.usingFixture).toBe(false);
    expect(st.offsetMs).toBe(-30);
    expect(st.timeline?.lines).toHaveLength(0);
  });

  it('replacing the clock destroys the previous one and resets when cleared', () => {
    const s = useSongStore.getState();
    s.setSong(SONG, null, FIXTURE_LINES);
    const a = new ManualClock({ durationMs: 1000 });
    const b = new ManualClock({ durationMs: 1000 });
    s.setClock(a);
    s.setClock(b);
    expect(a.status).toBe('idle');
    expect(b.status).toBe('paused');
    s.setClock(null);
    expect(b.status).toBe('idle');
    expect(useSongStore.getState().status).toBe('idle');
  });
});
