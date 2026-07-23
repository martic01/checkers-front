import { useEffect, useState } from "react";
import "./OnlineLobby.css";
import { api } from "../api/client.js";
import { toastSuccess } from "../store/uiStore.js";
import { BET_TIERS, isTierUnlocked, formatCoins } from "../game/rank.js";
import { DEFAULT_AVATARS } from "../game/avatars.js";
import { getTrophyLabel } from "../game/trophyCatalog.js";
import { RankBadge, MilestoneBadge } from "./RankBadge.jsx";
import Avatar from "./Avatar.jsx";
import BetTierGrid from "./BetTierGrid.jsx";
import Carousel from "./Carousel.jsx";
import { useIsOnline } from "../utils/network.js";

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
  const [scanIndex, setScanIndex] = useState(0);

  useEffect(() => {
    if (state.phase !== "searching") return;
    const id = setInterval(() => setScanIndex((i) => (i + 1) % DEFAULT_AVATARS.length), 350);
    return () => clearInterval(id);
  }, [state.phase]);

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

  const isOnline = useIsOnline();
  const busy = state.phase !== "idle" || !isOnline;

  if (state.phase === "searching") {
    return (
      <div className="lobby-screen">
        <div className="panel lobby-panel searching-panel">
          <h2 className="lobby-title">Finding an opponent…</h2>
          <p className="screen-subtitle">Betting {formatCoins(state.betAmount)} 🪙</p>

          {!isOnline && (
            <p className="lobby-offline-banner">📶 No internet connection — reconnecting…</p>
          )}

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
              <div className="scanning-avatar-frame">
                <Avatar avatar={{ type: "default", value: DEFAULT_AVATARS[scanIndex].id }} size={64} />
              </div>
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

  if (state.phase === "matched") {
    const tag = getTrophyLabel(state.opponent?.equippedTitle);
    return (
      <div className="lobby-screen">
        <div className="panel lobby-panel matched-panel">
          <h2 className="lobby-title">Opponent Found!</h2>
          <p className="screen-subtitle">Betting {formatCoins(state.betAmount)} 🪙</p>

          <div className="matched-reveal">
            <div className="scanning-avatar-frame scanning-avatar-frame--revealed">
              {tag && <span className="matched-trophy-tag">{tag}</span>}
              <Avatar avatar={state.opponent?.avatar} size={96} />
            </div>
            <div className="matched-name">{state.opponent?.name || "Opponent"}</div>
            {typeof state.opponent?.rank === "number" && (
              <>
                <RankBadge rank={state.opponent.rank} size="sm" />
                <MilestoneBadge rank={state.opponent.rank} />
              </>
            )}
          </div>

          <p className="lobby-waiting-text">Game starting…</p>
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
          {!isOnline && (
            <p className="lobby-offline-banner">📶 No internet connection — reconnecting…</p>
          )}
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

  const slides = [
    {
      key: "quick-match",
      label: "Quick Match",
      content: (
        <>
          <div className="bet-picker">
            <div className="bet-picker__label">Bet Amount</div>
            <BetTierGrid
              tiers={BET_TIERS}
              selected={selectedBet}
              onSelect={setSelectedBet}
              isLocked={(tier) => !isTierUnlocked(tier, player.totalEarnings || 0) || (player.coins || 0) < tier}
            />
            <div className="bet-picker__balance">Your balance: {formatCoins(player.coins || 0)} 🪙</div>
          </div>

          <button className="lobby-quick" onClick={() => onQuickMatch(selectedBet)} disabled={busy}>
            {!isOnline ? "📶 Offline" : `Quick Match — Bet ${formatCoins(selectedBet)} 🪙`}
          </button>
        </>
      ),
    },
    {
      key: "create-room",
      label: "Create Room",
      content: (
        <div className="lobby-section">
          <h3>Create Room</h3>
          <p className="lobby-waiting-text">Generate a code and share it with a friend to play privately.</p>
          <button className="lobby-btn" onClick={() => onCreateRoom(selectedBet)} disabled={busy}>
            {!isOnline ? "📶 Offline" : "🔑 Generate Room Code"}
          </button>
        </div>
      ),
    },
    {
      key: "join-room",
      label: "Join Room",
      content: (
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
              {!isOnline ? "📶" : "➜ Join"}
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="lobby-screen">
      <div className="panel lobby-panel">
        <button className="lobby-back" onClick={onBack}>
          ← Back
        </button>
        <h2 className="lobby-title">🌐 Online Match</h2>

        {!isOnline && (
          <p className="lobby-offline-banner">
            📶 No internet connection — you need to be online to search for or join a match.
          </p>
        )}

        <Carousel slides={slides} />

        <div className="lobby-status">
          <span>Players Online: {lobby.playersOnline}</span>
          <span>Active Matches: {lobby.activeMatches}</span>
        </div>
      </div>
    </div>
  );
}
