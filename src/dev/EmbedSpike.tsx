/**
 * M2.1 spike: /dev/embed. Logs every Spotify iFrame API event with host
 * timestamps so the owner can fill docs/SPIKE_EMBED.md. Works for every song
 * in data/songs. The embed stays visible and untouched.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listSongIds, loadSong } from '@/data/loadSong';
import type { Song } from '@/types/song';
import {
  loadSpotifyIframeApi,
  trackUri,
  type SpotifyEmbedController,
  type SpotifyPlaybackUpdate,
} from '@/core/clock/spotifyIframeApi';

interface LogEntry {
  /** performance.now(), ms, rounded */
  t: number;
  /** ms since previous playback_update (updates only) */
  dt: number | null;
  type: 'api' | 'ready' | 'playback_started' | 'playback_update' | 'action' | 'error';
  data: Record<string, unknown>;
}

const PREVIEW_MAX_MS = 31_000;
const r = (n: number) => Math.round(n);

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >>> 1;
  const a = s[mid - 1];
  const b = s[mid];
  if (b === undefined) return null;
  return s.length % 2 === 0 && a !== undefined ? (a + b) / 2 : b;
}

export default function EmbedSpike() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [last, setLast] = useState<SpotifyPlaybackUpdate | null>(null);
  const [apiState, setApiState] = useState<'loading' | 'ready' | 'error'>('loading');
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const lastUpdateAtRef = useRef<number | null>(null);
  /** Anchor to measure drift: first update after play. */
  const anchorRef = useRef<{ t: number; position: number } | null>(null);

  const push = useCallback((type: LogEntry['type'], data: Record<string, unknown>, dt: number | null = null) => {
    setLog((l) => [...l, { t: r(performance.now()), dt, type, data }]);
  }, []);

  useEffect(() => {
    Promise.all(listSongIds().map((id) => loadSong(id).then((x) => x.song)))
      .then((list) => {
        setSongs(list);
        setTrackId((cur) => cur ?? list[0]?.spotifyTrackId ?? null);
      })
      .catch((e: unknown) => push('error', { where: 'loadSong', message: String(e) }));
  }, [push]);

  // Create the controller once the host element and the first track are known.
  useEffect(() => {
    if (!trackId || !hostRef.current || controllerRef.current) return;
    let cancelled = false;
    const host = hostRef.current;
    // The API replaces the element it is given; keep a child so the wrapper survives.
    const target = document.createElement('div');
    host.appendChild(target);
    push('api', { event: 'loading script', ua: navigator.userAgent });
    loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled) return;
        setApiState('ready');
        push('api', { event: 'script ready' });
        api.createController(target, { uri: trackUri(trackId), width: '100%', height: 152 }, (controller) => {
          if (cancelled) return;
          controllerRef.current = controller;
          push('api', { event: 'controller created', uri: trackUri(trackId) });
          controller.addListener('ready', () => push('ready', {}));
          controller.addListener('playback_started', (e) => {
            anchorRef.current = null;
            push('playback_started', { ...e.data });
          });
          controller.addListener('playback_update', (e) => {
            const now = performance.now();
            const dt = lastUpdateAtRef.current === null ? null : r(now - lastUpdateAtRef.current);
            lastUpdateAtRef.current = now;
            const d = e.data;
            let driftMs: number | null = null;
            if (!d.isPaused && !d.isBuffering) {
              if (anchorRef.current === null) anchorRef.current = { t: now, position: d.position };
              else driftMs = r(d.position - anchorRef.current.position - (now - anchorRef.current.t));
            } else {
              anchorRef.current = null;
            }
            setLast(d);
            push(
              'playback_update',
              {
                position: d.position,
                duration: d.duration,
                isPaused: d.isPaused,
                isBuffering: d.isBuffering,
                driftMs,
                preview: d.duration > 0 && d.duration <= PREVIEW_MAX_MS,
              },
              dt,
            );
          });
        });
      })
      .catch((e: unknown) => {
        setApiState('error');
        push('error', { where: 'iframe-api', message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, push]);

  const act = (name: string, fn: (c: SpotifyEmbedController) => void) => {
    const c = controllerRef.current;
    push('action', { name, hasController: c !== null });
    if (c) fn(c);
  };

  const switchTrack = (id: string) => {
    setTrackId(id);
    lastUpdateAtRef.current = null;
    anchorRef.current = null;
    act(`loadUri ${id}`, (c) => c.loadUri(trackUri(id)));
  };

  const stats = useMemo(() => {
    const updates = log.filter((e) => e.type === 'playback_update');
    const dts = updates.map((e) => e.dt).filter((x): x is number => x !== null);
    const drifts = updates.map((e) => e.data['driftMs']).filter((x): x is number => typeof x === 'number');
    return {
      updates: updates.length,
      medianIntervalMs: median(dts),
      maxIntervalMs: dts.length ? Math.max(...dts) : null,
      minIntervalMs: dts.length ? Math.min(...dts) : null,
      driftMinMs: drifts.length ? Math.min(...drifts) : null,
      driftMaxMs: drifts.length ? Math.max(...drifts) : null,
    };
  }, [log]);

  const exportJson = () =>
    JSON.stringify({ ua: navigator.userAgent, trackId, at: new Date().toISOString(), stats, last, log }, null, 2);

  const copy = () => {
    void navigator.clipboard.writeText(exportJson()).then(
      () => push('action', { name: 'copied log' }),
      (e: unknown) => push('error', { where: 'clipboard', message: String(e) }),
    );
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spike-embed-${trackId ?? 'none'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const btn = 'rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:bg-white/30';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 font-mono text-sm">
      <h1 className="text-lg font-bold">Spotify embed spike · M2.1</h1>
      <p className="opacity-70">
        api: {apiState} · controller: {controllerRef.current ? 'yes' : 'no'} · fill docs/SPIKE_EMBED.md from the
        stats and the exported log.
      </p>

      <label className="flex items-center gap-2">
        Track
        <select
          className="rounded bg-white/10 px-2 py-1"
          value={trackId ?? ''}
          onChange={(e) => switchTrack(e.currentTarget.value)}
        >
          {songs.map((s) => (
            <option key={s.id} value={s.spotifyTrackId}>
              {s.title} · {s.artists.join(', ')}
            </option>
          ))}
        </select>
      </label>

      {/* Embed host. Never hidden, never covered. */}
      <div ref={hostRef} className="min-h-[152px] w-full" />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => act('play', (c) => c.play())}>play()</button>
        <button type="button" className={btn} onClick={() => act('pause', (c) => c.pause())}>pause()</button>
        <button type="button" className={btn} onClick={() => act('resume', (c) => c.resume())}>resume()</button>
        <button type="button" className={btn} onClick={() => act('togglePlay', (c) => c.togglePlay())}>togglePlay()</button>
        <button type="button" className={btn} onClick={() => act('restart', (c) => c.restart())}>restart()</button>
        <button type="button" className={btn} onClick={() => act('seek 60s', (c) => c.seek(60))}>seek(60)</button>
        <button type="button" className={btn} onClick={() => act('seek 150s', (c) => c.seek(150))}>seek(150)</button>
        <button
          type="button"
          className={btn}
          onClick={() => act('seek +10s', (c) => c.seek(((last?.position ?? 0) + 10_000) / 1000))}
        >
          seek(+10s)
        </button>
      </div>

      <section className="grid grid-cols-2 gap-x-4 gap-y-1 rounded bg-white/5 p-3 sm:grid-cols-3">
        <Stat k="position" v={last ? `${last.position} ms` : '—'} />
        <Stat k="duration" v={last ? `${last.duration} ms` : '—'} />
        <Stat
          k="preview?"
          v={last ? (last.duration > 0 && last.duration <= PREVIEW_MAX_MS ? 'YES (≤31 s)' : 'no') : '—'}
          warn={last !== null && last.duration > 0 && last.duration <= PREVIEW_MAX_MS}
        />
        <Stat k="paused / buffering" v={last ? `${last.isPaused} / ${last.isBuffering}` : '—'} />
        <Stat k="updates" v={String(stats.updates)} />
        <Stat k="interval median / min / max" v={`${stats.medianIntervalMs ?? '—'} / ${stats.minIntervalMs ?? '—'} / ${stats.maxIntervalMs ?? '—'} ms`} />
        <Stat k="drift vs wall clock min / max" v={`${stats.driftMinMs ?? '—'} / ${stats.driftMaxMs ?? '—'} ms`} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={copy}>copy log JSON</button>
        <button type="button" className={btn} onClick={download}>download log JSON</button>
        <button type="button" className={btn} onClick={() => { setLog([]); lastUpdateAtRef.current = null; anchorRef.current = null; }}>clear</button>
      </div>

      <ol className="max-h-[50vh] overflow-auto rounded bg-black/40 p-2 text-xs leading-5">
        {log.slice(-200).map((e, i) => (
          <li key={`${e.t}-${i}`} className={e.type === 'error' ? 'text-red-400' : e.type === 'action' ? 'text-yellow-300' : ''}>
            <span className="opacity-50">{e.t}</span> {e.dt !== null ? <span className="opacity-70">+{e.dt} </span> : ''}
            <b>{e.type}</b> {JSON.stringify(e.data)}
          </li>
        ))}
      </ol>
    </main>
  );
}

function Stat({ k, v, warn = false }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider opacity-50">{k}</span>
      <span className={warn ? 'text-yellow-300' : ''}>{v}</span>
    </div>
  );
}
