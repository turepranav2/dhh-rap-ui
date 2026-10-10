# HANDOFF (compact context for resuming the build)

Last session: 2026-10-10. Builder model: Fable 5.1 (prompts/02_BUILDER.md). Planner: Sonnet 5.5 (prompts/01_PLANNER.md).
Read order to resume: this file -> docs/ROADMAP.md (Decisions log D1-D5 + task ticks) -> docs/RUN_SHEET.md.

## Context in one paragraph
Hackathon submission (Mumbai Build Day): public demo first, polish second. Two demo songs: `101` (Karma, Naam Sujal) and `kaha-tak` (KR$NA, Jokhay, Umair). Repo public at https://github.com/turepranav2/dhh-rap-ui (branch `main`). Hard rules: no lyric text or audio in tracked files or the bundle; animations driven by the song clock; TS strict, no `any`. Demo mode on ManualClock is the guaranteed no-Spotify fallback (D5).

## State
Done and pushed (commits `ad5f4e3` .. `dcd9101`): M0 scaffold; M1 timeline engine, SongClock/ManualClock/store/useSongClock, extrapolate helper; M2.1 spike page `/dev/embed` (Run script, Copy report), `/author` (lyrics paste + tap-to-sync via dev-server endpoints `/__author/*`), LocalAudioClock (M2.3), Playwright e2e (`pnpm e2e`), `pnpm check:no-lyrics` (text-match over tracked files + dist, pre-push hook, CI), docs/SUBMISSION.md, vercel.json + README deploy steps.

**WIP in the last commit (`wip(M3)`), verified by lint/typecheck/build only, e2e not re-run after the 404 fix:**
- M3.1 `src/player/Stage.tsx` + `transitions.ts` (default/cut/whip/match, pre-roll 300 ms, voice accent swap), `src/scenes/Fallback.tsx`, `useSceneMotion.ts`; `SceneProps.lineId` and `Line.transition`, `theme.voiceAccents` added to types + DATA_SCHEMA.
- M3.2 `src/scenes/registry.ts` (glob `./*/[A-Z][0-9]*.tsx`, lazy, cached), commented `_template/Scene.tsx`, App renders Stage with the dev scrubber as chrome.
- M3.3 fixture scenes `src/scenes/_fixture/F01-F03.tsx` (call / UPI / map pin), `/dev/scene` harness (`src/dev/SceneHarness.tsx`) using the real Stage+ManualClock path. **Unverified in a browser.**
- Fix: GET `/__author/lyrics/:id` now returns 200 `{lyrics: null}` when no file (was 404 -> console error -> e2e fail).

## First commands on resume
```
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:no-lyrics
pnpm e2e          # must be green; if 404 console errors persist, check scripts/author-dev-plugin.ts GET lyrics branch
pnpm dev          # open /?song=101 (Demo), /dev/scene (harness), /author, /dev/embed
```
Then: eyeball `/dev/scene` for F01-F03 at 0 / 0.5 / 1 and "remount @0.7"; tick M3.1-M3.3 in ROADMAP with notes; split the WIP into proper commits if desired (`feat(M3): ...`).

## Next tasks (D5 order)
1. Finish M3 verification (above). 2. M4 leftovers (edit intent/section in SyncTool, +-10/100 nudges). 3. Owner provides lines + timings via `/author` for both songs -> planner (Sonnet 5.5) writes `docs/scenes/<lineId>.md` per docs/scenes/PROTOCOL.md for the opening 4-6 bars of each song -> builder implements `src/scenes/<songId>/Lxx.tsx`. 4. M2.2 SpotifyEmbedClock ONLY if docs/SPIKE_EMBED.md says Branch 2/3. 5. Deploy on Vercel (settings preset), paste URL into docs/SUBMISSION.md.

## Owner-only items (see RUN_SHEET.md)
Phone eyeball of Demo mode; spike runs (desktop + phone, logged in) -> paste reports -> choose branch 1/2/3; lyrics paste + tap-sync with own audio file; decisions D2 (lyrics on public build; default B no text) and D4 (album art); Vercel import; submission form.

## Conventions
- One task = one commit, `feat(M3): ...` style, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Tell the owner what you are about to do before doing it; tick ROADMAP with a one-line note after each task.
- Verify sequence: lint, typecheck, test, build, check:no-lyrics, e2e. Push runs the pre-push hook.
- e2e test ids in App.tsx: `song-select`, `active-id`, `progress-bar`, `status`, `demo`, `scrub`. Fixture ids F01..F08 (`src/core/__fixtures__/lines.ts`), scenes for them in `src/scenes/_fixture/`.
- `offsetMs` is applied only in `store.tick()`, never in adapters. Scenes are pure of `progress`; the only rAF is `useSongClock`.

## Gotchas
- TypeScript pinned to 6.x (typescript-eslint has no TS 7 support). `baseUrl` removed; `paths` must be relative.
- `exactOptionalPropertyTypes` is on: build `RequestInit`/optional props conditionally.
- pnpm installed via `npm i -g pnpm` (corepack shim was broken). `packageManager` pinned pnpm@12.10.1.
- PowerShell wraps git/pnpm stderr as "NativeCommandError"; check exit codes, not red text.
- Playwright: read id + width in ONE `page.evaluate` (two round-trips race). Range inputs: set via native setter + `input` event.
- Lyrics never go through the bundler: loadSong fetches `/__author/lyrics/:id` in DEV only; production always `lyrics: null`.
- Vite warns about `./scripts/author-dev-plugin` import without extension; harmless, add `.ts` if the warning bothers.
