# Data Schema and Scene Contract

## data/songs/<id>/song.json (committed, NO lyric text)
```json
{
  "id": "101",
  "title": "101",
  "artists": ["Karma", "Naam Sujal"],
  "album": "MAD DAWG",
  "trackNumber": 8,
  "durationMs": 225000,
  "spotifyTrackId": "47TOcXCzgTPkbAkSZv0BCl",
  "offsetMs": 0,
  "theme": { "bg": "#0b0b0f", "fg": "#f5f5f5", "accent": "#ff3b30", "font": "Space Grotesk" },
  "sections": [{ "id": "intro", "label": "Intro", "startMs": 0 }],
  "lines": [
    {
      "id": "L01",
      "startMs": 0,
      "endMs": 0,
      "section": "intro",
      "voice": "Karma",
      "intent": "one-line paraphrase of what the bar means (NOT a quote)",
      "scene": "L01",
      "tags": ["wordplay", "money"]
    }
  ]
}
```
`voice` matters on a feature track: Karma vs Naam Sujal can have different accent colours.

## data/songs/<id>/lyrics.local.json (GITIGNORED)
```json
{ "L01": "owner pastes the line text here" }
```

## Scene contract
```ts
export interface SceneProps {
  progress: number;          // 0..1 across the line's duration
  lineDurationMs: number;
  active: boolean;           // false during pre-roll / exit
  theme: Theme;
  lyric?: string;            // only if lyrics.local.json exists
  voice: string;
}
export type Scene = React.ComponentType<SceneProps>;
```
Rules:
- Pure function of `progress` + local interaction state. No `setTimeout` for timing.
- Correct when mounted at any progress (seek-safe).
- Size to the 9:16 Stage via container units (`cqw`/`cqh`), not viewport units.
- Provide a reduced-motion fallback.
- Stage handles in/out transitions; the scene handles only its content.

## Scene design doc (planner output, one per line): docs/scenes/L01.md
```
# L01
- Section / voice / time (ms)
- UI family (see docs/scenes/PROTOCOL.md)
- Intent (paraphrase, no quote)
- Visual metaphor: what UI represents it, and why
- Key visual beats vs progress (0.0 appears, 0.4 punchline lands, 0.8 exit prep)
- Interaction: what a viewer can tap/drag during the bar (or "none")
- Assets needed
- Complexity: S / M / L
```
