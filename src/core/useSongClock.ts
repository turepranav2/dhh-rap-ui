/**
 * Drives the store from the active clock. This is the ONLY place in the app
 * that may run requestAnimationFrame (CLAUDE.md: animations are driven by the
 * song clock, never by free-running timers).
 *
 * The rAF loop runs only while the clock is playing; while paused the store
 * is refreshed from seek / status events instead.
 */
import { useEffect } from 'react';
import { useSongStore } from './store';

export function useSongClock(): void {
  const clock = useSongStore((s) => s.clock);
  const tick = useSongStore((s) => s.tick);

  useEffect(() => {
    if (!clock) return;
    let raf = 0;

    const loop = () => {
      tick();
      // A tick can flip the clock to 'ended' (ManualClock) -> stop looping.
      raf = clock.status === 'playing' ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
    };
    const sync = () => {
      tick();
      if (clock.status === 'playing') start();
      else stop();
    };

    sync();
    const offSeek = clock.onSeek(sync);
    const offStatus = clock.onPlayPause(sync);
    return () => {
      stop();
      offSeek();
      offStatus();
    };
  }, [clock, tick]);
}
