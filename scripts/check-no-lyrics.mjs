#!/usr/bin/env node
/**
 * Guard against lyric text leaking into tracked files or the production
 * bundle (CLAUDE.md hard rule). Run: pnpm check:no-lyrics
 *
 * Fails if:
 *  1. any data/**\/*.json other than lyrics.local.json* contains a key named
 *     `lyric`, `lyrics` or `text` at any depth;
 *  2. any `intent` string is longer than INTENT_MAX chars;
 *  3. a lyrics.local.json is tracked by git;
 *  4. text from any local data/songs/*\/lyrics.local.json (whole lines >= 12
 *     chars, or any 4-word run >= 18 chars) appears, normalised, in a tracked
 *     text file or anywhere under dist/ (the production bundle).
 *     Only runs where the local lyric files exist (owner machine); CI has none.
 *
 * Never prints lyric text: matches are reported by lineId and masked.
 * Plain Node, no dependencies.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const DIST_DIR = path.join(ROOT, 'dist');
const FORBIDDEN_KEYS = new Set(['lyric', 'lyrics', 'text']);
const INTENT_MAX = 120;
const LINE_MIN_CHARS = 12;
const SHINGLE_WORDS = 4;
const SHINGLE_MIN_CHARS = 18;
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.zip', '.gz', '.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.pdf']);
const isLocalLyrics = (name) => name.startsWith('lyrics.local.json');
const isExactLocalLyrics = (name) => name === 'lyrics.local.json';

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
const normalise = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const mask = (s) => `${s.slice(0, 2)}…(${s.length} chars)`;

/** @returns {Promise<string[]>} */
async function walk(dir, filter) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, filter)));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

function scanKeys(node, trail, errors) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => scanKeys(v, `${trail}[${i}]`, errors));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const here = trail ? `${trail}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${here}: forbidden key "${key}"`);
    if (key === 'intent' && typeof value === 'string' && value.length > INTENT_MAX) {
      errors.push(`${here}: intent is ${value.length} chars (max ${INTENT_MAX}); paraphrase, don't paste`);
    }
    scanKeys(value, here, errors);
  }
}

function gitLsFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
  } catch {
    return null; // not a git checkout
  }
}

/** Build needles from every local lyrics file: { needle -> "songId/lineId" } */
async function collectNeedles() {
  const needles = new Map();
  const files = await walk(path.join(DATA_DIR, 'songs'), isExactLocalLyrics);
  for (const file of files) {
    const songId = path.basename(path.dirname(file));
    let json;
    try {
      json = JSON.parse(stripBom(await readFile(file, 'utf8')));
    } catch {
      continue;
    }
    if (json === null || typeof json !== 'object') continue;
    for (const [lineId, raw] of Object.entries(json)) {
      if (typeof raw !== 'string') continue;
      const line = normalise(raw);
      const label = `${songId}/${lineId}`;
      if (line.length >= LINE_MIN_CHARS && !needles.has(line)) needles.set(line, label);
      const words = line.split(' ');
      for (let i = 0; i + SHINGLE_WORDS <= words.length; i++) {
        const sh = words.slice(i, i + SHINGLE_WORDS).join(' ');
        if (sh.length >= SHINGLE_MIN_CHARS && !needles.has(sh)) needles.set(sh, label);
      }
    }
  }
  return { needles, sources: files.length };
}

async function isTextFile(file) {
  if (BINARY_EXT.has(path.extname(file).toLowerCase())) return false;
  try {
    const s = await stat(file);
    if (s.size > 20 * 1024 * 1024) return false;
  } catch {
    return false;
  }
  return true;
}

const failures = [];

// 1 + 2: forbidden keys and long intents in committed data JSON.
for (const file of await walk(DATA_DIR, (n) => n.endsWith('.json') && !isLocalLyrics(n))) {
  const rel = path.relative(ROOT, file);
  let json;
  try {
    json = JSON.parse(stripBom(await readFile(file, 'utf8')));
  } catch (e) {
    failures.push(`${rel}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  const errors = [];
  scanKeys(json, '', errors);
  for (const err of errors) failures.push(`${rel}: ${err}`);
}

// 3: a lyrics file must never be tracked.
const tracked = gitLsFiles();
if (tracked) {
  for (const f of tracked) {
    if (isExactLocalLyrics(path.basename(f))) failures.push(`${f}: lyrics file is tracked by git; run git rm --cached`);
  }
}

// 4: lyric text must not appear in tracked files or in dist/.
const { needles, sources } = await collectNeedles();
let scanned = 0;
if (needles.size > 0) {
  const candidates = new Set();
  for (const f of tracked ?? []) candidates.add(path.join(ROOT, f));
  for (const f of await walk(DIST_DIR, () => true)) candidates.add(f);
  for (const file of candidates) {
    if (isLocalLyrics(path.basename(file))) continue;
    if (!(await isTextFile(file))) continue;
    let content;
    try {
      content = normalise(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
    scanned++;
    const hits = new Set();
    for (const [needle, label] of needles) {
      if (content.includes(needle)) hits.add(`${label} ${mask(needle)}`);
    }
    if (hits.size) failures.push(`${path.relative(ROOT, file)}: contains lyric text from ${[...hits].slice(0, 5).join(', ')}${hits.size > 5 ? ` (+${hits.size - 5} more)` : ''}`);
  }
}

if (failures.length) {
  console.error('check-no-lyrics: FAILED');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(
  `check-no-lyrics: ok (${sources} local lyrics file${sources === 1 ? '' : 's'}, ${needles.size} needles, ${scanned} files scanned${tracked ? '' : ', no git'})`,
);
