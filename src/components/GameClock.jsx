import { useEffect, useRef, useState } from "react";
import { formatClock } from "../game/timeControl.js";
import "./GameClock.css";

export const LOW_TIME_MS = 20000;

// Ticks a countdown purely for smooth on-screen display — the actual
// remaining time always comes from the authoritative source (the server
// for online play, or the caller's own state for local hot-seat), passed
// in as `syncedAt`/`msAtSync`. This never invents time on its own; it just
// interpolates between sync points so the display doesn't visibly stutter.
export function useTickingClock(msAtSync, syncedAt, isActive) {
  const [displayMs, setDisplayMs] = useState(msAtSync);
  const frame = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setDisplayMs(msAtSync);
      return undefined;
    }
    const tick = () => {
      const elapsed = Date.now() - syncedAt;
      setDisplayMs(Math.max(0, msAtSync - elapsed));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [msAtSync, syncedAt, isActive]);

  return displayMs;
}

// mySide/opponentSide: { msAtSync, syncedAt, isActive } — msAtSync is the
// remaining time as of syncedAt (a Date.now() timestamp); isActive means
// this side's clock is currently ticking (their turn).
export default function GameClock({ mySide, opponentSide, myLabel = "You", opponentLabel = "Opponent" }) {
  const myMs = useTickingClock(mySide.msAtSync, mySide.syncedAt, mySide.isActive);
  const oppMs = useTickingClock(opponentSide.msAtSync, opponentSide.syncedAt, opponentSide.isActive);

  return (
    <div className="game-clock-bar">
      <div className={`game-clock ${opponentSide.isActive ? "game-clock--active" : ""} ${oppMs <= LOW_TIME_MS ? "game-clock--low" : ""}`}>
        <span className="game-clock__label">{opponentLabel}</span>
        <span className="game-clock__time">{formatClock(oppMs)}</span>
      </div>
      <div className={`game-clock ${mySide.isActive ? "game-clock--active" : ""} ${myMs <= LOW_TIME_MS ? "game-clock--low" : ""}`}>
        <span className="game-clock__label">{myLabel}</span>
        <span className="game-clock__time">{formatClock(myMs)}</span>
      </div>
    </div>
  );
}
