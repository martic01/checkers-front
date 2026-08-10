import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import Button from "./Button.jsx";
import { BET_TIERS, isTierUnlocked, formatCoinsFull } from "../game/rank.js";
import BetTierGrid from "./BetTierGrid.jsx";
import { aiRandomDecision } from "../game/ai.js";
import { api } from "../api/client.js";
import { toastError, toastSuccess, toastInfo, openProfile } from "../store/uiStore.js";
import "./PostGameScreen.css";

const DRAW_REASON_LABEL = {
  "fifty-move-rule": "Draw — fifty-move rule",
  "insufficient-material": "Draw — insufficient material",
  "threefold-repetition": "Draw — threefold repetition",
  "draw-agreement": "Draw by agreement",
  "network-timeout": "Draw — connection lost",
};

export default function ChessPostGameScreen({
  player,
  opponent, // full profile: { id, name, avatar, bio, stats, ... }
  playerColor,
  vsBot,
  roomCode,
  socket,
  matchResult, // { status, winner, reason, betAmount, scores } — Chess's own gameOver shape
  playerCoins = 0,
  totalEarnings = 0,
  onQuit,
  onRematchStart,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [rematchOffer, setRematchOffer] = useState(null); // { betAmount, from: 'me' | 'them' }
  const rematchOfferRef = useRef(null);
  rematchOfferRef.current = rematchOffer;
  const [rematchBetChoice, setRematchBetChoice] = useState(matchResult.betAmount || 0);
  const [opponentQuit, setOpponentQuit] = useState(false);
  const [friendStatus, setFriendStatus] = useState("idle"); // idle | sent | friends

  const scores = matchResult.scores || {};
  const myScore = scores[player.id] || 0;
  const oppScore = scores[opponent?.id] || 0;
  const forfeit = matchResult.status === "resigned" || matchResult.status === "opponent-left";
  const isDraw = matchResult.status === "draw" || matchResult.status === "stalemate";

  // ---------- Chat (same events as in-match chat) ----------
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const onExpire = ({ id }) => setMessages((prev) => prev.filter((m) => m.id !== id));
    socket.on("chat:message", onMessage);
    socket.on("chat:expire", onExpire);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:expire", onExpire);
    };
  }, [socket]);

  const sendMessage = () => {
    if (!text.trim() || !socket) return;
    socket.emit("chat:message", { code: roomCode, text: text.trim(), from: player.name });
    setText("");
  };

  // ---------- Rematch handshake ----------
  useEffect(() => {
    if (!socket) return;

    const onRematchOffered = ({ betAmount: offered }) => {
      if (rematchOfferRef.current?.from === "me") {
        socket.emit("chess:rematch:accept", { code: roomCode }, () => {});
      }
      setRematchOffer({ betAmount: offered, from: "them" });
    };
    const onRematchStarted = (room) => {
      onRematchStart(room);
    };
    const onRematchDeclined = () => {
      setRematchOffer(null);
      toastInfo("Your opponent declined the rematch.");
    };
    const onRematchCancelled = ({ reason }) => {
      setRematchOffer(null);
      toastError(reason || "Rematch could not start");
    };
    const onRematchQuit = ({ name }) => {
      setOpponentQuit(true);
      setRematchOffer(null);
      toastInfo(`${name || opponent?.name || "Opponent"} quit.`);
    };

    socket.on("chess:rematch:offered", onRematchOffered);
    socket.on("chess:rematch:started", onRematchStarted);
    socket.on("chess:rematch:declined", onRematchDeclined);
    socket.on("chess:rematch:cancelled", onRematchCancelled);
    socket.on("chess:rematch:quit", onRematchQuit);
    return () => {
      socket.off("chess:rematch:offered", onRematchOffered);
      socket.off("chess:rematch:started", onRematchStarted);
      socket.off("chess:rematch:declined", onRematchDeclined);
      socket.off("chess:rematch:cancelled", onRematchCancelled);
      socket.off("chess:rematch:quit", onRematchQuit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomCode]);

  const offerRematch = (amount) => {
    socket.emit("chess:rematch:offer", { code: roomCode, betAmount: amount });
    setRematchOffer({ betAmount: amount, from: "me" });
    if (vsBot) {
      const delay = 1200 + Math.random() * 1800;
      setTimeout(() => {
        if (aiRandomDecision()) {
          socket.emit("chess:rematch:accept", { code: roomCode }, (res) => {
            if (!res?.ok) toastError("Could not start the rematch");
          });
        } else {
          setRematchOffer(null);
          setOpponentQuit(true);
          toastInfo("Opponent doesn't want a rematch.");
        }
      }, delay);
    }
  };
  const acceptRematch = () => {
    socket.emit("chess:rematch:accept", { code: roomCode }, (res) => {
      if (!res?.ok) toastError("Could not start the rematch");
    });
  };
  const declineRematch = () => {
    socket.emit("chess:rematch:decline", { code: roomCode });
    setRematchOffer(null);
  };

  const handleQuit = () => {
    if (socket && !vsBot) socket.emit("chess:rematch:quit", { code: roomCode });
    onQuit();
  };

  const handleAddFriend = async () => {
    try {
      await api.addFriend(player.id, opponent.id);
      setFriendStatus("friends");
      toastSuccess(`${opponent.name} added as a friend!`);
    } catch (err) {
      if (err.message?.includes("Already")) setFriendStatus("friends");
      else toastError(err.message || "Could not add friend");
    }
  };

  const resultTitle =
    matchResult.status === "opponent-left"
      ? "Opponent Left"
      : matchResult.status === "resigned"
      ? "Opponent Resigned"
      : isDraw
      ? "Draw"
      : matchResult.winner === playerColor
      ? "Victory"
      : "Defeat";

  const betDelta =
    matchResult.betAmount > 0
      ? isDraw
        ? `Bet returned: ${formatCoinsFull(matchResult.betAmount)} 🪙`
        : matchResult.winner === playerColor
        ? `+${formatCoinsFull(matchResult.betAmount * 2)} 🪙`
        : `-${formatCoinsFull(matchResult.betAmount)} 🪙`
      : null;

  const maxAffordable = vsBot ? Math.min(playerCoins, opponent?.totalEarnings ?? Infinity) : playerCoins;
  const affordableTiers = BET_TIERS.filter((tier) => isTierUnlocked(tier, totalEarnings) && tier <= maxAffordable);

  return (
    <div className="postgame-screen">
      <div className="panel postgame-panel">
        <h2 className={`postgame-title postgame-title--${isDraw ? "draw" : matchResult.winner === playerColor ? "win" : "loss"}`}>{resultTitle}</h2>
        {betDelta && <p className="postgame-bet">{betDelta}</p>}
        {matchResult.status === "stalemate" && <p className="postgame-draw-reason">Draw by stalemate</p>}
        {matchResult.status === "draw" && <p className="postgame-draw-reason">{DRAW_REASON_LABEL[matchResult.reason] || "Draw"}</p>}
        {(myScore > 0 || oppScore > 0) && (
          <p className="postgame-score">
            Score: {myScore} — {oppScore}
          </p>
        )}

        <div className="postgame-players">
          <PlayerCard name={player.name} avatar={player.avatar} you />
          <span className="postgame-vs">vs</span>
          <PlayerCard
            name={opponent?.name || "Opponent"}
            avatar={opponent?.avatar}
            onClick={opponent?.id ? () => openProfile(vsBot ? opponent : opponent.id) : undefined}
          />
        </div>

        {!forfeit &&
          (opponentQuit ? (
            <p className="postgame-status">{opponent?.name || "Opponent"} quit.</p>
          ) : rematchOffer?.from === "them" ? (
            <div className="postgame-rematch-offer">
              <p>
                {opponent?.name || "Opponent"} wants a rematch{rematchOffer.betAmount > 0 ? ` for ${formatCoinsFull(rematchOffer.betAmount)} 🪙` : ""}
              </p>
              <div className="postgame-actions">
                <Button variant="ghost" onClick={declineRematch}>
                  Decline
                </Button>
                <Button variant="gold" onClick={acceptRematch}>
                  Accept
                </Button>
              </div>
            </div>
          ) : rematchOffer?.from === "me" ? (
            <p className="postgame-status">Waiting for {opponent?.name || "Opponent"} to respond…</p>
          ) : (
            <div className="postgame-bank">
              <div className="postgame-bank__label">🏦 Rematch bet</div>
              <div className="postgame-bank__chips">
                <BetTierGrid tiers={affordableTiers} selected={rematchBetChoice} onSelect={setRematchBetChoice} />
              </div>
              <div className="postgame-actions">
                <Button variant="gold" onClick={() => offerRematch(rematchBetChoice)}>
                  🔁 Rematch
                </Button>
                {!vsBot && friendStatus !== "friends" && (
                  <Button variant="ghost" onClick={handleAddFriend}>
                    ➕ Add Friend
                  </Button>
                )}
              </div>
            </div>
          ))}

        {!vsBot && (
          <div className="postgame-chat">
            <div className="postgame-chat__messages">
              {messages.length === 0 && <p className="postgame-chat__empty">Say something…</p>}
              {messages.map((m) => (
                <div key={m.id} className={`postgame-chat__msg ${m.from === player.name ? "postgame-chat__msg--me" : ""}`}>
                  <span className="postgame-chat__from">{m.from}</span>
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="postgame-chat__input-row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Message…"
                maxLength={200}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}

        <Button variant="ghost" full onClick={handleQuit}>
          ✕ Quit to Lobby
        </Button>
      </div>
    </div>
  );
}

function PlayerCard({ name, avatar, you, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`postgame-card ${onClick ? "postgame-card--clickable" : ""}`} onClick={onClick}>
      <div className="postgame-card__avatar-col">
        <Avatar avatar={avatar} size={64} />
      </div>
      <span className="postgame-card__name">{you ? "You" : name}</span>
    </Tag>
  );
}
