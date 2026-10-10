/**
 * Vite DEV-SERVER-ONLY plugin backing the /author page.
 *
 * Endpoints (all under /__author, never present in a production build):
 *   GET  /__author/lyrics/:id        -> { lyrics } from data/songs/<id>/lyrics.local.json (404 if absent)
 *   PUT  /__author/lyrics/:id        <- { lyrics: Record<lineId, string> }   writes lyrics.local.json
 *   GET  /__author/song/:id          -> current song.json from disk
 *   PUT  /__author/song/:id/lines    <- { lines, sections?, offsetMs? }      merges into song.json
 *
 * Hard rules: only writes the two files above inside an existing song folder;
 * ids are validated; nothing fetches lyrics from the network.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const ID_RE = /^[a-z0-9-]+$/;
const LINE_ID_RE = /^L\d{2,3}$/;
const MAX_BODY_BYTES = 1_000_000;

type Json = Record<string, unknown>;

function send(res: ServerResponse, status: number, body: Json): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function isLyricsMap(v: unknown): v is Record<string, string> {
  return isRecord(v) && Object.entries(v).every(([k, t]) => LINE_ID_RE.test(k) && typeof t === 'string');
}

interface LineIn {
  id: string;
  startMs: number;
  endMs: number;
  section: string;
  voice: string;
  intent: string;
  scene: string;
  tags?: string[];
}

function isLine(v: unknown): v is LineIn {
  return (
    isRecord(v) &&
    typeof v['id'] === 'string' &&
    LINE_ID_RE.test(v['id']) &&
    typeof v['startMs'] === 'number' &&
    typeof v['endMs'] === 'number' &&
    typeof v['section'] === 'string' &&
    typeof v['voice'] === 'string' &&
    typeof v['intent'] === 'string' &&
    typeof v['scene'] === 'string' &&
    (v['tags'] === undefined || (Array.isArray(v['tags']) && v['tags'].every((t) => typeof t === 'string'))) &&
    (v['transition'] === undefined || ['default', 'cut', 'whip', 'match'].includes(String(v['transition'])))
  );
}

function isSection(v: unknown): v is { id: string; label: string; startMs: number } {
  return isRecord(v) && typeof v['id'] === 'string' && typeof v['label'] === 'string' && typeof v['startMs'] === 'number';
}

export function authorDevPlugin(): Plugin {
  return {
    name: 'dhh-author-dev',
    apply: 'serve',
    configureServer(server) {
      const songsDir = path.join(server.config.root, 'data', 'songs');

      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith('/__author/')) {
          next();
          return;
        }
        void handle(req, res, url).catch((e: unknown) => send(res, 500, { error: e instanceof Error ? e.message : String(e) }));
      });

      async function handle(req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
        const m = /^\/__author\/(lyrics|song)\/([^/]+)(?:\/(lines))?$/.exec(url);
        if (!m) return send(res, 404, { error: 'unknown endpoint' });
        const kind = m[1];
        const id = m[2] ?? '';
        const sub = m[3];
        if (!ID_RE.test(id)) return send(res, 400, { error: 'bad song id' });

        const dir = path.join(songsDir, id);
        const songPath = path.join(dir, 'song.json');
        const lyricsPath = path.join(dir, 'lyrics.local.json');
        try {
          await fs.access(songPath);
        } catch {
          return send(res, 404, { error: `no song folder for ${id}` });
        }

        if (kind === 'lyrics' && req.method === 'GET') {
          try {
            const raw = await fs.readFile(lyricsPath, 'utf8');
            const parsed: unknown = JSON.parse(raw);
            if (!isLyricsMap(parsed)) return send(res, 500, { error: 'lyrics.local.json is not { lineId: string }' });
            return send(res, 200, { lyrics: parsed });
          } catch {
            // 200 with null, not 404: a missing file is normal and a 404 shows up as a console error.
            return send(res, 200, { lyrics: null });
          }
        }

        if (kind === 'lyrics' && req.method === 'PUT') {
          const body: unknown = JSON.parse(await readBody(req));
          const lyrics = isRecord(body) ? body['lyrics'] : undefined;
          if (!isLyricsMap(lyrics)) return send(res, 400, { error: 'expected { lyrics: { L01: string, ... } }' });
          await fs.writeFile(lyricsPath, JSON.stringify(lyrics, null, 2) + '\n', 'utf8');
          return send(res, 200, { ok: true, count: Object.keys(lyrics).length, path: path.relative(server.config.root, lyricsPath) });
        }

        if (kind === 'song' && req.method === 'GET') {
          const parsed: unknown = JSON.parse(await fs.readFile(songPath, 'utf8'));
          return send(res, 200, { song: parsed });
        }

        if (kind === 'song' && sub === 'lines' && req.method === 'PUT') {
          const body: unknown = JSON.parse(await readBody(req));
          if (!isRecord(body)) return send(res, 400, { error: 'expected an object' });
          const lines = body['lines'];
          if (!Array.isArray(lines) || !lines.every(isLine)) return send(res, 400, { error: 'lines must be Line[]' });
          for (let i = 1; i < lines.length; i++) {
            const prev = lines[i - 1];
            const cur = lines[i];
            if (prev && cur && (cur.startMs < prev.startMs || cur.startMs < prev.endMs)) {
              return send(res, 400, { error: `lines not sorted/non-overlapping at ${cur.id}` });
            }
          }
          const sections = body['sections'];
          if (sections !== undefined && !(Array.isArray(sections) && sections.every(isSection))) {
            return send(res, 400, { error: 'sections must be Section[]' });
          }
          const offsetMs = body['offsetMs'];
          if (offsetMs !== undefined && typeof offsetMs !== 'number') return send(res, 400, { error: 'offsetMs must be a number' });

          const current: unknown = JSON.parse(await fs.readFile(songPath, 'utf8'));
          if (!isRecord(current)) return send(res, 500, { error: 'song.json is not an object' });
          const next: Json = { ...current, lines };
          if (sections !== undefined) next['sections'] = sections;
          if (offsetMs !== undefined) next['offsetMs'] = offsetMs;
          await fs.writeFile(songPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
          return send(res, 200, { ok: true, count: lines.length, path: path.relative(server.config.root, songPath) });
        }

        return send(res, 405, { error: `unsupported ${req.method ?? ''} ${url}` });
      }
    },
  };
}
