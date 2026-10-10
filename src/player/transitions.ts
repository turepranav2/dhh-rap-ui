/**
 * Line-to-line transition variants (DESIGN_GUIDE "Motion").
 * Durations: micro 120, standard 240, hero 480; default line transition 140 ms.
 * The Stage owns in/out; scenes only render their content.
 */
import type { Variants, Transition } from 'framer-motion';
import type { TransitionKind } from '@/types/song';

export const EASE_IN: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
export const EASE_OUT: [number, number, number, number] = [0.4, 0, 1, 1];
export const PREROLL_MS = 300;

/** Variant names used by the Stage: hidden pre-roll, visible, leaving. */
export type StageVariant = 'preroll' | 'enter' | 'exit';

const t = (ms: number, ease: [number, number, number, number]): Transition => ({ duration: ms / 1000, ease });
const instant: Transition = { duration: 0 };

export const TRANSITIONS: Record<TransitionKind, Variants> = {
  default: {
    preroll: { opacity: 0, scale: 0.96, x: 0 },
    enter: { opacity: 1, scale: 1, x: 0, transition: t(140, EASE_IN) },
    exit: { opacity: 0, scale: 1.04, x: 0, transition: t(140, EASE_OUT) },
  },
  cut: {
    preroll: { opacity: 0, scale: 1, x: 0 },
    enter: { opacity: 1, scale: 1, x: 0, transition: instant },
    exit: { opacity: 0, scale: 1, x: 0, transition: instant },
  },
  whip: {
    preroll: { opacity: 1, scale: 1, x: '100%' },
    enter: { opacity: 1, scale: 1, x: 0, transition: t(240, EASE_IN) },
    exit: { opacity: 1, scale: 1, x: '-100%', transition: t(240, EASE_OUT) },
  },
  match: {
    preroll: { opacity: 0, scale: 1, x: 0 },
    enter: { opacity: 1, scale: 1, x: 0, transition: t(90, EASE_IN) },
    exit: { opacity: 0, scale: 1, x: 0, transition: t(90, EASE_OUT) },
  },
};

export function variantsFor(kind: TransitionKind | undefined, reducedMotion: boolean): Variants {
  if (reducedMotion) return TRANSITIONS.cut;
  return TRANSITIONS[kind ?? 'default'];
}
