# Architecture

## Stack
- Vite + React 18 + TypeScript (strict)
- Zustand for song/clock state
- Framer Motion for scene transitions, GSAP (optional) for beat-tight timelines
- Tailwind for layout; CSS variables for per-song theme
- Vitest for the timeline engine
- Deploy: Vercel/Netlify static

## Module map
```
src/
  core/
    clock/
      SongClock.ts            interface
      SpotifyEmbedClock.ts    iFrame API playback_update
      SpotifySdkClock.ts      Web Playback SDK (Premium)
      LocalAudioClock.ts      owner-supplied file, authoring/demo
      ManualClock.ts          dev scrubber, tests
    timeline/
      timeline.ts             binary search: time -> active line index
      timeline.test.ts
    store.ts                  Zustand: songId, status, positionMs, activeLineId
  scenes/
    101/L01.tsx ... Lnn.tsx   one component per line
    registry.ts               lineId -> lazy scene component
    _template/Scene.tsx
  player/
    Stage.tsx                 9:16 canvas, renders active scene + transitions
    Transport.tsx             play/pause/scrub
    LyricsRail.tsx            optional line indicator (reads lyrics.local.json)
  author/
    SyncTool.tsx              tap-to-sync: play, press key at each line start, export JSON
    ScenePreview.tsx          jump to any line, loop it
  data/loadSong.ts
data/songs/101/
  song.json                   committed: metadata + timings + scene ids (NO lyric text)
  lyrics.local.json           gitignored: lineId -> text
```

## The song clock (most important piece)
Spotify position events arrive roughly every 0.5-1 s. Scenes need frame-accurate time.
- `SongClock` exposes `{ now(): ms, status, onSeek, onPlayPause }`.
- Adapter stores `lastReportedPos` and `lastReportedAt = performance.now()`; `now()` extrapolates while playing. On each report, correct drift: snap if error > 250 ms, else ease over ~200 ms.
- A per-song `offsetMs` absorbs adapter latency (tunable in Sync Tool).
- Scenes receive `progress` (0-1 within their line) from the engine, never their own timers.

## Timeline engine
- Input: sorted `lines[{id,startMs,endMs}]`.
- `activeIndexAt(t)` via binary search. Emits `enter(lineId)` / `exit(lineId)`.
- Seek-safe: on seek, compute the active line directly and mount it at the right `progress`; scenes are pure functions of `(progress, interactionState)`.
- Pre-roll: mount the next scene 300 ms early (hidden) so assets are warm.

## Scene lifecycle
mount hidden (pre-roll) -> enter transition -> driven by `progress` -> exit transition -> unmount. Interactions valid only while active.

## Performance budget
- Per-scene chunk < 30 KB gz, lazy-loaded; images preloaded during pre-roll.
- Animate transform/opacity only. Test at 4x CPU slowdown.

## Risks
- Embed position accuracy and autoplay policy (needs a user gesture).
- Spotify terms: do not hide or alter required branding/controls in embed mode.
- Lyric text licensing for public deployment.
