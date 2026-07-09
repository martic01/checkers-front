import "./GameHUD.css";
import Avatar from "./Avatar.jsx";
import { openProfile } from "../store/uiStore.js";

export default function GameHUD({
  playerName,
  playerAvatar,
  opponentName,
  opponentAvatar,
  playerColor,
  playerId,
  opponentId,
  turn,
  connectionStatus,
  onUndo,
  onRestart,
  onHint,
  onLeave,
  onToggleChat,
  chatOpen,
  canUndo,
  mode,
  potAmount,
  chatSlot,
  children,
}) {
  const opponentColor = playerColor === "white" ? "black" : "white";

  return (
    <div className="game-shell">
      <div className="game-topbar">
        <div className="game-topbar__players">
          <PlayerChip
            name={playerName}
            avatar={playerAvatar}
            color={playerColor}
            active={turn === playerColor}
            status={mode === "online" ? connectionStatus?.player : null}
            badge="You"
            onClick={playerId ? () => openProfile(playerId) : undefined}
          />
          <span className="game-topbar__vs">vs</span>
          <PlayerChip
            name={opponentName}
            avatar={opponentAvatar}
            color={opponentColor}
            active={turn === opponentColor}
            status={mode === "online" ? connectionStatus?.opponent : null}
            badge={mode === "ai" ? "AI" : "Opponent"}
            onClick={opponentId ? () => openProfile(opponentId) : undefined}
          />
        </div>

        <div className="game-topbar__controls">
          {onHint && (
            <button className="hud-btn" onClick={onHint} title="Hint">
              💡<span>Hint</span>
            </button>
          )}
          {onToggleChat && (
            <button className={`hud-btn ${chatOpen ? "hud-btn--active" : ""}`} onClick={onToggleChat} title="Chat">
              💬<span>Chat</span>
            </button>
          )}
          {onUndo && (
            <button className="hud-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
              ↺<span>Undo</span>
            </button>
          )}
          {onRestart && (
            <button className="hud-btn" onClick={onRestart} title="Restart">
              ⟳<span>Restart</span>
            </button>
          )}
          <button className="hud-btn hud-btn--leave" onClick={onLeave} title="Leave">
            ✕<span>Leave</span>
          </button>
        </div>
      </div>

      {potAmount > 0 && (
        <div className="game-pot-pill">
          🪙 Playing for <strong>{potAmount}</strong> coins
        </div>
      )}

      {chatSlot}

      <div className="game-board-area">{children}</div>
    </div>
  );
}

function PlayerChip({ name, avatar, color, active, status, badge, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`player-chip ${active ? "player-chip--active" : ""} ${onClick ? "player-chip--clickable" : ""}`} onClick={onClick}>
      {avatar ? <Avatar avatar={avatar} size={30} /> : <div className={`avatar avatar--${color}`} />}
      <div className="player-chip__info">
        <span className="player-chip__badge">{badge}</span>
        <span className="player-chip__name">{name}</span>
      </div>
      {status && <ConnDot status={status} />}
    </Tag>
  );
}

function ConnDot({ status = "connected" }) {
  return <span className={`conn-dot conn-dot--${status}`} title={status} />;
}
