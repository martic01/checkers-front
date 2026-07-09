import "./CoinBurst.css";

const COIN_COUNT = 10;

// Purely decorative: a shower of coins arcs up and converges toward the
// top-left, where the player's own chip sits in the HUD ("their pocket").
export default function CoinBurst({ active }) {
  if (!active) return null;

  return (
    <div className="coin-burst" aria-hidden="true">
      {Array.from({ length: COIN_COUNT }).map((_, i) => (
        <span
          key={i}
          className="coin-burst__coin"
          style={{
            "--i": i,
            "--dx": `${-40 - Math.random() * 30}vw`,
            "--dy": `${-40 - Math.random() * 20}vh`,
            "--delay": `${i * 0.06}s`,
            "--drift": `${(Math.random() - 0.5) * 60}px`,
          }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}
