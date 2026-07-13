import { useEffect, useState } from "react";
import "./GameLoader.css";

const TIPS = [
  "Kings can move in any direction — don't get cornered!",
  "Mandatory captures are the law of the board.",
  "Tip: setting up a double-capture can swing a game instantly.",
  "Control the center squares early for more options later.",
  "Watch for pieces that can be captured on your next move too.",
];

export default function GameLoader({ label = "Loading" }) {
  const [tip, setTip] = useState(TIPS[0]);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTip(TIPS[Math.floor(Math.random() * TIPS.length)]), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="game-loader">
      <div className="game-loader__board">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={`game-loader__piece game-loader__piece--${i}`} />
        ))}
      </div>
      <div className="game-loader__label">
        {label}
        <span className="game-loader__dots">{dots}</span>
      </div>
      <div className="game-loader__tip">{tip}</div>
    </div>
  );
}
