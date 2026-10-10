# Scene planning protocol (planner, M5)

Status: no scene docs yet. `data/songs/101/song.json` has `lines: []`. Per-line docs (`docs/scenes/L01.md` ...) are written after the owner has (1) pasted lines into `lyrics.local.json` and (2) exported timings via the Sync Tool (M4.2).

## Inputs the planner reads
- `data/songs/101/song.json` (ids, times, section, voice, optional `intent`/`tags`)
- `data/songs/101/lyrics.local.json` (local only; read for understanding, **never copied out**)

## Rules for every doc
1. File `docs/scenes/<lineId>.md`, template from DATA_SCHEMA.md plus one extra field: `- UI family: <family>` (and optional `- Transition in: <cut|whip|match|default>`).
2. **Never quote the line**, not even a few words, and no distinctive phrases from it. Paraphrase intent in English; Hindi/Hinglish terms may be named only when they are generic words (e.g. "paisa", "bhai"), and not as a lyric fragment. When in doubt, describe, don't name.
3. Interpret: literal meaning, wordplay, double meaning, references (people, places, brands, films, slang). If a reading is uncertain write `UNSURE: <question for owner>` rather than guessing. Collect all UNSUREs into `docs/scenes/QUESTIONS.md` by lineId.
4. Variety: no more than 2 consecutive scenes from the same UI family. Planner checks this over the whole sequence in `docs/scenes/BATCHES.md` and re-orders choices, not lines.
5. Punchline gets the biggest motion at its beat (progress value stated). Setups stay quiet.
6. Scenes must work with `lyric` undefined (see Decisions D2). On-screen text uses the owner-approved short microcopy, not the lyric.
7. Mark Complexity S / M / L. S = static layout + 1-2 tweens, < 1 h. M = several animated parts or one interaction. L = custom drawing/physics/multi-state interaction.
8. Interaction must be optional: the scene looks complete without any tap.

## UI-metaphor families (tag in each doc)
`messaging` (WhatsApp, SMS, notification) · `payments` (UPI, receipt, bank, ticker) · `maps-travel` (map pin, boarding pass, cab, navigation) · `media` (camera, reel, video player, playlist) · `system` (settings, error dialog, loading, terminal, form) · `social` (feed, profile, likes, followers) · `commerce` (cart, menu, price tag, delivery) · `signage` (street sign, auto-rickshaw, poster, hoarding) · `data` (chart, scoreboard, leaderboard, stats) · `game` (HUD, level, health bar) · `typographic` (kinetic type, only if the bar needs the words) · `abstract` (shape/colour motion for non-lyrical or bars with no clean metaphor)

## Steps
1. Planner: read all lines, write a one-paragraph section map into `docs/scenes/BATCHES.md` (hook, verses, bridge etc., which voice).
2. Pick a family per line honouring rule 4, then write each doc.
3. Group docs into builder batches of 4-6 lines (fewer if L-heavy), keep consecutive lines together so transitions can be tuned. A batch sums to at most ~2 L or ~6 S/M.
4. Write `BATCHES.md`: table `batch | lineIds | sizes | shared components | status`.
5. Owner answers `QUESTIONS.md`; planner updates affected docs.
6. Re-run the family-variety check after any edit.

## Doc skeleton (copy)
```
# Lxx
- Section / voice / time (ms): 
- UI family: 
- Intent (paraphrase, no quote): 
- Meaning notes (wordplay / double meaning / reference): 
- Visual metaphor and why: 
- Key beats vs progress: 0.0 ... / 0.4 ... / 0.8 ...
- Interaction: 
- Transition in: 
- Assets needed: 
- Complexity: S/M/L
- UNSURE: (omit if none)
```
