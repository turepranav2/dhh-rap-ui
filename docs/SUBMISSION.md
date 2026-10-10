# Submission form answers (Mumbai Build Day)

Owner checks every line and submits by hand. Placeholders in `<angle brackets>` need your input.

## Team
- **Team name:** `<team name>`
- **Members:** `<your name>` (solo, or add names)
- **Participant email(s):** `<pick: esportsengineers@gmail.com / turepranav2@gmail.com>`

## Project
- **Project name:** DHH Rap UI Build-Ups
- **One-line pitch:** A web player where every bar of a Desi hip-hop track builds its own interactive UI scene behind the song — Spotify Canvas, but per line and tappable — demoed on "101" by Karma and "Kaha Tak" by KR$NA.
- **Longer description (if asked):** Streaming apps show scrolling lyrics; DHH bars are dense with wordplay, double meanings and references. We render each line as a small, familiar UI (call screen, UPI payment, map pin, chat, signage) that lands on the beat and twists at the punchline. Everything is driven by one song clock, so scrubbing never shows the wrong scene, and it runs on a phone in portrait. Lyrics stay local and are never published; the public build shows only visuals.
- **Live link:** `<paste the Vercel URL after deploy>`
- **Repo:** https://github.com/turepranav2/dhh-rap-ui
- **Tech:** Vite, React 19, TypeScript strict, Zustand, Framer Motion, Tailwind 4, Vitest, Playwright. Spotify iFrame Embed API for playback (no audio hosted).

## How we used Claude (only what actually happened in this repo)
- Claude Code with **Claude Sonnet 5.5** as the planner: researched current Spotify iFrame/Web Playback SDK terms, wrote the decisions log (playback strategy, lyric-licensing options, demo scope) and broke the roadmap into one-session builder tasks with acceptance criteria.
- Claude Code with **Claude Fable 5.1** as the builder: implemented the scaffold, the binary-search timeline engine, the SongClock adapters and drift-corrected extrapolation (with 58 unit tests), the Spotify embed spike page, the dev-only author/sync tool, the lyric-leak guard (`pnpm check:no-lyrics`, pre-push + CI) and the Playwright phone-viewport e2e test, committing each task separately.
- Note for the form: we did **not** use Claude Opus 5.5 on this project. If the form only offers Opus/Sonnet, state "Sonnet 5.5 (planning) + Fable 5.1 (implementation)" in the free-text field rather than ticking Opus.

## Legal / credits line (if there is a field)
Audio via Spotify embed; no audio or lyric text is hosted. "101" © Karma & Naam Sujal (MAD DAWG, 2026); "Kaha Tak" © KR$NA, Jokhay, Umair (Time Will Tell, 2023). Not affiliated with Spotify or the artists.
