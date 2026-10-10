/**
 * Generic scene used when a line has no scene file yet (or while its chunk
 * loads): accent progress bar, voice tag and the line id. Pure of `progress`.
 */
import type { Scene } from '@/types/song';
import { useReducedMotion } from './useSceneMotion';

const FallbackScene: Scene = ({ lineId, progress, voice, theme, active }) => {
  const reduced = useReducedMotion();
  const pct = Math.round(progress * 1000) / 10;
  // Subtle breathing on the id while active (reduced motion: static).
  const scale = reduced || !active ? 1 : 1 + 0.03 * Math.sin(progress * Math.PI);
  return (
    <div className="scene-safe flex flex-col justify-end gap-[1.5cqh]" data-scene="fallback">
      <div className="flex items-baseline justify-between text-[3cqw] uppercase tracking-[0.2em] opacity-60">
        <span>{voice}</span>
        <span className="tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-[1.2cqh] w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.accent }} />
      </div>
      <div
        className="text-[22cqw] font-black leading-none tracking-[-0.05em]"
        style={{ color: theme.accent, transform: `scale(${scale})`, transformOrigin: 'left bottom' }}
      >
        {lineId}
      </div>
    </div>
  );
};

export default FallbackScene;
