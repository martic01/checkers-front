import "./Levels.css";

const LEVEL_LABELS = ["Beginner Level", "Easy Level", "Medium Level", "Hard Level", "Expert Level"];

export default function Levels({ unlockedLevels = [1], onSelect, onBack }) {
  return (
    <div className="levels-screen">
      <h2 className="levels-title">Levels</h2>
      <div className="levels-list">
        {LEVEL_LABELS.map((label, idx) => {
          const level = idx + 1;
          const unlocked = unlockedLevels.includes(level);
          return (
            <button
              key={level}
              className={`level-item ${unlocked ? "level-item--unlocked" : "level-item--locked"}`}
              onClick={() => unlocked && onSelect(level)}
              disabled={!unlocked}
            >
              {!unlocked && <span className="level-lock">🔒 Locked</span>}
              <span className="level-number">{level}</span>
              {unlocked && <span className="level-label">{label}</span>}
            </button>
          );
        })}
      </div>
      <button className="levels-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
