# Project Brief

## Vision
Hip-hop in India (DHH) is lyric-dense: wordplay, double meanings, references. Streaming apps show plain scrolling lyrics. We build a **"UI build-up" experience**: as each bar lands, the screen constructs a UI that *visualises or plays with that exact line*. A line about a phone call becomes a call screen, money becomes a ticker, a place becomes a map pin, and so on, all synced to the beat.

## Differentiator vs Spotify Canvas / lyrics view
| Spotify | This project |
|---|---|
| One looping video per track | A distinct scene per line |
| Passive | Interactive (tap, drag, hold during the bar) |
| Generic | Authored from the bar's meaning |

## First deliverable (MVP)
One complete song, "101" by Karma, playing with synced scenes for every line, shareable as a web link, works on a phone.

## Users
1. **Viewer**: opens link, presses play, watches and pokes at the UI.
2. **Author (the owner)**: syncs lines to time, designs a scene per line, previews.

## Non-goals (for MVP)
- Multi-user accounts, a CMS, or any auto lyric fetching.
- Auto-generated scenes from lyrics (maybe later as author assist).
- Hosting copyrighted audio.

## Success criteria
- Scene change is within +/-80 ms of the authored timestamp.
- 60 fps on a mid-range Android phone.
- Scrubbing/seeking never leaves a wrong scene on screen.
- Adding a new scene takes under 30 min of work using the template.

## Open questions (planner must resolve and record in ROADMAP.md)
1. Playback source: Spotify iFrame embed (30s preview when logged out, full for logged-in listeners; exposes position events) vs Web Playback SDK (Premium only, full control) vs owner-provided local audio for authoring/demo. Recommend one primary and one fallback.
2. Language handling: lyrics are likely Hinglish/Hindi; support Roman and Devanagari display toggles?
3. Legal posture for public sharing (lyrics display licence). Flag risk to owner; do not decide.
4. Rights/credit for featured artist Naam Sujal and album art usage.
