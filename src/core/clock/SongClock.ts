/**
 * SongClock: the single source of time for every scene (ARCHITECTURE.md).
 *
 * Adapters (ManualClock, LocalAudioClock, SpotifyEmbedClock) report *raw*
 * media position. The per-song `offsetMs` is applied centrally in the store's
 * tick, never inside an adapter, so switching clocks keeps the tuning.
 *
 * `now()` must be cheap and monotonic while playing: adapters that receive
 * sparse position reports extrapolate between them (see extrapolate.ts, M1.3).
 */

export type ClockStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
export type ClockKind = 'manual' | 'local-audio' | 'spotify-embed' | 'spotify-sdk';

export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

export interface SongClock {
  readonly kind: ClockKind;
  readonly status: ClockStatus;
  /** Media length in ms. May be an estimate until the adapter has loaded. */
  readonly durationMs: number;
  /** Raw media position in ms, extrapolated while playing. Offset NOT applied. */
  now(): number;
  /** Must be called from a user gesture for adapters that play audio. */
  play(): void;
  pause(): void;
  seek(ms: number): void;
  /** Fires after any position jump, with the new raw position. */
  onSeek(listener: Listener<number>): Unsubscribe;
  /** Fires on every status change. */
  onPlayPause(listener: Listener<ClockStatus>): Unsubscribe;
  /** Release listeners and media. The clock is unusable afterwards. */
  destroy(): void;
}

/** Minimal typed pub/sub for adapters. */
export interface Signal<T> {
  emit(value: T): void;
  subscribe(listener: Listener<T>): Unsubscribe;
  clear(): void;
}

export function createSignal<T>(): Signal<T> {
  const listeners = new Set<Listener<T>>();
  return {
    emit(value) {
      // Copy so a listener unsubscribing mid-emit is safe.
      for (const l of [...listeners]) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      listeners.clear();
    },
  };
}

export const clampMs = (ms: number, durationMs: number): number =>
  ms < 0 ? 0 : ms > durationMs ? durationMs : ms;
