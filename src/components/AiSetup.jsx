import "./Levels.css";
import { DIFFICULTIES } from "../game/ai.js";

const LABELS = {
  beginner: "Beginner",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export default function AiSetup({ onSelect, onBack }) {
  return (
    <div className="levels-screen">
      <button className="levels-back" onClick={onBack}>
        Back
      </button>
      <h2 className="levels-title">Play vs AI</h2>
      <div className="levels-list">
        {DIFFICULTIES.map((d) => (
          <button key={d} className="level-item level-item--unlocked" onClick={() => onSelect(d)}>
            <span className="level-label">{LABELS[d]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
