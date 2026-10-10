# DHH Rap UI Build-Ups

Interactive, line-by-line animated UI that plays *behind* a rap song. Every lyric line triggers its own visual "scene" (a UI built from the line's imagery, wordplay or punchline). Think Spotify Canvas, but per bar and fully interactive.

First song: **"101"** by Karma & Naam Sujal, album MAD DAWG (track 8, 3:45, released 2026-10-08).
Spotify: https://open.spotify.com/track/47TOcXCzgTPkbAkSZv0BCl

## Read order
1. docs/PROJECT_BRIEF.md (what and why)
2. docs/ARCHITECTURE.md (stack, modules, playback clock)
3. docs/DATA_SCHEMA.md (song JSON and scene contract)
4. docs/DESIGN_GUIDE.md (visual and motion rules)
5. docs/ROADMAP.md (milestones, current status)

## Model roles
- **Sonnet 5.5 = planner.** Use prompts/01_PLANNER.md. Output goes to docs/ROADMAP.md and docs/scenes/*.md. Never writes app code.
- **Fable 5.1 = builder.** Use prompts/02_BUILDER.md. Implements one milestone or one scene batch at a time.

## Hard rules
- **No lyrics in the repo's tracked files.** Lyrics are copyrighted. Lyric text lives only in `data/songs/<id>/lyrics.local.json`, which is gitignored. Everything committed refers to lines by `lineId` (e.g. `L07`) and by *paraphrased intent* ("line about X"), never by quoting.
- Do not scrape Spotify or Genius/Musixmatch. Lines and timestamps are authored by the owner via the in-app Sync Tool.
- Do not rip audio. Playback is via Spotify embed/Web Playback SDK, or a locally owned file the owner provides.
- One scene = one file in `src/scenes/<songId>/`, default-exporting a component that follows the Scene contract in DATA_SCHEMA.md.
- TypeScript strict. No `any`. Animations must be driven by the song clock, never by free-running timers.
- Mobile-first (portrait 9:16 is the primary canvas), desktop second.
- Ask before adding a dependency not listed in ARCHITECTURE.md.

## Commands (after M0)
- `pnpm dev`: dev server
- `pnpm build`: production build
- `pnpm typecheck`
- `pnpm test`: timeline engine unit tests
