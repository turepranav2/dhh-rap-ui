/**
 * Loads data/songs/<id>/song.json (committed) and, if present, the gitignored
 * data/songs/<id>/lyrics.local.json. A missing lyrics file is normal (public
 * builds ship without it) and resolves to `null`, never an error.
 */
import type { LocalLyrics, Song, Theme } from '@/types/song';

export interface LoadedSong {
  song: Song;
  /** null when lyrics.local.json is absent. Scenes must handle `lyric` undefined. */
  lyrics: LocalLyrics | null;
}

// Eager: song.json is small and needed before anything renders.
const songModules = import.meta.glob<{ default: unknown }>('../../data/songs/*/song.json', {
  eager: true,
});

// Lazy: only touched when a song is loaded; absent files simply have no entry.
const lyricsModules = import.meta.glob<{ default: unknown }>(
  '../../data/songs/*/lyrics.local.json',
);

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
    typeof v['durationMs'] === 'number' &&
    typeof v['spotifyTrackId'] === 'string' &&
    typeof v['offsetMs'] === 'number' &&
    isTheme(v['theme']) &&
    Array.isArray(v['sections']) &&
    Array.isArray(v['lines'])
  );
}

function isLocalLyrics(v: unknown): v is LocalLyrics {
  return isRecord(v) && Object.values(v).every((t) => typeof t === 'string');
}

export function listSongIds(): string[] {
  return Object.keys(songModules)
    .map(songIdFromPath)
    .filter((id): id is string => id !== undefined)
    .sort();
}

export async function loadSong(id: string): Promise<LoadedSong> {
  const songEntry = Object.entries(songModules).find(([p]) => songIdFromPath(p) === id);
  if (!songEntry) throw new Error(`Unknown song "${id}". Known: ${listSongIds().join(', ')}`);
  const song = songEntry[1].default;
  if (!isSong(song)) throw new Error(`data/songs/${id}/song.json does not match the Song schema`);

  const lyricsEntry = Object.entries(lyricsModules).find(([p]) => songIdFromPath(p) === id);
  let lyrics: LocalLyrics | null = null;
  if (lyricsEntry) {
    const mod = await lyricsEntry[1]();
    if (!isLocalLyrics(mod.default)) {
      throw new Error(`data/songs/${id}/lyrics.local.json must be { lineId: string }`);
    }
    lyrics = mod.default;
  }

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
