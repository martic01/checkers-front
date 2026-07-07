import "./Rules.css";

export default function About({ onBack }) {
  return (
    <div className="rules-screen">
      <div className="rules-panel">
        <h2 className="rules-title">About</h2>
        <section className="rules-section">
          <h3>Wooden Draughts</h3>
          <p>
            A premium checkers experience with a handcrafted wooden board, four board themes, local and
            online multiplayer, and an AI opponent with five difficulty levels.
          </p>
        </section>
        <section className="rules-section">
          <h3>Version</h3>
          <p>1.0.0</p>
        </section>
        <button className="rules-back" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
