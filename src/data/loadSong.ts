/**
 * Loads data/songs/<id>/song.json (committed) and, in the DEV SERVER ONLY, the
 * gitignored lyrics.local.json through the author endpoint. Lyrics are never
 * imported by the bundler, so they cannot end up in a production build; in
 * production `lyrics` is always null.
 */
import type { LocalLyrics, Song, Theme } from '@/types/song';

export interface LoadedSong {
  song: Song;
  /** null in production and whenever lyrics.local.json is absent. */
  lyrics: LocalLyrics | null;
}

// Eager: song.json is small and needed before anything renders.
const songModules = import.meta.glob<{ default: unknown }>('../../data/songs/*/song.json', {
  eager: true,
});

function songIdFromPath(path: string): string | undefined {
  return /\/songs\/([^/]+)\//.exec(path)?.[1];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isTheme(v: unknown): v is Theme {
  return (
    isRecord(v) &&
    typeof v['bg'] === 'string' &&
    typeof v['fg'] === 'string' &&
    typeof v['accent'] === 'string' &&
    typeof v['font'] === 'string'
  );
}

/** Minimal structural check so a typo in song.json fails loudly, not deep inside a scene. */
function isSong(v: unknown): v is Song {
  return (
    isRecord(v) &&
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    Array.isArray(v['artists']) &&
    Array.isArray(v['voices']) &&
    typeof v['durationMs'] === 'number' &&
    typeof v['spotifyTrackId'] === 'string' &&
    typeof v['offsetMs'] === 'number' &&
    isTheme(v['theme']) &&
    Array.isArray(v['sections']) &&
    Array.isArray(v['lines'])
  );
}

export function isLocalLyrics(v: unknown): v is LocalLyrics {
  return isRecord(v) && Object.values(v).every((t) => typeof t === 'string');
}

export function listSongIds(): string[] {
  return Object.keys(songModules)
    .map(songIdFromPath)
    .filter((id): id is string => id !== undefined)
    .sort();
}

/** Dev server only. Any failure (prod, no file, no server) is simply "no lyrics". */
export async function fetchLocalLyrics(id: string): Promise<LocalLyrics | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const res = await fetch(`/__author/lyrics/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const lyrics = isRecord(json) ? json['lyrics'] : undefined;
    return isLocalLyrics(lyrics) ? lyrics : null;
  } catch {
    return null;
  }
}

export async function loadSong(id: string): Promise<LoadedSong> {
  const songEntry = Object.entries(songModules).find(([p]) => songIdFromPath(p) === id);
  if (!songEntry) throw new Error(`Unknown song "${id}". Known: ${listSongIds().join(', ')}`);
  const song = songEntry[1].default;
  if (!isSong(song)) throw new Error(`data/songs/${id}/song.json does not match the Song schema`);
  const lyrics = await fetchLocalLyrics(id);
  return { song, lyrics };
}

/** Writes song.theme into the CSS variables declared in src/index.css. */
export function applyTheme(theme: Theme, root: HTMLElement | null = globalThis.document?.documentElement ?? null): void {
  if (!root) return;
  root.style.setProperty('--song-bg', theme.bg);
  root.style.setProperty('--song-fg', theme.fg);
  root.style.setProperty('--song-accent', theme.accent);
  root.style.setProperty('--song-font', `'${theme.font}', system-ui, 'Noto Sans Devanagari', sans-serif`);
}
