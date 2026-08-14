import "./ChessLevels.css";

const LEVELS = [
  { key: "beginner", label: "Beginner", icon: "🌱", theme: "chess-level-bg--beginner" },
  { key: "easy", label: "Easy", icon: "🌊", theme: "chess-level-bg--easy" },
  { key: "intermediate", label: "Intermediate", icon: "🔥", theme: "chess-level-bg--intermediate" },
  { key: "advanced", label: "Advanced", icon: "⚔️", theme: "chess-level-bg--advanced" },
  { key: "expert", label: "Expert", icon: "👑", theme: "chess-level-bg--expert" },
];

export default function ChessLevels({ unlockedLevels = ["beginner"], onSelect, onBack }) {
  return (
    <div className="chess-levels-screen">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h2 className="screen-title">Chess vs AI</h2>
      <p className="screen-subtitle">Choose a difficulty level</p>

      <div className="chess-levels-grid">
        {LEVELS.map((lvl) => {
          const unlocked = unlockedLevels.includes(lvl.key);
          return (
            <button
              key={lvl.key}
              className={`chess-level-card ${lvl.theme} ${unlocked ? "chess-level-card--unlocked" : "chess-level-card--locked"}`}
              onClick={() => unlocked && onSelect(lvl.key)}
              disabled={!unlocked}
            >
              <div className="chess-level-card__overlay" />
              <div className="chess-level-card__content">
                {!unlocked ? <span className="chess-level-card__lock">🔒 Locked</span> : <span className="chess-level-card__icon">{lvl.icon}</span>}
                <span className="chess-level-card__label">{lvl.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
