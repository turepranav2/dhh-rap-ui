/**
 * M2.1 spike: /dev/embed. Logs every Spotify iFrame API event with host
 * timestamps so the owner can fill docs/SPIKE_EMBED.md. Works for every song
 * in data/songs. The embed stays visible and untouched.
 *
 * "Run script" = play, wait 60 s, seek(60), wait 5 s, pause. "Copy report"
 * produces the markdown block for docs/SPIKE_EMBED.md.
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
  type: 'api' | 'ready' | 'playback_started' | 'playback_update' | 'action' | 'error' | 'script';
  data: Record<string, unknown>;
}

type Login = 'logged-in premium' | 'logged-in free' | 'logged-out' | 'unknown';
type ScriptStep = 'idle' | 'play' | 'wait60' | 'seek' | 'wait5' | 'pause' | 'done' | 'aborted';

const PREVIEW_MAX_MS = 31_000;
const SCRIPT_PLAY_MS = 60_000;
const SCRIPT_SEEK_S = 60;
const SCRIPT_SETTLE_MS = 5_000;
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

const fmtRange = (min: number | null, max: number | null) =>
  min === null || max === null ? '—' : `${min >= 0 ? '+' : ''}${min} / ${max >= 0 ? '+' : ''}${max}`;

export default function EmbedSpike() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [last, setLast] = useState<SpotifyPlaybackUpdate | null>(null);
  const [apiState, setApiState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [device, setDevice] = useState('');
  const [login, setLogin] = useState<Login>('unknown');
  const [step, setStep] = useState<ScriptStep>('idle');
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const lastUpdateAtRef = useRef<number | null>(null);
  /** Anchor to measure drift: first update after play. */
  const anchorRef = useRef<{ t: number; position: number } | null>(null);
  const scriptAbortRef = useRef<(() => void) | null>(null);

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

  const act = useCallback(
    (name: string, fn: (c: SpotifyEmbedController) => void) => {
      const c = controllerRef.current;
      push('action', { name, hasController: c !== null });
      if (c) fn(c);
    },
    [push],
  );

  const resetMeasures = () => {
    lastUpdateAtRef.current = null;
    anchorRef.current = null;
  };

  const switchTrack = (id: string) => {
    setTrackId(id);
    resetMeasures();
    act(`loadUri ${id}`, (c) => c.loadUri(trackUri(id)));
  };

  // --- Scripted run: play -> 60 s -> seek(60) -> 5 s -> pause -----------------
  const runScript = () => {
    scriptAbortRef.current?.();
    let aborted = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !aborted && fn(), ms));
    };
    scriptAbortRef.current = () => {
      aborted = true;
      timers.forEach((t) => window.clearTimeout(t));
      setStep('aborted');
      setCountdown(0);
    };
    setLog([]);
    resetMeasures();
    setLast(null);
    push('script', { step: 'start', device, login, trackId });
    setStep('play');
    act('script play', (c) => c.play());
    setStep('wait60');
    const t0 = performance.now();
    const tickId = window.setInterval(() => {
      const left = Math.max(0, SCRIPT_PLAY_MS - (performance.now() - t0));
      setCountdown(Math.ceil(left / 1000));
      if (left <= 0 || aborted) window.clearInterval(tickId);
    }, 250);
    timers.push(tickId);
    after(SCRIPT_PLAY_MS, () => {
      setStep('seek');
      push('script', { step: 'seek', seconds: SCRIPT_SEEK_S });
      act('script seek 60s', (c) => c.seek(SCRIPT_SEEK_S));
      setStep('wait5');
      after(SCRIPT_SETTLE_MS, () => {
        setStep('pause');
        act('script pause', (c) => c.pause());
        after(1500, () => {
          push('script', { step: 'done' });
          setStep('done');
        });
      });
    });
  };

  useEffect(() => () => scriptAbortRef.current?.(), []);

  // --- Derived stats ----------------------------------------------------------
  const song = songs.find((s) => s.spotifyTrackId === trackId);

  const stats = useMemo(() => {
    const updates = log.filter((e) => e.type === 'playback_update');
    const playingUpdates = updates.filter((e) => e.data['isPaused'] === false && e.data['isBuffering'] === false);
    const dts = playingUpdates.map((e) => e.dt).filter((x): x is number => x !== null);
    const drifts = updates.map((e) => e.data['driftMs']).filter((x): x is number => typeof x === 'number');
    const durations = updates.map((e) => e.data['duration']).filter((x): x is number => typeof x === 'number' && x > 0);
    const durationReported = durations.length ? Math.max(...durations) : null;
    const preview = durationReported !== null ? durationReported <= PREVIEW_MAX_MS : null;

    // Seek check: first update after the latest seek-to-60 action that lands within 3 s of 60000.
    const seekAction = [...log].reverse().find((e) => e.type === 'action' && String(e.data['name']).includes('seek 60s'));
    let seekLatencyMs: number | null = null;
    let seekLanded: boolean | null = null;
    if (seekAction) {
      const landed = updates.find((e) => e.t >= seekAction.t && Math.abs(Number(e.data['position']) - SCRIPT_SEEK_S * 1000) < 3000);
      seekLanded = landed !== undefined;
      seekLatencyMs = landed ? landed.t - seekAction.t : null;
    }

    // Play latency: first playing update after the latest play action.
    const playAction = [...log].reverse().find((e) => e.type === 'action' && /play|resume/.test(String(e.data['name'])));
    const firstPlaying = playAction ? playingUpdates.find((e) => e.t >= playAction.t) : undefined;
    const playToFirstUpdateMs = playAction && firstPlaying ? firstPlaying.t - playAction.t : null;

    return {
      updates: updates.length,
      playingUpdates: playingUpdates.length,
      medianIntervalMs: median(dts),
      minIntervalMs: dts.length ? Math.min(...dts) : null,
      maxIntervalMs: dts.length ? Math.max(...dts) : null,
      driftMinMs: drifts.length ? Math.min(...drifts) : null,
      driftMaxMs: drifts.length ? Math.max(...drifts) : null,
      durationReported,
      durationExpected: song?.durationMs ?? null,
      preview,
      seekLanded,
      seekLatencyMs,
      playToFirstUpdateMs,
      buffering: updates.filter((e) => e.data['isBuffering'] === true).length,
    };
  }, [log, song]);

  const reportMarkdown = () => {
    const s = stats;
    const yn = (b: boolean | null) => (b === null ? '—' : b ? 'yes' : 'no');
    const runId = `${device || 'device?'} · ${login} · ${song?.id ?? trackId ?? '?'}`;
    const drift = fmtRange(s.driftMinMs, s.driftMaxMs);
    const interval = `${s.medianIntervalMs ?? '—'} / ${s.minIntervalMs ?? '—'} / ${s.maxIntervalMs ?? '—'}`;
    const seek = s.seekLanded === null ? '—' : s.seekLanded ? `yes (${s.seekLatencyMs} ms)` : 'NO';
    const driftOk = s.driftMinMs !== null && s.driftMaxMs !== null && Math.max(Math.abs(s.driftMinMs), Math.abs(s.driftMaxMs)) <= 250;
    const verdict =
      s.preview === null
        ? 'no data'
        : s.preview
          ? 'PREVIEW ONLY -> fallback: ManualClock Demo mode (see RUN_SHEET decision tree, branch 1)'
          : driftOk && (s.medianIntervalMs ?? 9999) <= 1500 && s.seekLanded !== false
            ? 'FULL TRACK, accurate -> SpotifyEmbedClock default (branch 2)'
            : 'FULL TRACK, position weak -> SpotifyEmbedClock snap-only + offset tuning, else Demo mode (branch 3)';
    return [
      `### Run: ${runId} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      `| Run | Device / browser | Spotify login | Track | duration reported | preview? | updates | interval median/min/max | drift min/max | seek ok | notes |`,
      `|---|---|---|---|---|---|---|---|---|---|---|`,
      `| ${runId} | ${device || '?'} | ${login} | ${song?.id ?? '?'} | ${s.durationReported ?? '—'} (expected ${s.durationExpected ?? '—'}) | ${yn(s.preview)} | ${s.updates} | ${interval} ms | ${drift} ms | ${seek} | buffering updates: ${s.buffering}; play->first update: ${s.playToFirstUpdateMs ?? '—'} ms |`,
      ``,
      `- Q1 full track via API play(): ${s.preview === null ? '—' : s.preview ? 'NO, preview (' + s.durationReported + ' ms)' : 'YES (' + s.durationReported + ' ms)'}`,
      `- Q2 update interval median / max: ${s.medianIntervalMs ?? '—'} / ${s.maxIntervalMs ?? '—'} ms`,
      `- Q3 drift vs wall clock min / max: ${drift} ms -> ${s.driftMinMs === null ? '—' : driftOk ? 'within ±250 ms (ease)' : 'exceeds ±250 ms (snaps needed)'}`,
      `- Q4 seek(60) landed: ${seek}`,
      `- Q5 play -> first playing update: ${s.playToFirstUpdateMs ?? '—'} ms (audible lag by ear: ___ ms)`,
      `- Verdict: ${verdict}`,
      `- UA: ${navigator.userAgent}`,
      ``,
    ].join('\n');
  };

  const exportJson = () =>
    JSON.stringify({ ua: navigator.userAgent, device, login, trackId, at: new Date().toISOString(), stats, last, log }, null, 2);

  const copyText = (label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label);
        push('action', { name: `copied ${label}` });
      },
      (e: unknown) => push('error', { where: 'clipboard', message: String(e) }),
    );
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spike-embed-${song?.id ?? trackId ?? 'none'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const btn = 'rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:bg-white/30 disabled:opacity-40';
  const scriptRunning = step !== 'idle' && step !== 'done' && step !== 'aborted';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 font-mono text-sm">
      <h1 className="text-lg font-bold">Spotify embed spike · M2.1</h1>
      <p className="opacity-70">
        api: {apiState} · controller: {controllerRef.current ? 'yes' : 'no'} · See docs/RUN_SHEET.md. Steps: pick track,
        fill device + login, press <b>Run script</b>, wait ~70 s, press <b>Copy report</b>, paste into docs/SPIKE_EMBED.md.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Track
          <select className="rounded bg-white/10 px-2 py-1" value={trackId ?? ''} onChange={(e) => switchTrack(e.currentTarget.value)} disabled={scriptRunning}>
            {songs.map((s) => (
              <option key={s.id} value={s.spotifyTrackId}>
                {s.title} · {s.artists.join(', ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Device
          <input className="w-44 rounded bg-white/10 px-2 py-1" placeholder="e.g. desktop Chrome" value={device} onChange={(e) => setDevice(e.currentTarget.value)} />
        </label>
        <label className="flex items-center gap-2">
          Login
          <select className="rounded bg-white/10 px-2 py-1" value={login} onChange={(e) => setLogin(e.currentTarget.value as Login)}>
            <option value="unknown">unknown</option>
            <option value="logged-in premium">logged-in premium</option>
            <option value="logged-in free">logged-in free</option>
            <option value="logged-out">logged-out</option>
          </select>
        </label>
      </div>

      {/* Embed host. Never hidden, never covered. */}
      <div ref={hostRef} className="min-h-[152px] w-full" />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} bg-green-600/40`} onClick={runScript} disabled={scriptRunning || apiState !== 'ready'}>
          Run script (play → 60 s → seek 60 → pause)
        </button>
        {scriptRunning && (
          <button type="button" className={btn} onClick={() => scriptAbortRef.current?.()}>
            abort
          </button>
        )}
        <span className="opacity-70">
          step: {step}
          {step === 'wait60' ? ` (${countdown}s left)` : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => act('play', (c) => c.play())}>play()</button>
        <button type="button" className={btn} onClick={() => act('pause', (c) => c.pause())}>pause()</button>
        <button type="button" className={btn} onClick={() => act('resume', (c) => c.resume())}>resume()</button>
        <button type="button" className={btn} onClick={() => act('togglePlay', (c) => c.togglePlay())}>togglePlay()</button>
        <button type="button" className={btn} onClick={() => act('restart', (c) => c.restart())}>restart()</button>
        <button type="button" className={btn} onClick={() => act('seek 60s', (c) => c.seek(60))}>seek(60)</button>
        <button type="button" className={btn} onClick={() => act('seek 150s', (c) => c.seek(150))}>seek(150)</button>
        <button type="button" className={btn} onClick={() => act('seek +10s', (c) => c.seek(((last?.position ?? 0) + 10_000) / 1000))}>
          seek(+10s)
        </button>
      </div>

      <section className="grid grid-cols-2 gap-x-4 gap-y-1 rounded bg-white/5 p-3 sm:grid-cols-3">
        <Stat k="position" v={last ? `${last.position} ms` : '—'} />
        <Stat k="duration reported / expected" v={`${stats.durationReported ?? '—'} / ${stats.durationExpected ?? '—'} ms`} />
        <Stat k="preview?" v={stats.preview === null ? '—' : stats.preview ? 'YES (≤31 s)' : 'no, full track'} warn={stats.preview === true} />
        <Stat k="paused / buffering" v={last ? `${last.isPaused} / ${last.isBuffering}` : '—'} />
        <Stat k="updates (playing)" v={`${stats.updates} (${stats.playingUpdates})`} />
        <Stat k="interval median / min / max" v={`${stats.medianIntervalMs ?? '—'} / ${stats.minIntervalMs ?? '—'} / ${stats.maxIntervalMs ?? '—'} ms`} />
        <Stat k="drift vs wall clock min / max" v={`${fmtRange(stats.driftMinMs, stats.driftMaxMs)} ms`} warn={stats.driftMaxMs !== null && Math.max(Math.abs(stats.driftMinMs ?? 0), Math.abs(stats.driftMaxMs)) > 250} />
        <Stat k="seek(60) landed" v={stats.seekLanded === null ? '—' : stats.seekLanded ? `yes, ${stats.seekLatencyMs} ms` : 'NO'} warn={stats.seekLanded === false} />
        <Stat k="play → first update" v={stats.playToFirstUpdateMs === null ? '—' : `${stats.playToFirstUpdateMs} ms`} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} bg-blue-600/40`} onClick={() => copyText('report', reportMarkdown())}>
          Copy report (markdown)
        </button>
        <button type="button" className={btn} onClick={() => copyText('log', exportJson())}>copy log JSON</button>
        <button type="button" className={btn} onClick={download}>download log JSON</button>
        <button type="button" className={btn} onClick={() => { setLog([]); resetMeasures(); setLast(null); setStep('idle'); }}>
          clear
        </button>
        {copied && <span className="text-green-300">copied {copied}</span>}
      </div>

      <details>
        <summary className="cursor-pointer opacity-70">report preview</summary>
        <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 text-xs">{reportMarkdown()}</pre>
      </details>

      <ol className="max-h-[40vh] overflow-auto rounded bg-black/40 p-2 text-xs leading-5">
        {log.slice(-200).map((e, i) => (
          <li key={`${e.t}-${i}`} className={e.type === 'error' ? 'text-red-400' : e.type === 'action' || e.type === 'script' ? 'text-yellow-300' : ''}>
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
