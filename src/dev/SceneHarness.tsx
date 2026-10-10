/**
 * /dev/scene: scene harness. Renders ONE scene through the real Stage +
 * store + ManualClock path so what you see is what the player does.
 * Controls: song folder, scene, progress slider, play (sweeps progress on
 * the clock), active toggle, reduced-motion toggle, voice, "mount at 0.7"
 * (remounts the scene mid-line to prove seek-safety).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Song } from '@/types/song';
import { useSongStore } from '@/core/store';
import { useSongClock } from '@/core/useSongClock';
import { ManualClock } from '@/core/clock/ManualClock';
import { applyTheme, listSongIds, loadSong } from '@/data/loadSong';
import { getScene, listScenes, listSceneSongs } from '@/scenes/registry';
import { ReducedMotionOverride } from '@/scenes/useSceneMotion';
import Stage from '@/player/Stage';

const LINE_MS = 2400;

export default function SceneHarness() {
  const params = new URLSearchParams(window.location.search);
  const sceneSongs = useMemo(() => listSceneSongs(), []);
  const [sceneSong, setSceneSong] = useState(params.get('song') ?? sceneSongs[0] ?? '_fixture');
  const scenes = useMemo(() => listScenes(sceneSong), [sceneSong]);
  const [sceneId, setSceneId] = useState(params.get('scene') ?? scenes[0] ?? 'F01');
  const [theme, setTheme] = useState<Song['theme'] | null>(null);
  const [voices, setVoices] = useState<string[]>(['A', 'B']);
  const [voice, setVoice] = useState('A');
  const [reduced, setReduced] = useState(false);
  const [forceInactive, setForceInactive] = useState(false);
  const [mountKey, setMountKey] = useState(0);

  const status = useSongStore((s) => s.status);
  const progress = useSongStore((s) => s.progress);
  const clock = useSongStore((s) => s.clock);
  useSongClock();

  // Theme + voices come from a real song.json (the fixture folder borrows the first song's).
  useEffect(() => {
    const realId = listSongIds().includes(sceneSong) ? sceneSong : (listSongIds()[0] ?? '101');
    void loadSong(realId).then(({ song }) => {
      applyTheme(song.theme);
      setTheme(song.theme);
      setVoices(song.voices);
      setVoice((v) => (song.voices.includes(v) ? v : (song.voices[0] ?? v)));
    });
  }, [sceneSong]);

  useEffect(() => {
    if (!scenes.includes(sceneId)) setSceneId(scenes[0] ?? '');
  }, [scenes, sceneId]);

  // One-line song: [0, LINE_MS). The ManualClock sweeps it.
  useEffect(() => {
    if (!theme) return;
    const song: Song = {
      id: `harness-${sceneSong}`,
      title: 'harness',
      artists: [],
      voices,
      album: '',
      trackNumber: 0,
      durationMs: LINE_MS + 600,
      spotifyTrackId: '',
      offsetMs: 0,
      theme,
      sections: [{ id: 'h', label: 'h', startMs: 0 }],
      lines: [{ id: sceneId, startMs: 300, endMs: 300 + LINE_MS, section: 'h', voice, intent: '', scene: sceneId }],
    };
    const store = useSongStore.getState();
    store.setSong(song, null);
    store.setClock(new ManualClock({ durationMs: song.durationMs, startMs: 300 }));
    const url = new URL(window.location.href);
    url.searchParams.set('song', sceneSong);
    url.searchParams.set('scene', sceneId);
    window.history.replaceState(null, '', url);
    return () => useSongStore.getState().setClock(null);
  }, [theme, voices, voice, sceneSong, sceneId, mountKey]);

  const resolveScene = useCallback((id: string) => getScene(sceneSong, id), [sceneSong]);
  const seekProgress = (p: number) => clock?.seek(300 + p * LINE_MS);

  const btn = 'rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20';
  return (
    <main className="flex h-dvh flex-col items-center gap-2 p-2 font-mono text-xs">
      <div className="flex max-w-[min(100vw,420px)] flex-wrap items-center gap-2">
        <select className={btn} value={sceneSong} onChange={(e) => setSceneSong(e.currentTarget.value)}>
          {sceneSongs.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={btn} value={sceneId} onChange={(e) => setSceneId(e.currentTarget.value)}>
          {scenes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={btn} value={voice} onChange={(e) => setVoice(e.currentTarget.value)}>
          {voices.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.currentTarget.checked)} /> reduced motion</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={forceInactive} onChange={(e) => setForceInactive(e.currentTarget.checked)} /> inactive</label>
        <a className="opacity-50 underline" href="/">stage</a>
      </div>
      <div className="flex max-w-[min(100vw,420px)] flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => (status === 'playing' ? clock?.pause() : clock?.play())}>{status === 'playing' ? 'pause' : 'play sweep'}</button>
        {[0, 0.4, 0.5, 0.8, 1].map((p) => (
          <button key={p} type="button" className={btn} onClick={() => seekProgress(p)}>{p}</button>
        ))}
        <button type="button" className={btn} onClick={() => { setMountKey((k) => k + 1); window.setTimeout(() => useSongStore.getState().clock?.seek(300 + 0.7 * LINE_MS), 0); }}>
          remount @0.7
        </button>
        <input type="range" className="w-40" min={0} max={1000} value={Math.round((progress ?? 0) * 1000)} onChange={(e) => seekProgress(Number(e.currentTarget.value) / 1000)} aria-label="progress" />
        <span className="tabular-nums">{(progress ?? 0).toFixed(3)}</span>
      </div>
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <ReducedMotionOverride.Provider value={reduced}>
          <div className="h-full" style={forceInactive ? { pointerEvents: 'none', filter: 'grayscale(1)' } : undefined}>
            <Stage resolveScene={resolveScene} />
          </div>
        </ReducedMotionOverride.Provider>
      </div>
    </main>
  );
}
