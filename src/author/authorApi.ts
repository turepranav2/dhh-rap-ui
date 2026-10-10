/**
 * Client for the dev-server-only author endpoints (scripts/author-dev-plugin.ts).
 * Lyrics go to data/songs/<id>/lyrics.local.json (gitignored); timings go to
 * song.json. Nothing here is reachable in a production build.
 */
import type { Line, LocalLyrics, Section } from '@/types/song';
import { isLocalLyrics } from '@/data/loadSong';

export const authorAvailable = (): boolean => import.meta.env.DEV;

async function call(method: 'GET' | 'PUT', url: string, body?: unknown): Promise<Record<string, unknown>> {
  const init: RequestInit = { method, cache: 'no-store' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const json: unknown = await res.json().catch(() => ({}));
  const rec = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  if (!res.ok) throw new Error(typeof rec['error'] === 'string' ? rec['error'] : `${method} ${url} -> ${res.status}`);
  return rec;
}

export async function getLocalLyrics(songId: string): Promise<LocalLyrics | null> {
  try {
    const rec = await call('GET', `/__author/lyrics/${encodeURIComponent(songId)}`);
    return isLocalLyrics(rec['lyrics']) ? rec['lyrics'] : null;
  } catch {
    return null;
  }
}

export async function saveLocalLyrics(songId: string, lyrics: LocalLyrics): Promise<number> {
  const rec = await call('PUT', `/__author/lyrics/${encodeURIComponent(songId)}`, { lyrics });
  return typeof rec['count'] === 'number' ? rec['count'] : Object.keys(lyrics).length;
}

export interface SaveLinesPayload {
  lines: Line[];
  sections?: Section[];
  offsetMs?: number;
}

export async function saveSongLines(songId: string, payload: SaveLinesPayload): Promise<number> {
  const rec = await call('PUT', `/__author/song/${encodeURIComponent(songId)}/lines`, payload);
  return typeof rec['count'] === 'number' ? rec['count'] : payload.lines.length;
}
