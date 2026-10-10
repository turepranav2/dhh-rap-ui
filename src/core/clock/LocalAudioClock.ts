/**
 * LocalAudioClock: an owner-supplied audio file (File from a picker, or a URL
 * the owner controls). Position comes from HTMLAudioElement.currentTime,
 * which is frame-accurate in current browsers. Nothing is uploaded, persisted
 * or committed; object URLs are revoked on destroy.
 */
import { clampMs, createSignal, type ClockStatus, type SongClock } from './SongClock';

export interface LocalAudioClockOptions {
  /** Used until the element reports its own duration. */
  durationMs?: number;
}

export class LocalAudioClock implements SongClock {
  readonly kind = 'local-audio' as const;
  readonly audio: HTMLAudioElement;

  private _status: ClockStatus = 'loading';
  private readonly fallbackDurationMs: number;
  private readonly objectUrl: string | null;
  private readonly seekSignal = createSignal<number>();
  private readonly statusSignal = createSignal<ClockStatus>();
  private readonly off: Array<() => void> = [];

  constructor(source: File | string, opts: LocalAudioClockOptions = {}) {
    this.fallbackDurationMs = opts.durationMs ?? 0;
    this.objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.src = this.objectUrl ?? (source as string);

    const on = <K extends keyof HTMLMediaElementEventMap>(ev: K, fn: () => void) => {
      this.audio.addEventListener(ev, fn);
      this.off.push(() => this.audio.removeEventListener(ev, fn));
    };
    on('loadedmetadata', () => {
      if (this._status === 'loading') this.setStatus('paused');
    });
    on('playing', () => this.setStatus('playing'));
    on('play', () => this.setStatus('playing'));
    on('pause', () => {
      if (!this.audio.ended) this.setStatus('paused');
    });
    on('ended', () => this.setStatus('ended'));
    on('seeked', () => {
      if (this._status === 'ended' && !this.audio.ended) this.setStatus('paused');
      this.seekSignal.emit(this.now());
    });
    on('error', () => this.setStatus('error'));
  }

  get status(): ClockStatus {
    return this._status;
  }

  get durationMs(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) && d > 0 ? d * 1000 : this.fallbackDurationMs;
  }

  now(): number {
    return this.audio.currentTime * 1000;
  }

  play(): void {
    if (this._status === 'idle') return;
    this.audio.play().catch(() => this.setStatus('error'));
  }

  pause(): void {
    if (this._status === 'idle') return;
    this.audio.pause();
  }

  seek(ms: number): void {
    if (this._status === 'idle') return;
    this.audio.currentTime = clampMs(ms, this.durationMs || ms) / 1000;
  }

  onSeek(listener: (ms: number) => void) {
    return this.seekSignal.subscribe(listener);
  }

  onPlayPause(listener: (status: ClockStatus) => void) {
    return this.statusSignal.subscribe(listener);
  }

  destroy(): void {
    this.audio.pause();
    for (const f of this.off) f();
    this.off.length = 0;
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.seekSignal.clear();
    this.statusSignal.clear();
    this._status = 'idle';
  }

  private setStatus(next: ClockStatus): void {
    if (this._status === next || this._status === 'idle') return;
    this._status = next;
    this.statusSignal.emit(next);
  }
}
