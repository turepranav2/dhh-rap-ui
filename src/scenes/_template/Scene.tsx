/**
 * SCENE TEMPLATE. Copy to src/scenes/<songId>/<lineId>.tsx and follow the
 * scene doc in docs/scenes/<lineId>.md. The registry picks the file up
 * automatically (uppercase letter + digits, e.g. L07.tsx).
 *
 * CONTRACT (docs/DATA_SCHEMA.md "Scene contract"):
 *  - Pure function of `progress` (0..1 across the line) + local interaction
 *    state. NO setTimeout / setInterval / requestAnimationFrame for timing:
 *    the Stage re-renders you every frame with a new `progress`.
 *  - Correct when mounted at ANY progress (seek-safe): derive every visual
 *    from `progress`, never from "what happened since mount".
 *  - `active` is false during pre-roll (mounted ~300 ms early, hidden) and
 *    during the exit transition. Only accept interaction while active.
 *  - Size with container units (cqw / cqh) inside `.scene-safe`; never vw/vh.
 *  - Reduced motion: use useReducedMotion() and replace motion with a static
 *    end state. Animate transform/opacity only.
 *  - `lyric` may be undefined (public builds). The scene must still make
 *    sense without it; use your own short microcopy, never the lyric itself
 *    as the only content.
 *  - Keep the chunk < 30 KB gz. Images go in /public and are tiny.
 *
 * TIMING HELPERS: express beats as progress values. For a 2 s line, 0.4 is
 * 800 ms in. Use `ramp(progress, from, to)` for 0..1 sub-ramps.
 */
import { useState } from 'react';
import type { Scene } from '@/types/song';
import { useReducedMotion } from '@/scenes/useSceneMotion';

/** 0 before `from`, 1 after `to`, linear in between. */
const ramp = (p: number, from: number, to: number): number =>
  p <= from ? 0 : p >= to ? 1 : (p - from) / (to - from);

const TemplateScene: Scene = ({ lineId, progress, active, theme, voice, lyric }) => {
  const reduced = useReducedMotion();
  // Local interaction state is allowed; it must not drive timing.
  const [tapped, setTapped] = useState(false);

  // Beats (from the scene doc): 0.0 appear, 0.4 punchline lands, 0.8 exit prep.
  const appear = reduced ? 1 : ramp(progress, 0, 0.15);
  const punch = reduced ? (progress >= 0.4 ? 1 : 0) : ramp(progress, 0.4, 0.5);
  const leave = reduced ? 0 : ramp(progress, 0.85, 1);

  return (
    <div
      className="scene-safe flex flex-col justify-end gap-[2cqh]"
      data-scene={lineId}
      onPointerDown={() => active && setTapped(true)}
    >
      <div
        className="text-[4cqw] uppercase tracking-[0.2em] opacity-70"
        style={{ opacity: appear * (1 - leave) }}
      >
        {voice}
      </div>
      <div
        className="text-[14cqw] font-black leading-[0.9] tracking-[-0.04em]"
        style={{
          color: tapped ? theme.fg : theme.accent,
          transform: `translateY(${(1 - appear) * 10}cqh) scale(${1 + punch * 0.08})`,
          opacity: 1 - leave,
        }}
      >
        {/* Own microcopy, not the lyric. `lyric` is for optional small text only. */}
        {lineId}
      </div>
      {lyric !== undefined && (
        <div className="text-[3.2cqw] opacity-50" style={{ opacity: 0.5 * appear }}>
          {lyric}
        </div>
      )}
    </div>
  );
};

export default TemplateScene;
