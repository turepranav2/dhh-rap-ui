#!/usr/bin/env node
/**
 * Guard against lyric text leaking into tracked files (CLAUDE.md hard rule).
 *
 * Fails if:
 *  1. any data/**\/*.json other than lyrics.local.json* contains a key named
 *     `lyric`, `lyrics` or `text` at any depth;
 *  2. any `intent` string is longer than INTENT_MAX chars (a long "intent" is
 *     usually a pasted line);
 *  3. a lyrics.local.json is tracked by git.
 *
 * Plain Node, no dependencies. Run: pnpm check
 */
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const FORBIDDEN_KEYS = new Set(['lyric', 'lyrics', 'text']);
const INTENT_MAX = 120;
const isLocalLyrics = (name) => name.startsWith('lyrics.local.json');

/** @returns {Promise<string[]>} */
async function walkJson(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkJson(full)));
    else if (entry.name.endsWith('.json') && !isLocalLyrics(entry.name)) out.push(full);
  }
  return out;
}

/** @param {unknown} node @param {string} trail @param {string[]} errors */
function scan(node, trail, errors) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => scan(v, `${trail}[${i}]`, errors));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const here = trail ? `${trail}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${here}: forbidden key "${key}"`);
    if (key === 'intent' && typeof value === 'string' && value.length > INTENT_MAX) {
      errors.push(`${here}: intent is ${value.length} chars (max ${INTENT_MAX}); paraphrase, don't paste`);
    }
    scan(value, here, errors);
  }
}

function trackedLyricsFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '--', 'data'], { cwd: ROOT, encoding: 'utf8' });
    // Exact name only: the committed lyrics.local.json.example is a placeholder and allowed.
    return out.split(/\r?\n/).filter((f) => f && path.basename(f) === 'lyrics.local.json');
  } catch {
    return []; // not a git checkout; rule 3 cannot be checked
  }
}

const failures = [];

for (const file of await walkJson(DATA_DIR)) {
  const rel = path.relative(ROOT, file);
  let json;
  try {
    const raw = await readFile(file, 'utf8');
    json = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw); // tolerate a BOM
  } catch (e) {
    failures.push(`${rel}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  const errors = [];
  scan(json, '', errors);
  for (const err of errors) failures.push(`${rel}: ${err}`);
}

for (const f of trackedLyricsFiles()) failures.push(`${f}: lyrics file is tracked by git; run git rm --cached`);

if (failures.length) {
  console.error('check-no-lyrics: FAILED');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('check-no-lyrics: ok');
