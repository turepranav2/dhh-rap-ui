/**
 * Fixture scene F02 (family: payments). UPI-style receipt: the amount counts
 * up with progress, the success tick lands at 0.7 (the "punchline" beat).
 * Placeholder for M3.3; not a real line.
 */
import type { Scene } from '@/types/song';
import { useReducedMotion } from '@/scenes/useSceneMotion';

const ramp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));
const TARGET = 101_000;

const F02: Scene = ({ progress, theme, voice }) => {
  const reduced = useReducedMotion();
  const count = reduced ? ramp(progress, 0, 0.7) : ramp(progress, 0.05, 0.65);
  const amount = Math.round(TARGET * (1 - Math.pow(1 - count, 3)));
  const tick = ramp(progress, 0.7, reduced ? 0.7001 : 0.8);
  return (
    <div className="scene-safe flex flex-col justify-center gap-[2cqh]" data-scene="F02">
      <div className="rounded-[4cqw] bg-white/5 p-[6cqw]">
        <div className="flex items-center justify-between text-[3.5cqw] uppercase tracking-[0.2em] opacity-60">
          <span>paying {voice}</span>
          <span>UPI</span>
        </div>
        <div className="mt-[3cqh] text-[16cqw] font-black tabular-nums leading-none tracking-[-0.05em]" style={{ color: theme.accent }}>
          ₹{amount.toLocaleString('en-IN')}
        </div>
        <div className="mt-[3cqh] flex items-center gap-[3cqw]">
          <div
            className="grid h-[10cqw] w-[10cqw] place-items-center rounded-full text-[6cqw] font-black text-black"
            style={{ background: theme.accent, transform: `scale(${tick})`, opacity: tick }}
          >
            ✓
          </div>
          <div className="text-[4cqw] font-bold" style={{ opacity: tick }}>
            Payment successful
          </div>
        </div>
      </div>
    </div>
  );
};

export default F02;
