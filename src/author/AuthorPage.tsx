/**
 * /author (dev server only). Per song: paste lines -> lyrics.local.json;
 * tap-to-sync -> song.json timings. Lyric text never leaves the local file.
 */
import { useEffect, useState } from 'react';
import { applyTheme, listSongIds, loadSong } from '@/data/loadSong';
import type { LocalLyrics, Song } from '@/types/song';
import { authorAvailable, getLocalLyrics, saveLocalLyrics } from './authorApi';
import { linesFromPaste, orderedLineIds, pasteFromLines } from './lyricsPaste';
import SyncTool from './SyncTool';

export default function AuthorPage() {
  const ids = listSongIds();
  const [songId, setSongId] = useState<string>(() => new URLSearchParams(window.location.search).get('song') ?? ids[0] ?? '101');
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<LocalLyrics | null>(null);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSong(null);
    setLyrics(null);
    loadSong(songId).then(async ({ song }) => {
      const local = await getLocalLyrics(song.id);
      if (cancelled) return;
      applyTheme(song.theme);
      setSong(song);
      setLyrics(local);
      setPaste(local ? pasteFromLines(local) : '');
    });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (!authorAvailable()) {
    return <main className="p-4 font-mono text-sm">Author tools run on the dev server only (pnpm dev).</main>;
  }

  const btn = 'rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20 active:bg-white/30 disabled:opacity-40';
  const pending = linesFromPaste(paste);
  const pendingIds = orderedLineIds(pending);
  const renumbers = lyrics !== null && song !== null && song.lines.length > 0 && Object.keys(lyrics).length !== pendingIds.length;

  const saveLines = async () => {
    try {
      const n = await saveLocalLyrics(songId, pending);
      setLyrics(pending);
      setMsg(`saved ${n} lines (${pendingIds[0] ?? '—'}..${pendingIds[pendingIds.length - 1] ?? '—'}) to data/songs/${songId}/lyrics.local.json (gitignored)`);
    } catch (e) {
      setMsg(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-4 font-mono text-sm">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">Author · local only</h1>
        <select className="rounded bg-white/10 px-2 py-1" value={songId} onChange={(e) => setSongId(e.currentTarget.value)}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <a className="opacity-50 underline" href={`/?song=${songId}`}>stage</a>
        <a className="opacity-50 underline" href="/dev/embed">embed spike</a>
      </header>

      <p className="opacity-60">
        Rules: lyric text is written only to <code>lyrics.local.json</code> (gitignored) through the dev server. Nothing fetches
        lyrics from the network. <code>song.json</code> receives ids + timings only; <code>intent</code> stays blank.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">1. Lines (one per line)</h2>
        <textarea
          className="min-h-40 w-full rounded bg-white/5 p-2 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.currentTarget.value)}
          placeholder="paste the lines here, one per line"
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btn} bg-blue-600/40`} disabled={pendingIds.length === 0} onClick={() => void saveLines()}>
            Save lines → lyrics.local.json ({pendingIds.length})
          </button>
          {renumbers && <span className="text-yellow-300">line count changed: existing timings in song.json may no longer match ids</span>}
          {msg && <span className="opacity-80">{msg}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">2. Sync (play, press Space at each line start, save)</h2>
        {song ? <SyncTool key={`${song.id}-${lyrics ? Object.keys(lyrics).length : 0}`} song={song} lyrics={lyrics} /> : <p>loading…</p>}
      </section>
    </main>
  );
}
