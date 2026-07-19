import { useEffect, useState } from "react";
import "./OnlineLobby.css";
import { api } from "../api/client.js";
import { toastSuccess } from "../store/uiStore.js";
import { BET_TIERS, isTierUnlocked, getUnlockThreshold, formatCoins } from "../game/rank.js";
import Avatar from "./Avatar.jsx";

export default function OnlineLobby({
  player,
  state, // { phase: 'idle'|'searching'|'waiting-code'|'matched', betAmount, roomCode, opponent }
  onQuickMatch,
  onCancelSearch,
  onCreateRoom,
  onJoinRoom,
  onBack,
}) {
  const [joinCode, setJoinCode] = useState("");
  const [selectedBet, setSelectedBet] = useState(100);
  const [lobby, setLobby] = useState({ playersOnline: 0, activeMatches: 0 });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.lobby();
        if (!cancelled) setLobby(data);
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
      <div className="lobby-screen">
        <div className="panel lobby-panel searching-panel">
          <h2 className="lobby-title">Finding an opponent…</h2>
          <p className="screen-subtitle">Betting {formatCoins(state.betAmount)} 🪙</p>

          <div className="searching-row">
            <div className="searching-avatar">
              <Avatar avatar={player.avatar} size={64} />
              <span>{player.name}</span>
            </div>
            <div className="searching-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="searching-avatar searching-avatar--mystery">
              <div className="mystery-avatar">?</div>
              <span>Searching…</span>
            </div>
          </div>

          <button className="btn btn--ghost" onClick={() => onCancelSearch(state.betAmount)}>
            ✕ Cancel Search
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "waiting-code") {
    return (
      <div className="lobby-screen">
        <div className="panel lobby-panel">
          <h2 className="lobby-title">Room Created</h2>
          <p className="screen-subtitle">Share this code with a friend</p>
          <div className="room-code-row">
            <div className="room-code-display">{state.roomCode}</div>
            <button
              className="icon-btn"
              aria-label="Copy room code"
              onClick={() => {
                navigator.clipboard?.writeText(state.roomCode);
                toastSuccess("Room code copied!");
              }}
            >
              📋
            </button>
          </div>
          <p className="lobby-waiting-text">Waiting for opponent to join…</p>
          <button className="btn btn--ghost" onClick={() => onCancelSearch(state.betAmount)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <div className="panel lobby-panel">
        <button className="lobby-back" onClick={onBack}>
          ← Back
        </button>
        <h2 className="lobby-title">🌐 Online Match</h2>

        <div className="bet-picker">
          <div className="bet-picker__label">Bet Amount</div>
          <div className="bet-grid">
            {BET_TIERS.map((tier, i) => {
              const unlocked = isTierUnlocked(tier, player.totalEarnings || 0);
              const canAfford = (player.coins || 0) >= tier;
              return (
                <button
                  key={tier}
                  className={`bet-chip ${selectedBet === tier ? "bet-chip--selected" : ""} ${!unlocked ? "bet-chip--locked" : ""}`}
                  disabled={!unlocked || !canAfford}
                  onClick={() => setSelectedBet(tier)}
                  title={!unlocked ? `Unlocks at ${formatCoins(getUnlockThreshold(i))} lifetime earnings` : !canAfford ? "Not enough coins" : ""}
                >
                  {!unlocked && <span className="bet-chip__lock">🔒</span>}
                  {formatCoins(tier)}
                </button>
              );
            })}
          </div>
          <div className="bet-picker__balance">Your balance: {formatCoins(player.coins || 0)} 🪙</div>
        </div>

        <button className="lobby-quick" onClick={() => onQuickMatch(selectedBet)} disabled={busy}>
          Quick Match — Bet {formatCoins(selectedBet)} 🪙
        </button>

        <div className="lobby-divider">OR</div>

        <div className="lobby-section">
          <h3>Create Room</h3>
          <button className="lobby-btn" onClick={() => onCreateRoom(selectedBet)} disabled={busy}>
            🔑 Generate Room Code
          </button>
        </div>

        <div className="lobby-section">
          <h3>Join Room</h3>
          <div className="lobby-join-row">
            <input
              className="lobby-input"
              placeholder="ENTER CODE"
              maxLength={5}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button className="lobby-btn lobby-btn--gold" onClick={() => onJoinRoom(joinCode)} disabled={!joinCode || busy}>
              ➜ Join
            </button>
          </div>
        </div>

        <div className="lobby-status">
          <span>Players Online: {lobby.playersOnline}</span>
          <span>Active Matches: {lobby.activeMatches}</span>
        </div>
      </div>
    </div>
  );
}
