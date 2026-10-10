/**
 * Scene template. Copy to src/scenes/<songId>/<lineId>.tsx.
 * Stub for M0.2; fully commented version lands in M3.2.
 *
 * Contract (docs/DATA_SCHEMA.md): pure function of `progress` + local
 * interaction state. No timers. Correct when mounted at any progress.
 * Size with cqw/cqh. Provide a reduced-motion fallback.
 */
import type { Scene } from '@/types/song';

const TemplateScene: Scene = ({ progress }) => {
  return <div data-scene="template" data-progress={progress.toFixed(3)} />;
};

export default TemplateScene;
