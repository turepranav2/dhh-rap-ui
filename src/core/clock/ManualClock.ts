/**
 * ManualClock: dev scrubber and test clock. No media; time advances from the
 * injected `nowFn` (defaults to performance.now) while "playing".
 */
import { clampMs, createSignal, type ClockStatus, type SongClock } from './SongClock';

export interface ManualClockOptions {
  durationMs: number;
  /** Monotonic ms source; inject a fake in tests. */
  nowFn?: () => number;
  /** Initial raw position. */
  startMs?: number;
}

export class ManualClock implements SongClock {
  readonly kind = 'manual' as const;
  readonly durationMs: number;

  private _status: ClockStatus = 'paused';
  /** Raw position at `anchorAt` (or the frozen position while not playing). */
  private pos: number;
  private anchorAt = 0;
  private readonly nowFn: () => number;
  private readonly seekSignal = createSignal<number>();
  private readonly statusSignal = createSignal<ClockStatus>();

  constructor(opts: ManualClockOptions) {
    this.durationMs = opts.durationMs;
    this.nowFn = opts.nowFn ?? (() => performance.now());
    this.pos = clampMs(opts.startMs ?? 0, this.durationMs);
  }

  get status(): ClockStatus {
    return this._status;
  }

  now(): number {
    if (this._status !== 'playing') return this.pos;
    const t = this.pos + (this.nowFn() - this.anchorAt);
    if (t >= this.durationMs) {
      this.pos = this.durationMs;
      this.setStatus('ended');
      return this.pos;
    }
    return t;
  }

  play(): void {
    if (this._status === 'playing' || this._status === 'idle') return;
    if (this._status === 'ended') this.pos = 0;
    this.anchorAt = this.nowFn();
    this.setStatus('playing');
  }

  pause(): void {
    if (this._status !== 'playing') return;
    const t = this.now();
    if (this._status !== 'playing') return; // now() may have flipped us to 'ended'
    this.pos = t;
    this.setStatus('paused');
  }

  seek(ms: number): void {
    if (this._status === 'idle') return;
    this.pos = clampMs(ms, this.durationMs);
    this.anchorAt = this.nowFn();
    if (this._status === 'ended') this.setStatus('paused');
    this.seekSignal.emit(this.pos);
  }

  onSeek(listener: (ms: number) => void) {
    return this.seekSignal.subscribe(listener);
  }

  onPlayPause(listener: (status: ClockStatus) => void) {
    return this.statusSignal.subscribe(listener);
  }

  destroy(): void {
    this.seekSignal.clear();
    this.statusSignal.clear();
    this._status = 'idle';
  }

  private setStatus(next: ClockStatus): void {
    if (this._status === next) return;
    this._status = next;
    this.statusSignal.emit(next);
  }
}
