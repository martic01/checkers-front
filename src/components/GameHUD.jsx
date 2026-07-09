import "./GameHUD.css";
import { openProfile } from "../store/uiStore.js";

export default function GameHUD({
  playerName,
  opponentName,
  playerColor,
  playerId,
  opponentId,
  turn,
  connectionStatus,
  onUndo,
  onRestart,
  onHint,
  onLeave,
  canUndo,
  mode,
  children,
}) {
  const opponentColor = playerColor === "white" ? "black" : "white";

  return (
    <div className="game-layout">
      <PlayerPanel
        name={playerName}
        color={playerColor}
        active={turn === playerColor}
        status={mode === "online" ? connectionStatus?.player : null}
        badge="YOU"
        onClick={playerId ? () => openProfile(playerId) : undefined}
      />

      <div className="board-column">
        <div className={`turn-banner ${turn === playerColor ? "turn-banner--you" : "turn-banner--them"}`}>
          {turn === playerColor ? "Your turn" : `${turn === "white" ? "White" : "Black"} to move`}
        </div>

        {children}

        <div className="hud-actions">
          {onUndo && (
            <button className="hud-btn" onClick={onUndo} disabled={!canUndo}>
              ↺ Undo
            </button>
          )}
          {onHint && (
            <button className="hud-btn" onClick={onHint}>
              💡 Hint
            </button>
          )}
          {onRestart && (
            <button className="hud-btn" onClick={onRestart}>
              ⟳ Restart
            </button>
          )}
          <button className="hud-btn hud-btn--leave" onClick={onLeave}>
            ✕ Leave
          </button>
        </div>
      </div>

      <PlayerPanel
        name={opponentName}
        color={opponentColor}
        active={turn === opponentColor}
        status={mode === "online" ? connectionStatus?.opponent : null}
        badge={mode === "ai" ? "AI" : "OPPONENT"}
        onClick={opponentId ? () => openProfile(opponentId) : undefined}
      />
    </div>
  );
}

function PlayerPanel({ name, color, active, status, badge, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`player-panel ${active ? "player-panel--active" : ""} ${onClick ? "player-panel--clickable" : ""}`} onClick={onClick}>
      <div className={`avatar avatar--${color}`} />
      <div className="player-panel__info">
        <span className="player-panel__badge">{badge}</span>
        <span className="player-panel__name">{name}</span>
        {status && <ConnStatus status={status} />}
      </div>
    </Tag>
  );
}

function ConnStatus({ status = "connected" }) {
  const label = { connected: "Connected", connecting: "Connecting…", reconnecting: "Reconnecting…" }[status];
  return <span className={`conn conn--${status}`}>{label}</span>;
}
