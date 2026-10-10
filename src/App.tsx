/**
 * M0 placeholder. Renders the 9:16 Stage frame so layout/safe-area rules can be
 * checked on a phone before any scene exists. Replaced by Stage in M3.
 */
export default function App() {
  return (
    <main className="app-shell">
      <div className="stage" aria-label="Stage placeholder">
        <div className="stage-safe">
          <p className="placeholder-title">101</p>
          <p className="placeholder-sub">Karma · Naam Sujal</p>
          <p className="placeholder-note">stage placeholder · M0</p>
        </div>
      </div>
    </main>
  );
}
