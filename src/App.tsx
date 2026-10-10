/**
 * Dev shell (M1-M3). Routes:
 *   /            Stage + ManualClock scrubber + song switcher + Demo mode
 *   /dev/embed   Spotify iFrame API spike (also reachable as #/dev/embed)
 *   /author      lyrics paste + tap-to-sync (dev server only)
 *
 * Uses the synthetic fixture timeline (scenes in src/scenes/_fixture) while a
 * song.json has no lines.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { applyTheme, listSongIds, loadSong } from '@/data/loadSong';
import { useSongStore } from '@/core/store';
import { useSongClock } from '@/core/useSongClock';
import { ManualClock } from '@/core/clock/ManualClock';
import { FIXTURE_DURATION_MS, FIXTURE_LINES, FIXTURE_SCENE_SONG } from '@/core/__fixtures__/lines';
import Stage from '@/player/Stage';
import { getScene } from '@/scenes/registry';

const EmbedSpike = lazy(() => import('@/dev/EmbedSpike'));
const AuthorPage = lazy(() => import('@/author/AuthorPage'));
const SceneHarness = lazy(() => import('@/dev/SceneHarness'));

const routeIs = (p: string) => window.location.pathname.replace(/\/+$/, '') === p || window.location.hash === `#${p}`;
const isEmbedSpikeRoute = () => routeIs('/dev/embed');
const isAuthorRoute = () => routeIs('/author');
const isSceneHarnessRoute = () => routeIs('/dev/scene');

const songIdFromUrl = () => new URLSearchParams(window.location.search).get('song');

export default function App() {
  if (isEmbedSpikeRoute() || isAuthorRoute() || isSceneHarnessRoute()) {
    return (
      <Suspense fallback={<p className="p-4 font-mono text-sm">loading…</p>}>
        {isAuthorRoute() ? <AuthorPage /> : isSceneHarnessRoute() ? <SceneHarness /> : <EmbedSpike />}
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
  const usingFixture = useSongStore((s) => s.usingFixture);

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

  const sceneSong = usingFixture ? FIXTURE_SCENE_SONG : songId;
  const resolveScene = useCallback((sceneId: string) => getScene(sceneSong, sceneId), [sceneSong]);

  return (
    <main className="app-shell">
      <Stage resolveScene={resolveScene}>
        {error && <p className="placeholder-note">error: {error}</p>}
        {!error && !song && <p className="placeholder-note">loading…</p>}
        {song && song.id === songId && <DevScrubber />}
      </Stage>
      <div className="absolute left-[max(1rem,calc(50vw-28.125vh))] top-4 z-20 flex items-center gap-3 text-xs">
        <select
          className="rounded bg-white/10 px-2 py-1"
          data-testid="song-select"
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
        {import.meta.env.DEV && (
          <a className="opacity-50 underline" href={`/author?song=${songId}`}>
            author
          </a>
        )}
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
      <div className="h-[0.6cqh] w-full bg-white/10">
        <div
          className="h-full bg-[var(--song-accent)]"
          data-testid="progress-bar"
          style={{ width: `${(progress ?? 0) * 100}%`, transition: 'none' }}
        />
      </div>
      <p className="placeholder-note" data-testid="status">
        <span data-testid="active-id">{activeLineId ?? '···'}</span> · {usingFixture ? 'fixture timeline' : `${song.lines.length} lines`} ·
        lyrics {lyrics ? 'local' : 'none'} · next {nextId} · {status}
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
          data-testid="demo"
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
          data-testid="scrub"
        />
        <span className="w-[16cqw] text-right text-[3cqw] tabular-nums opacity-70">{fmt(positionMs)}</span>
      </div>
    </>
  );
}
