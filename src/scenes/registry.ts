/**
 * Scene registry: `<songId>/<sceneId>` -> lazily loaded scene component.
 * Discovers src/scenes/<songId>/<Id>.tsx (an uppercase letter followed by
 * digits: L01, F03). `_template/Scene.tsx` is excluded by the pattern. Each
 * scene becomes its own chunk (ARCHITECTURE "Performance budget").
 */
import { lazy } from 'react';
import type { Scene } from '@/types/song';

type SceneModule = { default: Scene };

const loaders = import.meta.glob<SceneModule>('./*/[A-Z][0-9]*.tsx');

const KEY_RE = /^\.\/([^/]+)\/([A-Z][0-9]+)\.tsx$/;

function keyFor(path: string): string | undefined {
  const m = KEY_RE.exec(path);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

const byKey = new Map<string, () => Promise<SceneModule>>();
for (const [path, loader] of Object.entries(loaders)) {
  const key = keyFor(path);
  if (key) byKey.set(key, loader);
}

const cache = new Map<string, Scene>();

export function hasScene(songId: string, sceneId: string): boolean {
  return byKey.has(`${songId}/${sceneId}`);
}

export function listScenes(songId: string): string[] {
  const prefix = `${songId}/`;
  return [...byKey.keys()]
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
    .sort();
}

export function listSceneSongs(): string[] {
  return [...new Set([...byKey.keys()].map((k) => k.split('/')[0] ?? ''))].filter(Boolean).sort();
}

/** Lazy component for the scene, cached; undefined when no file exists (Stage shows Fallback). */
export function getScene(songId: string, sceneId: string): Scene | undefined {
  const key = `${songId}/${sceneId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const loader = byKey.get(key);
  if (!loader) return undefined;
  const comp = lazy(loader) as unknown as Scene;
  cache.set(key, comp);
  return comp;
}

/** Preload a scene's chunk (Stage pre-roll). Safe to call repeatedly. */
export function preloadScene(songId: string, sceneId: string): void {
  void byKey.get(`${songId}/${sceneId}`)?.();
}
