/**
 * Reduced-motion for scenes. Reads the OS preference via Framer Motion, with a
 * context override so the Stage/harness can force it (QA, reduced-motion toggle).
 */
import { createContext, useContext } from 'react';
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/** null = follow the OS setting. */
export const ReducedMotionOverride = createContext<boolean | null>(null);

export function useReducedMotion(): boolean {
  const override = useContext(ReducedMotionOverride);
  const os = useFramerReducedMotion();
  return override ?? os ?? false;
}
