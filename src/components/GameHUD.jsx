import "./GameHUD.css";

export default function GameHUD({
  playerName,
  opponentName,
  playerColor,
  turn,
  connectionStatus,
  onUndo,
  onRestart,
  onHint,
  onLeave,
  canUndo,
  mode,
}) {
  return (
    <div className="hud">
      <div className="hud-row">
        <div className="hud-side">
          <div className={`avatar avatar--${playerColor}`} />
          <div className="hud-info">
            <span className="hud-name">{playerName}</span>
            {mode === "online" && <ConnStatus status={connectionStatus?.player} />}
          </div>
        </div>

        <div className={`turn-pill ${turn === playerColor ? "turn-pill--active" : ""}`}>
          {turn === playerColor ? "YOUR TURN" : `${turn === "white" ? "WHITE" : "BLACK"} TO MOVE`}
        </div>

        <div className="hud-side hud-side--right">
          <div className="hud-info hud-info--right">
            <span className="hud-name">{opponentName}</span>
            {mode === "online" && <ConnStatus status={connectionStatus?.opponent} />}
          </div>
          <div className={`avatar avatar--${playerColor === "white" ? "black" : "white"}`} />
        </div>
      </div>

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
  );
}

function ConnStatus({ status = "connected" }) {
  const label = { connected: "Connected", connecting: "Connecting…", reconnecting: "Reconnecting…" }[status];
  return <span className={`conn conn--${status}`}>{label}</span>;
}
