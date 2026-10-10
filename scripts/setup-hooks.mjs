#!/usr/bin/env node
/** Points git at the committed .githooks/ (pre-push runs check:no-lyrics). Silent no-op outside a git checkout or in CI. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
if (process.env.CI || !existsSync(path.join(ROOT, '.git'))) process.exit(0);
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT, stdio: 'ignore' });
} catch {
  // no git on PATH: nothing to do
}
