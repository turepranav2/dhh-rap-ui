/**
 * M0 shell. Boots the default song via loadSong and renders the 9:16 Stage
 * frame so layout/safe-area rules can be checked on a phone. Replaced by
 * Stage + Transport in M2/M3.
 */
import { useEffect, useState } from 'react';
import { applyTheme, loadSong, type LoadedSong } from '@/data/loadSong';

const DEFAULT_SONG_ID = '101';

type BootState = { kind: 'loading' } | { kind: 'ready'; data: LoadedSong } | { kind: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<BootState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadSong(DEFAULT_SONG_ID)
      .then((data) => {
        if (cancelled) return;
        applyTheme(data.song.theme);
        setState({ kind: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <div className="stage" aria-label="Stage placeholder">
        <div className="stage-safe">
          {state.kind === 'loading' && <p className="placeholder-note">loading…</p>}
          {state.kind === 'error' && <p className="placeholder-note">error: {state.message}</p>}
          {state.kind === 'ready' && (
            <>
              <p className="placeholder-title">{state.data.song.title}</p>
              <p className="placeholder-sub">{state.data.song.artists.join(' · ')}</p>
              <p className="placeholder-note">
                {state.data.song.lines.length} lines · lyrics {state.data.lyrics ? 'local' : 'none'} · M0
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
