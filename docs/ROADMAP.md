# Roadmap (planner maintains this file)

Legend: [ ] todo, [~] in progress, [x] done
Task format: **ID title** (size) | Files | Accept | Verify. One task = one builder session.

## Milestones
- [x] M0 Scaffold
- [ ] M1 Clock + Timeline
- [ ] M2 Spotify playback adapter (embed first) + Transport + offset tuning
- [ ] M3 Stage + Scene registry + scene template + 3 placeholder scenes
- [ ] M4 Sync Tool
- [ ] M5 Author all lines of "101"
- [ ] M6 Polish
- [ ] M7 Share

## Decisions log

### 2026-10-10 D1: Playback strategy
**Research (sources checked 2026-10-10):**
- iFrame Embed API (developer.spotify.com/documentation/embeds/references/iframe-api): `createController`, `loadEntity(uri, preferVideo, startAt)`, `play/pause/resume/togglePlay/restart/seek(seconds)`. Events `ready`, `playback_started`, `playback_update {isPaused, isBuffering, duration(ms), position(ms), playingURI}`. No documented update interval. Safari blocks autoplay without a gesture. Docs do NOT state preview-vs-full rules.
- Preview vs full (community reports, unofficial): logged-out visitors get ~30 s previews; full tracks need a logged-in Spotify browser session plus `allow="encrypted-media"` on the iframe. Several reports of Premium users still getting previews, and of `play()/resume()` via API starting a preview while the iframe's own button gives full playback. UNVERIFIED, so M2 starts with a spike.
- Web Playback SDK: requires the *listener* to have Premium; needs OAuth token; policy says no commercial use. Browser-only, full position/seek control.
- Developer Policy (effective 15 May 2025, developer.spotify.com/policy): **III.6 "Do not synchronize any sound recordings with any visual media"** (examples: advertising, film...). III.5 no integration of Spotify streams with another service's content. III.7 no mixing/overlapping Spotify content with other audio. IV.2 no commercial use of SDAs. II.5 no playback without cover art + metadata shown. Design guidelines: no overlaying text/images on album art. Embeds fall under separate "Widgets Terms" that I could not retrieve.

**Decision:**
- **Primary: Spotify iFrame Embed** (`SpotifyEmbedClock`), embed kept visible and unmodified (small, bottom of Stage, never hidden or covered), user gesture to start, preview-mode detection with a UI banner ("log in to Spotify for full track"). Reasons: no OAuth, works for free users, exposes `position`, lowest friction for a shared link.
- **Fallback: `LocalAudioClock`** with an owner-provided audio file via `<input type=file>` (object URL, never committed or hosted; `data/**/*.{mp3,wav,m4a,flac}` gitignored). Exact `currentTime`, frame-accurate, no Spotify dependency. Used for the Sync Tool (accurate tapping), dev, private demos, and as the clean path if Spotify objects.
- **Not v1: Web Playback SDK** (`SpotifySdkClock`). Premium-only plus non-commercial plus the same III.6 problem; adds OAuth complexity. Revisit only if the embed's position accuracy fails the +/-80 ms goal.

**Risks:**
1. **HIGH: Spotify III.6 (sync with visual media) may apply to this whole product concept.** Whether it covers the embed (Widgets Terms) is unresolved. Mitigation: keep non-commercial, keep embed intact, no audio capture/recording, and ask owner to decide (see Q1). Do not ship publicly until the owner has accepted this risk or got permission.
2. Embed position events are sparse and jittery, so extrapolation + drift correction (ARCHITECTURE.md) is mandatory. Measure in M2.
3. Preview-only playback for logged-out viewers breaks a 3:45 experience beyond 0:30. Detect and tell the user.
4. Autoplay policy: always start from a visible Play tap.
5. Spotify may change embed behaviour without notice. Isolate behind `SongClock`.

### 2026-10-10 D2: Lyric-licensing risk (OWNER DECIDES, planner does not)
Lyrics are copyrighted. Repo is already safe (no text committed). Risk arises when a *deployed* site renders or serves lyric text. Options:
| Option | What it means | Pros | Cons |
|---|---|---|---|
| A. Private link / owner-only | Deploy behind password or run locally; lyrics.local.json present only on owner's machine | Lowest risk, zero setup cost | Not shareable |
| B. Show no text | Public build ships without lyrics.local.json; scenes show only visuals/UI-derived microcopy that is the owner's own wording | Shareable, still the full concept | Some scenes lose punch if the metaphor needs the words; scenes must degrade gracefully (`lyric` is already optional) |
| C. Licensed lyric API | e.g. Musixmatch/LyricFind commercial licence, display via their widget/API | Legit text on screen | Cost, terms restrict storage/animation, conflicts with "no scraping" rule only if unofficial |
| D. Artist/label permission | Written OK from Karma / Naam Sujal / label for lyric display and for the visuals | Solves D2 and Spotify risk best | Needs contact and time |
Planner note (not a decision): the scene pipeline works under A, B, D without code change. Build every scene so it is valid with `lyric` undefined.

### 2026-10-10 D3: Language handling (planner recommendation, adopt unless owner objects)
- Scene docs and `intent` fields are English paraphrase with Hinglish terms in Roman script.
- `lyrics.local.json` value may be a string (Roman) OR `{ "rom": "...", "dev": "..." }`. Rail shows a Roman/Devanagari toggle only when `dev` exists. Noto Sans Devanagari already in the design guide's font stack. Implemented in M4/M6, not before.

### 2026-10-10 D4: Credits (OPEN, needs owner)
Naam Sujal credited as featured artist in Stage footer and share page. Album art: used only as blurred backdrop (not overlaid with text) and in the Spotify metadata block; needs owner confirmation of rights. See Q4.

## Task breakdown

### M0 Scaffold
- [x] **M0.1 Project init** (S) — done 2026-10-10: Vite 8 / React 19.3 (pnpm resolved 19, not 18; works) / TS 6 (TS 7 was tried first; typescript-eslint doesn't support it yet) / Tailwind 4 via `@tailwindcss/vite` (no postcss/tailwind config files needed) / Vitest 5. `@types/node` added (type stubs only). Alias `@/*` -> `src/*`. | Create: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json` (strict, `noUncheckedIndexedAccess`), `index.html`, `src/main.tsx`, `src/App.tsx`, `tailwind.config.ts`, `postcss.config.js`, `src/index.css`. Deps ONLY from ARCHITECTURE.md: react, react-dom, zustand, framer-motion, tailwindcss, vitest, typescript, vite. (GSAP stays deferred; ask before adding.) | Accept: `pnpm dev` shows a 9:16 centred stage placeholder; scripts `dev/build/typecheck/test` exist. | Verify: run all four scripts; `test` may pass with no tests (`--passWithNoTests`).
- [x] **M0.2 Folder layout + lint guards** (S) — done 2026-10-10: module tree stubbed (`export {}` + purpose comment), `src/types/song.ts` per DATA_SCHEMA, ESLint 10 + typescript-eslint flat config (`no-explicit-any` error, `pnpm lint`), audio patterns in `.gitignore`, `.gitattributes` LF. Verified: typecheck/lint/build clean, `git check-ignore` hits lyrics + audio, grep for `any` empty. | Create the ARCHITECTURE.md module tree with stub files (`src/core/clock/SongClock.ts` etc.), `src/scenes/_template/Scene.tsx`, `src/types/song.ts` (Song, Line, SceneProps, Theme per DATA_SCHEMA), `.gitignore` additions (`lyrics.local.json`, audio files, `.env*`), `eslint` flat config banning `any` (ask before adding eslint if not listed). | Accept: types match DATA_SCHEMA exactly; `pnpm typecheck` clean. | Verify: typecheck; `git check-ignore data/songs/101/lyrics.local.json` returns the path; grep repo for `: any` returns nothing.
- [x] **M0.3 Song loader + CI check for lyrics leakage** (S) — done 2026-10-10: `loadSong(id)` via `import.meta.glob` (lyrics file absent -> `null`), `applyTheme` writes CSS vars, first Vitest test. `scripts/check-no-lyrics.mjs` (plain Node, `pnpm check`) fails on `lyric`/`lyrics`/`text` keys, `intent` > 120 chars, or a git-tracked `lyrics.local.json`; verified on clean, bad-fixture and tracked-file cases, and app boots with/without the local file. | `src/data/loadSong.ts` (imports `song.json`, optionally loads `lyrics.local.json` via `import.meta.glob` so a missing file is fine), `scripts/check-no-lyrics.ts` (fails if tracked JSON other than `lyrics.local.json*` contains a `lyric`/`text` field or lines > 120 chars in `intent`), wire as `pnpm check`. | Accept: app boots with and without lyrics.local.json. | Verify: delete/restore the file locally; run `pnpm check` on clean and on a deliberately bad fixture.

### M1 Clock + Timeline
- [x] **M1.1 Timeline engine** (M) — done 2026-10-10: `createTimeline(lines)` -> `{activeIndexAt, progressAt (null when inactive), nextLineAt (first start strictly after t), diff (state delta, max 2 events, no replay on seek)}`. Validation throws `TimelineError` always (not only in dev): unsorted, overlap, end<start, dup id, non-finite. Zero-duration lines allowed but never active so an unsynced song.json boots. 23 tests incl. 1000-line linear-scan equivalence. | `src/core/timeline/timeline.ts`, `timeline.test.ts`. API: `createTimeline(lines)`, `activeIndexAt(t)`, `progressAt(t)`, `nextLineAt(t)` (pre-roll), `diff(prevT, nextT)` -> enter/exit events. Handle gaps between lines (returns -1, i.e. instrumental) and overlap/unsorted input (throws in dev). | Accept: tests cover empty list, before first, in gap, boundaries (start inclusive, end exclusive), last line, seek backward/forward, 1000 lines perf. | Verify: `pnpm test`.
- [x] **M1.2 SongClock interface + ManualClock + store** (M) — done 2026-10-10: `SongClock {kind,status,durationMs,now,play,pause,seek,onSeek,onPlayPause,destroy}` + `createSignal`. `offsetMs` is NOT on the interface; it lives in the store and is applied only in `tick()`. `ManualClock` has injectable `nowFn` (7 tests). Zustand store derives `activeLineId/progress/nextIndex`; `useSongClock` is the sole rAF owner and loops only while playing. Fixture ids are `F01..F08` in `src/core/__fixtures__/lines.ts`; App.tsx dev scrubber uses it while song.json has no lines. Owner: run `pnpm dev`, press Play, watch the id/progress bar. | `SongClock.ts`, `ManualClock.ts`, `src/core/store.ts`, `src/core/useSongClock.ts` (rAF loop that reads `clock.now()` and writes `positionMs`/`activeLineId`; the only place rAF is allowed). | Accept: `SongClock = {now(), status, offsetMs, play, pause, seek, onSeek, onPlayPause, destroy}`; ManualClock scrubbing changes `activeLineId`; offsetMs applied centrally, not per-adapter. | Verify: unit tests for ManualClock; temporary dev scrubber in `App.tsx` shows active id changing against a fixture timeline in `src/core/__fixtures__/` (fake ids, no lyrics).
- [ ] **M1.3 Drift-corrected extrapolation helper** (S) | `src/core/clock/extrapolate.ts` + tests. Pure function: given `lastPos, lastAt, now, playing, newReport` implements snap if error > 250 ms else ease ~200 ms (ARCHITECTURE.md). | Accept: deterministic tests with injected `nowFn`; no real timers. | Verify: `pnpm test`.

### M2 Spotify playback adapter
- [ ] **M2.1 SPIKE: embed behaviour report** (S) | Create `src/dev/EmbedSpike.tsx` (route `/dev/embed`) logging every `playback_update` with `performance.now()` deltas, `duration`, `position`, buffering flags; test: logged-out (preview), logged-in free, logged-in Premium (owner device), desktop Chrome, Android Chrome, iOS Safari if available. Write findings into `docs/SPIKE_EMBED.md` (no lyrics). | Accept: report answers: update interval, jitter, does `seek()` work, does `play()` give full track, what `duration` says in preview mode (use as preview detector), does position lag audio. | Verify: owner reads the report; planner updates D1 if findings contradict.
- [ ] **M2.2 SpotifyEmbedClock** (L) | `src/core/clock/SpotifyEmbedClock.ts`, `src/player/SpotifyEmbed.tsx` (loads `https://open.spotify.com/embed/iframe-api/v1` once, `allow="encrypted-media"`, keeps embed visible with compact height), uses extrapolate.ts. Preview-mode detection exposes `status.previewOnly`. | Accept: implements SongClock; survives pause/seek/buffering/track end/restart; embed never hidden or covered. | Verify: manual test matrix from spike; unit tests with a mocked controller.
- [ ] **M2.3 LocalAudioClock** (M) | `src/core/clock/LocalAudioClock.ts`, `src/player/LocalAudioPicker.tsx`. Uses `HTMLAudioElement.currentTime`; file via picker, object URL only. | Accept: same SongClock behaviour; nothing persisted or uploaded; audio extensions gitignored. | Verify: pick a local file, scrub, active line updates.
- [ ] **M2.4 Transport + clock switcher + offset tuning** (M) | `src/player/Transport.tsx` (play/pause/scrub bar/time), `src/player/ClockSwitcher.tsx` (Embed | Local | Manual), offset +/- nudge (10 ms steps) writing to a store and exportable. Previews banner. | Accept: one tap starts playback on mobile; switching clocks keeps position; offset change is live. | Verify: manual on phone; Playwright optional only after asking about the dependency.

### M3 Stage + registry
- [ ] **M3.1 Stage + transitions** (M) | `src/player/Stage.tsx` (container-query 9:16, safe padding, desktop blurred album-art backdrop slot, embed slot), `src/player/transitions.ts` (default 140 ms crossfade+scale; hard-cut, whip-pan, match-cut variants selected by `line.transition`, add optional field to schema + DATA_SCHEMA.md). | Accept: renders one active scene with exit/enter; scenes mounted 300 ms pre-roll hidden (`active=false`). | Verify: ManualClock scrub across fixture lines with no flicker; reduced-motion = cut.
- [ ] **M3.2 Scene registry + template** (S) | `src/scenes/registry.ts` (lineId -> `React.lazy`, with `import.meta.glob('./101/*.tsx')`), `_template/Scene.tsx` fully commented per Scene contract, `src/scenes/Fallback.tsx` (generic scene when a line has no scene file: accent bar + progress). | Accept: missing scene file never crashes; chunk per scene. | Verify: remove a placeholder file, Stage shows Fallback; `pnpm build` lists separate chunks.
- [ ] **M3.3 Three placeholder scenes + progress harness** (S) | `src/scenes/101/L01.tsx..L03.tsx` using fake fixture lines (placeholders only, no real lines), `src/dev/SceneHarness.tsx` (progress slider, active toggle, reduced-motion toggle, voice toggle). | Accept: scenes are pure of `progress`; correct when mounted at progress 0.7; use `cqw`/`cqh`. | Verify: harness at 0, 0.5, 1 and mid-mount; typecheck.

### M4 Sync Tool
- [ ] **M4.1 Tap-to-sync core** (L) | `src/author/SyncTool.tsx`, `src/author/syncModel.ts` (+ tests). Flow: owner loads clock (prefer LocalAudioClock for accuracy), line list from `lyrics.local.json` ids, press Space/tap at each line start; stores startMs; endMs = next start by default; Backspace undoes last tap; sections markable. | Accept: model tested for undo, re-tap, insert, ordering; applies `offsetMs` reaction-time compensation setting (default 0). | Verify: `pnpm test`; manual sync of 5 fixture lines.
- [ ] **M4.2 Edit, nudge, export** (M) | Extend SyncTool: per-line +/-10 ms and +/-100 ms nudge, edit voice/section/intent (intent field text is free but the tool warns if it exceeds 120 chars, as a quote guard), Export/Import `song.json` (download; schema validation, preserve `scene` ids). Autosave drafts to localStorage (timings only, no lyric text). | Accept: exported JSON validates against `types/song.ts` and passes `pnpm check`. | Verify: export, replace `song.json`, reload app, scenes follow.
- [ ] **M4.3 ScenePreview: jump + loop** (M) | `src/author/ScenePreview.tsx`: line list, jump to any line (seeks clock to `startMs - 300`), loop-a-line toggle, progress scrubber, hotkeys (J/K prev/next, L loop). | Accept: loop gives seamless restart on LocalAudioClock; on Embed, loop re-seeks. | Verify: manual; unit test for loop-region logic.

### M5 Author "101"
- [ ] **M5.0 Planner: scene docs** (planner session) | Per "Scene planning protocol" below. Prereq: owner finished M4.2 so `song.json.lines` is non-empty.
- [ ] **M5.n Scene batches** (builder, 4-6 lines per session, or fewer if L) | Files: `src/scenes/101/Lxx.tsx` x N + shared parts in `src/scenes/_shared/` (only after 2+ scenes need it). | Accept per scene: matches its doc, seek-safe, reduced-motion fallback, valid with `lyric` undefined, chunk < 30 KB gz, no timers. | Verify: SceneHarness at 0/0.4/0.8/mount-at-0.7; ScenePreview loop on the line; `pnpm typecheck && pnpm build`. Update the checklist in docs/scenes/BATCHES.md (created by planner in M5.0).

### M6 Polish
- [ ] **M6.1 Transitions per pair** (M) | Apply per-pair transition choices from scene docs; add `transition` to `song.json` lines. Verify: scrub through the full song, no wrong scene after seek.
- [ ] **M6.2 Perf pass** (M) | Profile at 4x CPU slowdown; fix layout-thrash (transform/opacity only), image preloading in pre-roll, memo. Accept: 60 fps on a mid-range Android profile, per-chunk < 30 KB gz. Verify: Chrome Performance traces noted in `docs/PERF.md`.
- [ ] **M6.3 Reduced motion + a11y + language toggle** (M) | `prefers-reduced-motion` respected everywhere; Roman/Devanagari toggle (D3); AA contrast check; focus order; Transport labelled. Verify: manual with OS setting; axe optional (ask first).
- [ ] **M6.4 Mobile QA + sync accuracy audit** (M) | Real devices: iOS Safari, Android Chrome; measure scene-change error against audio (slow-mo video), tune `offsetMs`. Accept: within +/-80 ms. Verify: results in `docs/QA.md`.

### M7 Share (BLOCKED on owner answers Q1-Q4)
- [ ] **M7.1 Deploy** (S) | `vercel.json` or `netlify.toml`, build excludes `lyrics.local.json` unless owner chose option A/D (build-time flag `VITE_SHOW_LYRICS`). Accept: a production build contains no lyric text when flag is off. Verify: `grep` the `dist/` for a few words from a local lyrics file (owner runs locally; never paste results).
- [ ] **M7.2 OG image + share metadata** (S) | `public/og.png` (made from a scene, no lyric text, no album-art overlay), meta tags in `index.html`.
- [ ] **M7.3 Credits + legal notice** (S) | `src/player/Credits.tsx`: artists incl. Naam Sujal, album, "Audio via Spotify", "Not affiliated", lyric notice per owner's D2 choice, Spotify branding left intact.

## Scene planning protocol (M5)
See [docs/scenes/PROTOCOL.md](scenes/PROTOCOL.md).

## Current focus
M1 (M1.3 next). M0 complete. Owner can do the lyric paste and timing sync only after M4.
