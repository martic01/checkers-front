import "./Levels.css";

const LEVELS = [
  { label: "Beginner", icon: "🌱", theme: "level-bg--beginner" },
  { label: "Easy", icon: "🌊", theme: "level-bg--easy" },
  { label: "Medium", icon: "🔥", theme: "level-bg--medium" },
  { label: "Hard", icon: "⚔️", theme: "level-bg--hard" },
  { label: "Expert", icon: "👑", theme: "level-bg--expert" },
];

export default function Levels({ unlockedLevels = [1], onSelect, onBack }) {
  return (
    <div className="levels-screen">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h2 className="screen-title">Play vs AI</h2>
      <p className="screen-subtitle">Choose a difficulty level</p>

      <div className="levels-grid">
        {LEVELS.map((lvl, idx) => {
          const level = idx + 1;
          const unlocked = unlockedLevels.includes(level);
          return (
            <button
              key={level}
              className={`level-card ${lvl.theme} ${unlocked ? "level-card--unlocked" : "level-card--locked"}`}
              onClick={() => unlocked && onSelect(level)}
              disabled={!unlocked}
            >
              <div className="level-card__overlay" />
              <div className="level-card__content">
                {!unlocked ? (
                  <span className="level-card__lock">🔒 Locked</span>
                ) : (
                  <span className="level-card__icon">{lvl.icon}</span>
                )}
                <span className="level-card__number">Level {level}</span>
                <span className="level-card__label">{lvl.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
