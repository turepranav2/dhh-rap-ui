# M2.1 Spike: Spotify iFrame Embed behaviour

Owner fills the matrix from `/dev/embed` (dev server: `pnpm dev`, open `http://<host>:5173/dev/embed`). Run in this order and stop once the decision questions are answered: (a) desktop logged-in, (b) phone logged-in, (c) logged-out only if time allows. Press **copy log JSON** at the end of each run and paste the `stats` block below (not the full log).

## Known facts before the spike (planner research, 2026-10-10)
- Official docs: `playback_update` payload is `{playingURI, isPaused, isBuffering, duration, position}` (ms). No documented update interval. Safari blocks autoplay without a user gesture. Docs are silent on preview vs full playback.
- Community reports (unofficial): logged-out visitors get ~30 s previews; full tracks need a logged-in Spotify browser session and `allow="encrypted-media"`. Some Premium users still report previews, and `play()`/`resume()` via API starting a preview while the iframe's own button plays the full track.
- Developer Policy (effective 2025-05-15) III.6: do not synchronize sound recordings with visual media. Risk accepted/unresolved per ROADMAP D1; this spike does not change that.
- The spike page never hides, covers or restyles the embed.

## Decision questions (answer each with the run that settled it)
| # | Question | Answer | Run |
|---|---|---|---|
| Q1 | Does a logged-in user get the full track via the API `play()` (duration ≈ 225000 for 101 / 214000 for Kaha Tak), or a ≤31 s preview? | | |
| Q2 | Median interval between `playback_update` events while playing (ms)? Max gap? | | |
| Q3 | Drift of `position` vs wall clock after 60 s of continuous play (min/max driftMs)? Within ±250 ms (ease) or does it need snaps? | | |
| Q4 | Does `seek(60)` land at ~60000 and emit an update promptly? Does `seek` work in preview mode? | | |
| Q5 | Is the first `playback_update` after `play()` delayed relative to audible start? (estimate by ear, ms) | | |
| Q6 | Does `loadUri` switch tracks without recreating the controller? | | |
| Q7 | Does the ManualClock **Demo** button on `/` run the full fixture loop with no Spotify at all? | | |

## Matrix
| Run | Device / browser | Spotify login | Track | duration reported | preview? | updates | interval median/min/max | drift min/max | seek ok | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| a1 | desktop | logged-in | 101 | | | | | | | |
| a2 | desktop | logged-in | kaha-tak | | | | | | | |
| b1 | phone | logged-in | 101 | | | | | | | |
| b2 | phone | logged-in | kaha-tak | | | | | | | |
| c1 | desktop | logged-out | 101 | | | | | | | |
| c2 | phone | logged-out | 101 | | | | | | | |

## Pasted `stats` blocks
```
(paste here, one per run, label with run id)
```

## Conclusion (owner)
- Primary clock for the demo: SpotifyEmbedClock / ManualClock demo mode (circle one)
- Changes needed in M2.2 (e.g. preview detection threshold, snap threshold):
