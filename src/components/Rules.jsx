import "./Rules.css";

const SECTIONS = [
  {
    title: "International Checkers",
    body:
      "Played on a 10×10 board with 20 pieces per side. Men move one square diagonally forward, but capture diagonally forward or backward. Capturing the maximum number of pieces is mandatory. Kings move any number of squares diagonally.",
  },
  {
    title: "American (English) Checkers",
    body:
      "Played on an 8×8 board with 12 pieces per side. Men move and capture diagonally forward only. When several capture sequences exist, a player may choose any one but must finish every capture within it. Kings move one square diagonally.",
  },
  {
    title: "Pool Checkers",
    body:
      "Played on an 8×8 board with 12 pieces per side. Men move diagonally forward but capture forward or backward. Capturing is mandatory whenever possible, though the sequence with the most captures isn't required. Kings move any number of squares diagonally.",
  },
  {
    title: "Nigerian Checkers",
    body:
      "Played on a 10×10 board with 20 pieces per side, rotated 90° from the standard orientation. Men move diagonally forward only, but capture forward or backward. Capturing is mandatory whenever possible, without a maximum-capture requirement. Kings move any number of squares diagonally.",
  },
];

export default function Rules({ onBack }) {
  return (
    <div className="rules-screen">
      <div className="rules-panel">
        <button className="rules-back" onClick={onBack}>
          Back
        </button>
        <h2 className="rules-title">Rules</h2>
        {SECTIONS.map((s) => (
          <section key={s.title} className="rules-section">
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
