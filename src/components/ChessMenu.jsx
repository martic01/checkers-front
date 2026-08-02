import "./ChessMenu.css";

const DIFFICULTIES = ["beginner", "easy", "intermediate", "advanced", "expert"];

export default function ChessMenu({ onSelectLocal, onSelectAi, onSelectOnline, onBack }) {
  return (
    <div className="chess-menu">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h1 className="chess-menu__title">Chess</h1>
      <p className="chess-menu__note">
        New — local, vs-AI, and online play are ready now. Ratings and premium boards are on the way.
      </p>

      <button type="button" className="chess-menu__option" onClick={onSelectOnline}>
        <span className="chess-menu__option-title">Online</span>
        <span className="chess-menu__option-desc">Quick match or play a friend by code</span>
      </button>

      <button type="button" className="chess-menu__option" onClick={onSelectLocal}>
        <span className="chess-menu__option-title">Local Multiplayer</span>
        <span className="chess-menu__option-desc">Two players, one screen</span>
      </button>

      <div className="chess-menu__ai-block">
        <span className="chess-menu__ai-label">vs AI</span>
        <div className="chess-menu__ai-grid">
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" className="chess-menu__ai-btn" onClick={() => onSelectAi(d)}>
              {d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
