/**
 * Zustand store: loaded song, the active SongClock, the Timeline, and the
 * derived timing state that scenes read (activeLineId, progress).
 *
 * `tick()` is the only writer of timing state and the only place `offsetMs`
 * is applied. It is driven by useSongClock's rAF loop and by clock events.
 */
import { create } from 'zustand';
import type { LocalLyrics, LineId, Song } from '@/types/song';
import type { ClockStatus, SongClock } from '@/core/clock/SongClock';
import { createTimeline, type Timeline, type TimelineLine } from '@/core/timeline/timeline';

export interface TimingState {
  /** Song position with offsetMs applied. */
  positionMs: number;
  status: ClockStatus;
  activeIndex: number;
  activeLineId: LineId | null;
  /** 0..1 within the active line, null when none is active. */
  progress: number | null;
  /** Index of the upcoming line (for pre-roll), -1 when none. */
  nextIndex: number;
}

export interface SongStore extends TimingState {
  song: Song | null;
  lyrics: LocalLyrics | null;
  offsetMs: number;
  clock: SongClock | null;
  timeline: Timeline | null;
  /** True when the timeline came from a fixture rather than song.json. */
  usingFixture: boolean;

  /**
   * Install a song. `linesOverride` swaps in fixture lines (dev) when song.json
   * has none yet. Throws TimelineError on invalid line data.
   */
  setSong(song: Song, lyrics: LocalLyrics | null, linesOverride?: readonly TimelineLine[]): void;
  /** Replace the clock. Destroys the previous one. */
  setClock(clock: SongClock | null): void;
  setOffsetMs(ms: number): void;
  tick(): void;
}

const IDLE_TIMING: TimingState = {
  positionMs: 0,
  status: 'idle',
  activeIndex: -1,
  activeLineId: null,
  progress: null,
  nextIndex: -1,
};

export const useSongStore = create<SongStore>()((set, get) => ({
  ...IDLE_TIMING,
  song: null,
  lyrics: null,
  offsetMs: 0,
  clock: null,
  timeline: null,
  usingFixture: false,

  setSong(song, lyrics, linesOverride) {
    const lines = linesOverride ?? song.lines;
    const timeline = createTimeline(lines);
    set({ song, lyrics, timeline, offsetMs: song.offsetMs, usingFixture: linesOverride !== undefined });
    get().tick();
  },

  setClock(clock) {
    const prev = get().clock;
    if (prev && prev !== clock) prev.destroy();
    set({ clock });
    if (clock) get().tick();
    else set({ ...IDLE_TIMING });
  },

  setOffsetMs(ms) {
    set({ offsetMs: ms });
    get().tick();
  },

  tick() {
    const { clock, timeline, offsetMs } = get();
    if (!clock) return;
    const positionMs = clock.now() + offsetMs;
    const status = clock.status;
    if (!timeline) {
      set({ positionMs, status, activeIndex: -1, activeLineId: null, progress: null, nextIndex: -1 });
      return;
    }
    const activeIndex = timeline.activeIndexAt(positionMs);
    const line = timeline.lines[activeIndex];
    set({
      positionMs,
      status,
      activeIndex,
      activeLineId: line?.id ?? null,
      progress: timeline.progressAt(positionMs),
      nextIndex: timeline.nextLineAt(positionMs),
    });
  },
}));
