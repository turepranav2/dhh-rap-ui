/**
 * Stage: the 9:16 canvas. Reads the store, mounts the active line's scene,
 * pre-rolls the next scene hidden PREROLL_MS early, and runs enter/exit
 * transitions. Scenes are pure functions of `progress`; the Stage owns
 * in/out (DATA_SCHEMA "Scene contract").
 *
 * `children` is the chrome slot (transport, embed): rendered above the scene
 * layer at the bottom and never covered by scenes.
 */
import { Suspense, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Line, Scene, SceneProps, Theme } from '@/types/song';
import { useSongStore } from '@/core/store';
import { PREROLL_MS, variantsFor, type StageVariant } from './transitions';
import { useReducedMotion } from '@/scenes/useSceneMotion';
import FallbackScene from '@/scenes/Fallback';

export interface StageProps {
  /** Scene lookup (M3.2 registry). Return undefined for "no scene file". */
  resolveScene: (sceneId: string) => Scene | undefined;
  children?: ReactNode;
}

interface Mounted {
  key: string;
  sceneId: string;
  line: Line | undefined;
  index: number;
  state: StageVariant;
  progress: number;
}

function themeFor(theme: Theme, voice: string): Theme {
  const accent = theme.voiceAccents?.[voice];
  return accent ? { ...theme, accent } : theme;
}

export default function Stage({ resolveScene, children }: StageProps) {
  const song = useSongStore((s) => s.song);
  const lyrics = useSongStore((s) => s.lyrics);
  const timeline = useSongStore((s) => s.timeline);
  const positionMs = useSongStore((s) => s.positionMs);
  const activeIndex = useSongStore((s) => s.activeIndex);
  const nextIndex = useSongStore((s) => s.nextIndex);
  const progress = useSongStore((s) => s.progress);
  const reduced = useReducedMotion();

  const mounted = useMemo<Mounted[]>(() => {
    if (!timeline) return [];
    const out: Mounted[] = [];
    const active = timeline.lines[activeIndex];
    if (active) {
      out.push({
        key: active.id,
        sceneId: song?.lines[activeIndex]?.scene ?? active.id,
        line: song?.lines[activeIndex],
        index: activeIndex,
        state: 'enter',
        progress: progress ?? 0,
      });
    }
    const next = timeline.lines[nextIndex];
    if (next && nextIndex !== activeIndex && next.startMs - positionMs <= PREROLL_MS) {
      out.push({
        key: next.id,
        sceneId: song?.lines[nextIndex]?.scene ?? next.id,
        line: song?.lines[nextIndex],
        index: nextIndex,
        state: 'preroll',
        progress: 0,
      });
    }
    return out;
  }, [timeline, song, activeIndex, nextIndex, positionMs, progress]);

  return (
    <div className="stage" data-testid="stage">
      <div className="stage-scenes">
        <AnimatePresence initial={false}>
          {mounted.map((m) => {
            const tl = timeline?.lines[m.index];
            const voice = m.line?.voice ?? song?.voices[0] ?? '';
            const theme = themeFor(song?.theme ?? DEFAULT_THEME, voice);
            const Comp = resolveScene(m.sceneId) ?? FallbackScene;
            const lyric = lyrics?.[m.key];
            const props: SceneProps = {
              lineId: m.key,
              progress: m.progress,
              lineDurationMs: tl ? tl.endMs - tl.startMs : 0,
              active: m.state === 'enter',
              theme,
              voice,
              ...(lyric !== undefined ? { lyric } : {}),
            };
            return (
              <motion.div
                key={m.key}
                className="scene-host"
                data-scene-id={m.sceneId}
                data-line-id={m.key}
                data-state={m.state}
                aria-hidden={m.state !== 'enter'}
                variants={variantsFor(m.line?.transition, reduced)}
                initial="preroll"
                animate={m.state}
                exit="exit"
                style={{ pointerEvents: m.state === 'enter' ? 'auto' : 'none' }}
              >
                <Suspense fallback={<FallbackScene {...props} />}>
                  <Comp {...props} />
                </Suspense>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {children !== undefined && <div className="stage-chrome">{children}</div>}
    </div>
  );
}

const DEFAULT_THEME: Theme = { bg: '#0b0b0f', fg: '#f5f5f5', accent: '#ff3b30', font: 'system-ui' };
