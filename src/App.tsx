/**
 * Dev shell (M1/M2). Routes:
 *   /            stage placeholder + ManualClock scrubber + song switcher + Demo mode
 *   /dev/embed   Spotify iFrame API spike (also reachable as #/dev/embed)
 * Replaced by Stage + Transport in M3.
 *
 * Uses the synthetic fixture timeline while a song.json has no lines.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { applyTheme, listSongIds, loadSong } from '@/data/loadSong';
import { useSongStore } from '@/core/store';
import { useSongClock } from '@/core/useSongClock';
import { ManualClock } from '@/core/clock/ManualClock';
import { FIXTURE_DURATION_MS, FIXTURE_LINES } from '@/core/__fixtures__/lines';

const EmbedSpike = lazy(() => import('@/dev/EmbedSpike'));

const isEmbedSpikeRoute = () =>
  window.location.pathname.replace(/\/+$/, '') === '/dev/embed' || window.location.hash === '#/dev/embed';

const songIdFromUrl = () => new URLSearchParams(window.location.search).get('song');

export default function App() {
  if (isEmbedSpikeRoute()) {
    return (
      <Suspense fallback={<p className="p-4 font-mono text-sm">loading spike…</p>}>
        <EmbedSpike />
      </Suspense>
    );
  }
  return <Shell />;
}

function Shell() {
  const ids = listSongIds();
  const [songId, setSongId] = useState<string>(() => {
    const fromUrl = songIdFromUrl();
    return fromUrl && ids.includes(fromUrl) ? fromUrl : (ids[0] ?? '101');
  });
  const [error, setError] = useState<string | null>(null);
  const song = useSongStore((s) => s.song);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadSong(songId)
      .then(({ song, lyrics }) => {
        if (cancelled) return;
        applyTheme(song.theme);
        const store = useSongStore.getState();
        const useFixture = song.lines.length === 0;
        store.setSong(song, lyrics, useFixture ? FIXTURE_LINES : undefined);
        store.setClock(new ManualClock({ durationMs: useFixture ? FIXTURE_DURATION_MS : song.durationMs }));
        const url = new URL(window.location.href);
        url.searchParams.set('song', songId);
        window.history.replaceState(null, '', url);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      useSongStore.getState().setClock(null);
    };
  }, [songId]);

  useSongClock();

  return (
    <main className="app-shell">
      <div className="stage" aria-label="Stage placeholder">
        <div className="absolute left-[6cqw] top-[6cqh] flex items-center gap-[2cqw] text-[3cqw]">
          <select
            className="rounded bg-white/10 px-[2cqw] py-[1cqh]"
            value={songId}
            onChange={(e) => setSongId(e.currentTarget.value)}
            aria-label="Song"
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <a className="opacity-50 underline" href="/dev/embed">
            embed spike
          </a>
        </div>
        <div className="stage-safe">
          {error && <p className="placeholder-note">error: {error}</p>}
          {!error && !song && <p className="placeholder-note">loading…</p>}
          {song && song.id === songId && <DevScrubber />}
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
  const [demo, setDemo] = useState(false);

  // Demo mode: the guaranteed no-Spotify fallback. Auto-plays the ManualClock
  // and restarts it when it ends, until switched off.
  useEffect(() => {
    if (!demo || !clock) return;
    if (status === 'ended' || status === 'paused') clock.play();
  }, [demo, clock, status]);

  const toggleDemo = useCallback(() => {
    if (!clock) return;
    if (demo) {
      setDemo(false);
      clock.pause();
    } else {
      setDemo(true);
      clock.seek(0);
      clock.play();
    }
  }, [clock, demo]);

  if (!song || !clock) return null;

  const nextId = timeline?.lines[nextIndex]?.id ?? '—';
  const playing = status === 'playing';
  const btn = 'rounded-full px-[4cqw] py-[1.5cqh] text-[3.5cqw] font-bold';

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
        {demo ? ' · DEMO' : ''}
      </p>
      <div className="flex items-center gap-[2cqw]">
        <button
          type="button"
          className={`${btn} bg-[var(--song-accent)] text-black`}
          onClick={() => (playing ? clock.pause() : clock.play())}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className={`${btn} ${demo ? 'bg-white text-black' : 'bg-white/15'}`}
          onClick={toggleDemo}
          aria-pressed={demo}
        >
          Demo
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
