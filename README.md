# DHH Rap UI Build-Ups

Interactive, line-by-line animated UI that plays behind a rap song: every bar gets its own scene built from the line's imagery and wordplay. Demo songs: **"101"** (Karma, Naam Sujal) and **"Kaha Tak"** (KR$NA, Jokhay, Umair). Project docs start at [CLAUDE.md](CLAUDE.md) and [docs/](docs/).

## Commands
| Command | What |
|---|---|
| `pnpm dev` | dev server on `http://localhost:5173` (and your LAN IP for phones) |
| `pnpm build` | production build to `dist/` |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | TS strict, ESLint (no `any`), Vitest unit tests |
| `pnpm e2e` | Playwright phone-viewport smoke test (Demo mode on both songs) |
| `pnpm check:no-lyrics` | fails if lyric text or a lyrics file is in tracked files or `dist/` (also runs pre-push and in CI) |

Routes on the dev server: `/?song=101` or `/?song=kaha-tak` (stage + Demo mode), `/dev/embed` (Spotify embed spike), `/author` (lyrics paste + tap-to-sync, dev only).

## Lyrics and audio policy
- Lyric text lives only in `data/songs/<id>/lyrics.local.json` (gitignored) and is served to the page by the dev server only. It is never imported by the bundler, so it cannot be in `dist/`.
- Committed files refer to lines by id (`L07`) and paraphrased `intent` only.
- No audio files are committed or hosted. Playback is the Spotify embed, or a file you own chosen in the browser.
- `pnpm check:no-lyrics` enforces all of the above; the `.githooks/pre-push` hook blocks pushes that would violate it (`pnpm install` wires the hook via `prepare`).

## Deploy (Vercel)
1. Import `https://github.com/turepranav2/dhh-rap-ui` in Vercel. Framework **Vite**, build `pnpm build`, output `dist` (all preset in `vercel.json`; `packageManager` pins pnpm 12).
2. No environment variables are needed. Do **not** upload `lyrics.local.json` or any audio to Vercel.
3. `vercel.json` rewrites every path to `index.html` so `/dev/embed` and `/?song=...` work on the live link. `/author` renders a "dev only" notice in production.
4. After the first deploy, open the link on a phone: stage loads, **Demo** runs the fixture loop, `/dev/embed` shows the embed.
5. Verify the bundle locally before/after: `pnpm build && pnpm check:no-lyrics` (scans `dist/`).

## Owner tasks
See [docs/RUN_SHEET.md](docs/RUN_SHEET.md) for everything that needs a Spotify session, a phone, or a decision.
