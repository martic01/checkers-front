import { useEffect, useRef } from "react";
import "./GameHUD.css";
import Avatar from "./Avatar.jsx";
import { openProfile } from "../store/uiStore.js";
import { getTrophyLabel } from "../game/trophyCatalog.js";
import { formatCoins } from "../game/rank.js";
import { useTickingClock, LOW_TIME_MS } from "./GameClock.jsx";
import { formatClock } from "../game/timeControl.js";
import { playSound } from "../utils/sound.js";

function equippedTagLabel(trophyId) {
  if (!trophyId) return null;
  return getTrophyLabel(trophyId);
}

export default function GameHUD({
  playerName,
  playerAvatar,
  opponentName,
  opponentAvatar,
  playerColor,
  playerId,
  opponentId,
  opponentProfile,
  playerEquippedTitle,
  opponentEquippedTitle,
  turn,
  connectionStatus,
  onUndo,
  onRestart,
  onHint,
  onProposeDraw,
  onLeave,
  onToggleChat,
  chatOpen,
  canUndo,
  mode,
  vsBot,
  potAmount,
  chatSlot,
  // { msAtSync, syncedAt, isActive, totalMs } for each side, or null/undefined
  // when this match has no clock (e.g. AI mode).
  playerClock,
  opponentClock,
  soundsOn = true,
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
            equippedTag={equippedTagLabel(playerEquippedTitle)}
            onClick={playerId ? () => openProfile(playerId) : undefined}
            clock={playerClock}
            soundsOn={soundsOn}
          />
          <span className="game-topbar__vs">vs</span>
          <PlayerChip
            name={opponentName}
            avatar={opponentAvatar}
            color={opponentColor}
            active={turn === opponentColor}
            status={mode === "online" ? connectionStatus?.opponent : null}
            badge="Opponent"
            equippedTag={equippedTagLabel(opponentEquippedTitle)}
            onClick={opponentId ? () => openProfile(opponentProfile || opponentId) : undefined}
            clock={opponentClock}
            soundsOn={soundsOn}
          />
        </div>
        {potAmount > 0 && (
          <div className="game-pot-pill">
            🪙<strong>{formatCoins(potAmount)}</strong>
          </div>
        )}

        <div className="game-topbar__controls">
          {onHint && (
            <button className="hud-btn" onClick={onHint} title="Hint">
              💡<span>Hint</span>
            </button>
          )}
          {onToggleChat && (
            <div className="chat-anchor">
              <button className={`hud-btn ${chatOpen ? "hud-btn--active" : ""}`} onClick={onToggleChat} title="Chat">
                💬<span>Chat</span>
              </button>
              {chatSlot}
            </div>
          )}
          {onUndo && (
            <button className="hud-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
              ↺<span>Undo</span>
            </button>
          )}
          {onProposeDraw && (
            <button className="hud-btn" onClick={onProposeDraw} title="Propose a draw">
              🤝<span>Draw</span>
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

      <div className="game-board-area">{children}</div>
    </div>
  );
}

// SVG ring radius/stroke — sized around a 36px avatar (see .player-chip__avatar-col
// in GameHUD.css). The ring drains clockwise from full as time runs out, and
// switches to the low-time color + fires a one-shot warning sound the moment
// it crosses the shared LOW_TIME_MS threshold, matching the digital readout.
const RING_SIZE = 44;
const RING_RADIUS = 19;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ClockRing({ msAtSync, syncedAt, isActive, totalMs, soundsOn }) {
  const displayMs = useTickingClock(msAtSync, syncedAt, isActive);
  const low = displayMs <= LOW_TIME_MS;
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, displayMs / totalMs)) : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);

  // Fires the low-time alert once per crossing into the red zone while
  // it's this side's turn — not on every animation frame, and not at all
  // for the side that isn't currently ticking.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!isActive) {
      warnedRef.current = false;
      return;
    }
    if (displayMs <= LOW_TIME_MS && displayMs > 0 && !warnedRef.current) {
      playSound("lowTime", soundsOn);
      warnedRef.current = true;
    } else if (displayMs > LOW_TIME_MS) {
      warnedRef.current = false;
    }
  }, [displayMs, isActive, soundsOn]);

  return (
    <svg className={`player-chip__ring ${low ? "player-chip__ring--low" : ""} ${isActive ? "player-chip__ring--active" : ""}`} width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <circle className="player-chip__ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} />
      <circle
        className="player-chip__ring-progress"
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function ClockText({ msAtSync, syncedAt, isActive }) {
  const displayMs = useTickingClock(msAtSync, syncedAt, isActive);
  const low = displayMs <= LOW_TIME_MS;
  return <span className={`player-chip__clock-text ${low ? "player-chip__clock-text--low" : ""}`}>{formatClock(displayMs)}</span>;
}

function PlayerChip({ name, avatar, color, active, status, badge, equippedTag, onClick, clock, soundsOn }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`player-chip ${active ? "player-chip--active" : ""} ${onClick ? "player-chip--clickable" : ""}`} onClick={onClick}>
      <div className="player-chip__avatar-col">
        {equippedTag && <span className="player-chip__tag">{equippedTag}</span>}
        <div className="player-chip__avatar-wrap">
          {clock && (
            <ClockRing msAtSync={clock.msAtSync} syncedAt={clock.syncedAt} isActive={clock.isActive} totalMs={clock.totalMs} soundsOn={soundsOn} />
          )}
          {avatar ? <Avatar avatar={avatar} size={36} /> : <div className={`avatar avatar--${color}`} />}
        </div>
      </div>
      <div className="player-chip__info">
        <span className="player-chip__badge">{badge}</span>
        <span className="player-chip__name">{name}</span>
      </div>
      {clock && <ClockText msAtSync={clock.msAtSync} syncedAt={clock.syncedAt} isActive={clock.isActive} />}
      {status && <ConnDot status={status} />}
    </Tag>
  );
}

function ConnDot({ status = "connected" }) {
  return <span className={`conn-dot conn-dot--${status}`} title={status} />;
}
