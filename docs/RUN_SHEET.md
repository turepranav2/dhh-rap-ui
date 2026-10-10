# Run sheet (owner, by hand)

Everything the builder cannot do because it needs your Spotify session, your phone, or your judgement. One action and one expected result per item. Tick as you go.

## 0. Setup (once)
- [ ] `pnpm install` → finishes without errors.
- [ ] `pnpm dev` → prints a Network URL like `http://192.168.x.x:5173/`. Keep it running.
- [ ] Phone on the same Wi-Fi opens that URL → stage with the `101` dropdown appears.

## 1. Phone eyeball check (the e2e test covers the logic; this covers the feel)
- [ ] Phone: `http://<ip>:5173/?song=101`, tap **Demo** → big id runs F01 → F08, accent bar fills per line, loops.
- [ ] Phone: `/?song=kaha-tak` → same, but the accent is cyan not red.
- [ ] Drag the scrubber while paused → the id matches the time (5.0 s shows `···`, 6.0 s shows F05).
- [ ] Nothing stutters on the phone. If it does, note the phone model in docs/QA.md (create it).

## 2. Spike: desktop, logged in (run this first)
- [ ] Desktop Chrome, log in at open.spotify.com in the same browser profile.
- [ ] Open `http://localhost:5173/dev/embed` → "api: ready", embed visible.
- [ ] Device field: `desktop Chrome`; Login: `logged-in premium` or `logged-in free`.
- [ ] Press **Run script** → audio plays within ~2 s; "step: wait60" counts down.
- [ ] While it plays, read the **preview?** stat → `no, full track` means the embed is usable; `YES (≤31 s)` means preview-only.
- [ ] Wait for "step: done" (~70 s) → the stats block shows interval, drift, seek(60) landed.
- [ ] Press **Copy report** → paste into docs/SPIKE_EMBED.md under "Pasted reports".
- [ ] Switch Track to Kaha Tak, press **Run script** again, copy the report again.
- [ ] By ear: when the audio starts, does the first `playback_update` appear late? Write your ms guess into Q5 in the pasted report.

## 3. Spike: phone, logged in (second)
- [ ] Phone browser logged in to Spotify (Chrome on Android, Safari on iOS).
- [ ] Open `http://<ip>:5173/dev/embed`, Device: `Pixel 7 Chrome` (or similar), Login as above.
- [ ] Tap **play()** manually once (phones need a gesture) → audio starts. Then press **Run script**.
- [ ] Copy report → paste into docs/SPIKE_EMBED.md. Same for Kaha Tak if time allows.

## 4. Spike: logged out (only if time allows)
- [ ] Desktop incognito window, `localhost:5173/dev/embed`, Login: `logged-out`, **Run script** → expect `preview? YES`. Copy report.

## 5. Decision (write the chosen branch into docs/SPIKE_EMBED.md "Conclusion")
```
Was "preview?" = no (full track) in the logged-in desktop run?
├─ NO (preview only, duration ≤ 31 s)
│    → Branch 1. Default clock = ManualClock **Demo mode** (silent visuals, "Open in Spotify" link beside the stage).
│      Stage demo on the day: LocalAudioClock with your own audio file via the file picker (never committed).
│      Skip M2.2. Builder sets DEFAULT_CLOCK = 'manual'.
└─ YES (full track)
     Was drift within ±250 ms AND median interval ≤ 1500 ms AND seek(60) landed?
     ├─ YES → Branch 2. Default clock = SpotifyEmbedClock (ease ≤ 250 ms, snap above). Demo mode stays as the backup button.
     │         Builder does M2.2 as planned. DEFAULT_CLOCK = 'embed'.
     └─ NO  → Branch 3. SpotifyEmbedClock in snap-only mode (no ease) + per-song offsetMs tuned by ear in the Sync Tool.
               If scene changes are still visibly > ~80 ms off after tuning, fall back to Branch 1 for the public link.
               DEFAULT_CLOCK = 'embed' with snapOnly = true, re-evaluated after one tuning session.
```
Phone result can downgrade the branch (e.g. desktop full, phone preview → Branch 1 for the public link, Branch 2 only on the stage laptop).

## 6. Author page (after M4 is done): lyrics + sync, local only
- [ ] `http://localhost:5173/author`, pick the song, paste lines (one per line), **Save lines** → "saved N lines (L01..Lnn)". Never commit `lyrics.local.json`.
- [ ] Choose your audio file in the Sync Tool (not committed), press **Play**, press **Space** at every line start, **Save timings** → `data/songs/<id>/song.json` lines filled, `intent` empty.
- [ ] `pnpm check:no-lyrics` → "ok". If it fails, it tells you which tracked file contains lyric text; remove it before pushing.
- [ ] Commit `song.json` only (`git status` must not list `lyrics.local.json`).

## 7. Before the link goes live
- [ ] Decide D2 (lyrics on the public build): A private link / B no text / C licensed API / D permission. Default if undecided: **B**.
- [ ] Confirm album-art usage (D4) or we use a plain blurred colour backdrop.
- [ ] Vercel: import the GitHub repo, framework Vite, build `pnpm build`, output `dist`. Deploy → paste the live link into docs/SUBMISSION.md.
- [ ] Open the live link on your phone: stage loads, Demo runs, `/dev/embed` works (vercel.json rewrites all paths to index.html).
