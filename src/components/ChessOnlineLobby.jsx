import { useEffect, useState } from "react";
import "./ChessOnlineLobby.css";
import { api } from "../api/client.js";
import { formatCoins } from "../game/rank.js";

const BET_OPTIONS = [0, 100, 500, 1000];

export default function ChessOnlineLobby({
  player,
  state, // { phase: 'idle'|'searching'|'waiting-code'|'matched', betAmount, roomCode, opponent }
  onQuickMatch,
  onCancelSearch,
  onCreateRoom,
  onJoinRoom,
  onBack,
}) {
  const [joinCode, setJoinCode] = useState("");
  const [selectedBet, setSelectedBet] = useState(0);
  const [lobby, setLobby] = useState({ activeMatches: 0, searching: 0 });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.lobby();
        if (!cancelled && data?.chess) setLobby(data.chess);
      } catch {
        /* backend offline: keep last known values */
      }
    }
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const busy = state.phase !== "idle";

  if (state.phase === "searching") {
    return (
      <div className="chess-lobby">
        <div className="chess-lobby-panel">
          <h2 className="chess-lobby-title">Finding an opponent…</h2>
          <p className="chess-lobby-sub">{state.betAmount ? `Betting ${formatCoins(state.betAmount)} 🪙` : "Free play"}</p>
          <div className="chess-lobby-spinner" />
          <button type="button" className="chess-control-btn chess-control-btn--ghost" onClick={() => onCancelSearch(state.betAmount)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "waiting-code") {
    return (
      <div className="chess-lobby">
        <div className="chess-lobby-panel">
          <h2 className="chess-lobby-title">Room created</h2>
          <p className="chess-lobby-sub">Share this code with your opponent</p>
          <div className="chess-lobby-code">{state.roomCode}</div>
          <button type="button" className="chess-control-btn chess-control-btn--ghost" onClick={() => onCancelSearch(state.betAmount)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "matched") {
    return (
      <div className="chess-lobby">
        <div className="chess-lobby-panel">
          <h2 className="chess-lobby-title">Opponent found!</h2>
          <p className="chess-lobby-sub">{state.opponent?.name || "Opponent"} — get ready</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chess-lobby">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h1 className="chess-lobby-heading">Chess Online</h1>
      <p className="chess-lobby-stats">
        {lobby.activeMatches} match{lobby.activeMatches === 1 ? "" : "es"} in progress
      </p>

      <div className="chess-lobby-bet-block">
        <span className="chess-lobby-bet-label">Stake</span>
        <div className="chess-lobby-bet-grid">
          {BET_OPTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={`chess-lobby-bet-btn ${selectedBet === amount ? "chess-lobby-bet-btn--active" : ""}`}
              onClick={() => setSelectedBet(amount)}
              disabled={amount > 0 && (player?.coins ?? 0) < amount}
            >
              {amount === 0 ? "Free" : `${formatCoins(amount)} 🪙`}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="chess-lobby-action chess-lobby-action--primary" onClick={() => onQuickMatch(selectedBet)} disabled={busy}>
        Quick Match
      </button>
      <button type="button" className="chess-lobby-action" onClick={() => onCreateRoom(selectedBet)} disabled={busy}>
        Create Room
      </button>

      <div className="chess-lobby-join">
        <input
          type="text"
          className="chess-lobby-join-input"
          placeholder="Room code"
          value={joinCode}
          maxLength={6}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button type="button" className="chess-lobby-action" onClick={() => onJoinRoom(joinCode)} disabled={busy || !joinCode.trim()}>
          Join
        </button>
      </div>
    </div>
  );
}
