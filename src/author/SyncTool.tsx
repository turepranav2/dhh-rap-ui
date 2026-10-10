/**
 * Tap-to-sync (M4.1 core). Audio comes from the owner's own file via a picker
 * (LocalAudioClock). Space or the Tap button marks the start of the cursor
 * line; Save writes timings into song.json through the dev server. The
 * `intent` field stays blank for the planner to paraphrase later.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LocalLyrics, Song } from '@/types/song';
import { useSongStore } from '@/core/store';
import { useSongClock } from '@/core/useSongClock';
import { LocalAudioClock } from '@/core/clock/LocalAudioClock';
import { orderedLineIds } from './lyricsPaste';
import { createSync, currentId, fromLines, isComplete, nudge, retapFrom, tap, toLines, undo, type SyncState } from './syncModel';
import { saveSongLines } from './authorApi';

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`;
};

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export default function SyncTool({ song, lyrics }: { song: Song; lyrics: LocalLyrics | null }) {
  const ids = useMemo(() => (lyrics ? orderedLineIds(lyrics) : []), [lyrics]);
  const [sync, setSync] = useState<SyncState>(() => fromLines(ids, song.lines));
  const [voice, setVoice] = useState<string>(song.voices[0] ?? 'A');
  const [reactionOffsetMs, setReactionOffsetMs] = useState(0);
  const [lastLineMs, setLastLineMs] = useState(4000);
  const [fileName, setFileName] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const clock = useSongStore((s) => s.clock);
  const status = useSongStore((s) => s.status);
  const positionMs = useSongStore((s) => s.positionMs);
  const activeLineId = useSongStore((s) => s.activeLineId);
  useSongClock();

  useEffect(() => setSync(fromLines(ids, song.lines)), [ids, song.lines]);
  useEffect(() => () => useSongStore.getState().setClock(null), []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const store = useSongStore.getState();
    store.setSong(song, lyrics);
    store.setClock(new LocalAudioClock(file, { durationMs: song.durationMs }));
    setFileName(file.name);
    setMsg(null);
  };

  const doTap = useCallback(() => {
    if (!clock) return;
    setSync((s) => tap(s, clock.now(), voice));
  }, [clock, voice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        doTap();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setSync((s) => undo(s));
      } else if (e.key === 'p' && clock) {
        if (status === 'playing') clock.pause();
        else clock.play();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doTap, clock, status]);

  const lines = useMemo(
    () =>
      toLines(sync, {
        durationMs: clock?.durationMs || song.durationMs,
        section: song.sections[0]?.id ?? 'main',
        defaultVoice: song.voices[0] ?? 'A',
        reactionOffsetMs,
        lastLineMs,
        existing: song.lines,
      }),
    [sync, clock, song, reactionOffsetMs, lastLineMs],
  );

  const save = async () => {
    try {
      const sections = song.sections.length ? undefined : [{ id: 'main', label: 'Main', startMs: 0 }];
      const payload = sections ? { lines, sections } : { lines };
      const n = await saveSongLines(song.id, payload);
      setMsg(`saved ${n} line timings to data/songs/${song.id}/song.json (intent left blank). Reloading…`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const btn = 'rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:bg-white/30 disabled:opacity-40';

  if (ids.length === 0) {
    return <p className="opacity-70">Paste and save lines above first; the sync list is built from lyrics.local.json.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${btn} cursor-pointer`}>
          {fileName ? `audio: ${fileName}` : 'choose your audio file (never committed)'}
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.currentTarget.files?.[0])} />
        </label>
        <label className="flex items-center gap-2">
          voice
          <select className="rounded bg-white/10 px-2 py-1" value={voice} onChange={(e) => setVoice(e.currentTarget.value)}>
            {song.voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          reaction offset ms
          <input type="number" step={10} className="w-20 rounded bg-white/10 px-2 py-1" value={reactionOffsetMs} onChange={(e) => setReactionOffsetMs(Number(e.currentTarget.value))} />
        </label>
        <label className="flex items-center gap-2">
          last line ms
          <input type="number" step={500} className="w-20 rounded bg-white/10 px-2 py-1" value={lastLineMs} onChange={(e) => setLastLineMs(Number(e.currentTarget.value))} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} bg-[var(--song-accent)] text-black`} disabled={!clock} onClick={() => (status === 'playing' ? clock?.pause() : clock?.play())}>
          {status === 'playing' ? 'Pause (p)' : 'Play (p)'}
        </button>
        <button type="button" className={`${btn} bg-green-600/40 text-base font-bold`} disabled={!clock || isComplete(sync)} onClick={doTap}>
          TAP {currentId(sync) ?? '—'} (Space)
        </button>
        <button type="button" className={btn} disabled={sync.cursor === 0} onClick={() => setSync((s) => undo(s))}>
          Undo (Backspace)
        </button>
        <button type="button" className={btn} disabled={!clock} onClick={() => clock?.seek(Math.max(0, positionMs - 5000))}>
          −5 s
        </button>
        <span className="tabular-nums opacity-80">{fmt(positionMs)} / {fmt(clock?.durationMs ?? song.durationMs)} · {status}</span>
      </div>

      {clock && (
        <input
          type="range"
          className="w-full accent-[var(--song-accent)]"
          min={0}
          max={clock.durationMs || song.durationMs}
          step={10}
          value={Math.round(positionMs)}
          onChange={(e) => clock.seek(Number(e.currentTarget.value))}
          aria-label="Scrub"
        />
      )}

      <ol className="max-h-[50vh] overflow-auto rounded bg-black/30 text-xs leading-6">
        {ids.map((id, i) => {
          const start = sync.starts.get(id);
          const isCursor = i === sync.cursor;
          const line = lines[i];
          return (
            <li key={id} className={`flex items-center gap-2 px-2 ${isCursor ? 'bg-[var(--song-accent)]/20' : ''} ${activeLineId === id ? 'outline outline-1 outline-[var(--song-accent)]' : ''}`}>
              <span className="w-10 opacity-60">{id}</span>
              <span className="w-24 tabular-nums">{start === undefined ? '—' : fmt(line?.startMs ?? start)}</span>
              <span className="w-12 opacity-60">{line?.voice ?? ''}</span>
              <span className="flex-1 truncate">{lyrics?.[id] ?? ''}</span>
              {start !== undefined && (
                <>
                  <button type="button" className="px-1 opacity-70 hover:opacity-100" onClick={() => setSync((s) => nudge(s, id, -50))} title="-50 ms">◂</button>
                  <button type="button" className="px-1 opacity-70 hover:opacity-100" onClick={() => setSync((s) => nudge(s, id, +50))} title="+50 ms">▸</button>
                  <button type="button" className="px-1 opacity-70 hover:opacity-100" onClick={() => { setSync((s) => retapFrom(s, i)); clock?.seek(Math.max(0, start - 3000)); }} title="retap from here">↺</button>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} bg-blue-600/40`} disabled={sync.cursor === 0} onClick={() => void save()}>
          Save timings → song.json ({sync.cursor}/{ids.length})
        </button>
        <button type="button" className={btn} onClick={() => setSync(createSync(ids))}>
          Reset taps
        </button>
        {msg && <span className="opacity-80">{msg}</span>}
      </div>
    </div>
  );
}
