import "./GameEndBanner.css";

const CONFETTI_COUNT = 16;
const CONFETTI_EMOJI = ["🎉", "✨", "⭐", "🎊"];

// Purely decorative — a burst of confetti pieces arcing outward and falling,
// shown only for wins. Same lightweight span+CSS-custom-property pattern as
// CoinBurst, no external dependency.
function ConfettiBurst() {
  return (
    <div className="game-end-confetti" aria-hidden="true">
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <span
          key={i}
          className="game-end-confetti__piece"
          style={{
            "--i": i,
            "--dx": `${(Math.random() - 0.5) * 90}vw`,
            "--dy": `${40 + Math.random() * 35}vh`,
            "--rot": `${(Math.random() - 0.5) * 720}deg`,
            "--delay": `${Math.random() * 0.25}s`,
          }}
        >
          {CONFETTI_EMOJI[i % CONFETTI_EMOJI.length]}
        </span>
      ))}
    </div>
  );
}

// outcome: "win" | "lose" | "draw" — drives which of three distinct
// animations plays (bouncy pop for a win, a heavier settling drop for a
// loss, a calm side-to-side balance for a draw), not just which color.
// icon: a single emoji representing the specific reason (checkmate,
// resignation, timeout, stalemate, agreement, ...) — optional.
// subtitle: optional small text under the title (e.g. "by checkmate").
export default function GameEndBanner({ outcome, title, icon, subtitle }) {
  return (
    <div className={`game-end-banner game-end-banner--${outcome}`}>
      {outcome === "win" && <ConfettiBurst />}
      <div className="game-end-banner__card">
        {icon && <span className="game-end-banner__icon">{icon}</span>}
        <div className="game-end-banner__text">{title}</div>
        {subtitle && <div className="game-end-banner__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
