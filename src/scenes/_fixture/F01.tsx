/**
 * Fixture scene F01 (family: messaging/call). Incoming-call screen: avatar
 * pulses on the beat, the slide-to-answer knob travels with progress, a tap
 * "answers" (interaction, optional). Placeholder for M3.3; not a real line.
 */
import { useState } from 'react';
import type { Scene } from '@/types/song';
import { useReducedMotion } from '@/scenes/useSceneMotion';

const ramp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));

const F01: Scene = ({ progress, active, theme, voice }) => {
  const reduced = useReducedMotion();
  const [answered, setAnswered] = useState(false);
  const appear = reduced ? 1 : ramp(progress, 0, 0.12);
  const pulse = reduced ? 1 : 1 + 0.06 * Math.abs(Math.sin(progress * Math.PI * 8));
  const knob = answered ? 1 : ramp(progress, 0.15, 0.9);
  return (
    <div className="scene-safe flex flex-col items-center justify-between py-[6cqh]" data-scene="F01" style={{ opacity: appear }}>
      <div className="text-center">
        <div className="text-[3.5cqw] uppercase tracking-[0.25em] opacity-60">{answered ? 'connected' : 'incoming call'}</div>
        <div className="mt-[1cqh] text-[9cqw] font-black tracking-[-0.03em]">{voice}</div>
      </div>
      <div
        className="grid h-[40cqw] w-[40cqw] place-items-center rounded-full text-[14cqw] font-black text-black"
        style={{ background: theme.accent, transform: `scale(${pulse})` }}
      >
        {voice.slice(0, 1)}
      </div>
      <button
        type="button"
        className="relative h-[14cqw] w-full rounded-full bg-white/10 text-[3.5cqw] uppercase tracking-[0.2em]"
        onPointerDown={() => active && setAnswered(true)}
        aria-label="slide to answer"
      >
        <span className="absolute inset-0 grid place-items-center opacity-60">{answered ? 'answered' : 'slide to answer'}</span>
        <span
          className="absolute top-[1cqw] left-[1cqw] h-[12cqw] w-[12cqw] rounded-full"
          style={{ background: answered ? theme.fg : theme.accent, transform: `translateX(${knob * (100 - 14)}cqw)` }}
        />
      </button>
    </div>
  );
};

export default F01;
