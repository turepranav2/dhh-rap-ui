/**
 * Types for data/songs/<id>/song.json and the Scene contract.
 * Source of truth: docs/DATA_SCHEMA.md. Keep the two in sync.
 */
import type { ComponentType } from 'react';

/** Line identifier, e.g. "L07". Also the scene file name and registry key. */
export type LineId = string;

export interface Theme {
  bg: string;
  fg: string;
  accent: string;
  font: string;
}

export interface Section {
  id: string;
  label: string;
  startMs: number;
}

export interface Line {
  id: LineId;
  startMs: number;
  /** Exclusive. Usually the next line's startMs. */
  endMs: number;
  /** Section.id */
  section: string;
  /** Artist name; accent colour switches on it. */
  voice: string;
  /** One-line paraphrase of the bar's meaning. NEVER a quote. */
  intent: string;
  /** Scene component id; defaults to the line id. */
  scene: string;
  tags?: string[];
}

export interface Song {
  id: string;
  title: string;
  /** Display credits, as on the release (e.g. "KR$NA"). */
  artists: string[];
  /** Vocalist labels used in `Line.voice` (e.g. "Krsna"); drives the accent switch. */
  voices: string[];
  album: string;
  trackNumber: number;
  durationMs: number;
  spotifyTrackId: string;
  /** ISO date yyyy-mm-dd. */
  releaseDate?: string;
  /** Adapter latency compensation, tuned in the Sync Tool. */
  offsetMs: number;
  theme: Theme;
  sections: Section[];
  /** Sorted by startMs, non-overlapping. */
  lines: Line[];
}

/** Shape of the gitignored lyrics.local.json: lineId -> text. */
export type LocalLyrics = Record<LineId, string>;

/** Scene contract (docs/DATA_SCHEMA.md). */
export interface SceneProps {
  /** 0..1 across the line's duration. The only timing input a scene gets. */
  progress: number;
  lineDurationMs: number;
  /** false during pre-roll / exit. Interactions valid only while true. */
  active: boolean;
  theme: Theme;
  /** Present only when lyrics.local.json exists. Scenes must work without it. */
  lyric?: string;
  voice: string;
}

export type Scene = ComponentType<SceneProps>;
