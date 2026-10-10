/**
 * Fixture scene F03 (family: maps-travel). A map pin drops in (0-0.2), ripples
 * with progress, the label fades in at 0.4. Placeholder for M3.3; not a real line.
 */
import type { Scene } from '@/types/song';
import { useReducedMotion } from '@/scenes/useSceneMotion';

const ramp = (p: number, a: number, b: number) => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));

const F03: Scene = ({ progress, theme, voice }) => {
  const reduced = useReducedMotion();
  const drop = reduced ? 1 : ramp(progress, 0, 0.2);
  const bounce = reduced ? 0 : Math.sin(Math.min(1, ramp(progress, 0.2, 0.3)) * Math.PI) * 3;
  const label = ramp(progress, 0.4, reduced ? 0.4001 : 0.5);
  const rings = reduced ? [] : [0, 1, 2].map((i) => ((progress * 2 + i / 3) % 1));
  return (
    <div className="scene-safe overflow-hidden" data-scene="F03">
      {/* faux map grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(${theme.fg}22 1px, transparent 1px), linear-gradient(90deg, ${theme.fg}22 1px, transparent 1px)`,
          backgroundSize: '12cqw 12cqw',
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        {rings.map((r, i) => (
          <div
            key={i}
            className="absolute rounded-full border-[0.6cqw]"
            style={{
              borderColor: theme.accent,
              width: `${r * 60}cqw`,
              height: `${r * 60}cqw`,
              transform: 'translate(-50%, -50%)',
              opacity: (1 - r) * 0.6,
            }}
          />
        ))}
        <div
          className="absolute h-[10cqw] w-[10cqw] rounded-full border-[1.5cqw] border-black"
          style={{
            background: theme.accent,
            transform: `translate(-50%, calc(-100% - ${(1 - drop) * 60}cqh + ${bounce}cqh))`,
            opacity: 0.2 + 0.8 * drop,
          }}
        />
      </div>
      <div
        className="absolute bottom-[8cqh] left-0 right-0 rounded-[3cqw] bg-black/50 p-[4cqw] backdrop-blur"
        style={{ opacity: label, transform: `translateY(${(1 - label) * 4}cqh)` }}
      >
        <div className="text-[3.5cqw] uppercase tracking-[0.2em] opacity-60">you are here</div>
        <div className="text-[7cqw] font-black">{voice}&apos;s block</div>
      </div>
    </div>
  );
};

export default F03;
