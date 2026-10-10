/**
 * M1 dev shell: boots the song, installs a ManualClock and shows a scrubber
 * so the timeline -> store -> UI path can be verified before any scene exists.
 * Uses the synthetic fixture timeline while song.json has no lines.
 * Replaced by Stage + Transport in M2/M3.
 */
import { useEffect, useState } from 'react';
import { applyTheme, loadSong } from '@/data/loadSong';
import { useSongStore } from '@/core/store';
import { useSongClock } from '@/core/useSongClock';
import { ManualClock } from '@/core/clock/ManualClock';
import { FIXTURE_DURATION_MS, FIXTURE_LINES } from '@/core/__fixtures__/lines';

const DEFAULT_SONG_ID = '101';

export default function App() {
  const [error, setError] = useState<string | null>(null);
  const song = useSongStore((s) => s.song);

  useEffect(() => {
    let cancelled = false;
    loadSong(DEFAULT_SONG_ID)
      .then(({ song, lyrics }) => {
        if (cancelled) return;
        applyTheme(song.theme);
        const store = useSongStore.getState();
        const useFixture = song.lines.length === 0;
        store.setSong(song, lyrics, useFixture ? FIXTURE_LINES : undefined);
        store.setClock(new ManualClock({ durationMs: useFixture ? FIXTURE_DURATION_MS : song.durationMs }));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      useSongStore.getState().setClock(null);
    };
  }, []);

  useSongClock();

  return (
    <main className="app-shell">
      <div className="stage" aria-label="Stage placeholder">
        <div className="stage-safe">
          {error && <p className="placeholder-note">error: {error}</p>}
          {!error && !song && <p className="placeholder-note">loading…</p>}
          {song && <DevScrubber />}
        </div>
      </div>
    </main>
  );
}

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
};

function DevScrubber() {
  const song = useSongStore((s) => s.song);
  const clock = useSongStore((s) => s.clock);
  const lyrics = useSongStore((s) => s.lyrics);
  const usingFixture = useSongStore((s) => s.usingFixture);
  const status = useSongStore((s) => s.status);
  const positionMs = useSongStore((s) => s.positionMs);
  const activeLineId = useSongStore((s) => s.activeLineId);
  const progress = useSongStore((s) => s.progress);
  const nextIndex = useSongStore((s) => s.nextIndex);
  const timeline = useSongStore((s) => s.timeline);
  if (!song || !clock) return null;

  const nextId = timeline?.lines[nextIndex]?.id ?? '—';
  const playing = status === 'playing';

  return (
    <>
      <p className="placeholder-title" style={{ opacity: activeLineId ? 1 : 0.25 }}>
        {activeLineId ?? '···'}
      </p>
      <div className="h-[1cqh] w-full bg-white/10">
        <div
          className="h-full bg-[var(--song-accent)]"
          style={{ width: `${(progress ?? 0) * 100}%`, transition: 'none' }}
        />
      </div>
      <p className="placeholder-sub">
        {song.title} · {song.artists.join(' · ')}
      </p>
      <p className="placeholder-note">
        {usingFixture ? 'fixture timeline' : `${song.lines.length} lines`} · lyrics {lyrics ? 'local' : 'none'} ·
        next {nextId} · {status}
      </p>
      <div className="flex items-center gap-[2cqw]">
        <button
          type="button"
          className="rounded-full bg-[var(--song-accent)] px-[4cqw] py-[1.5cqh] text-[3.5cqw] font-bold text-black"
          onClick={() => (playing ? clock.pause() : clock.play())}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          className="w-full accent-[var(--song-accent)]"
          min={0}
          max={clock.durationMs}
          step={10}
          value={Math.round(positionMs)}
          onChange={(e) => clock.seek(Number(e.currentTarget.value))}
          aria-label="Scrub"
        />
        <span className="w-[16cqw] text-right text-[3cqw] tabular-nums opacity-70">{fmt(positionMs)}</span>
      </div>
    </>
  );
}
