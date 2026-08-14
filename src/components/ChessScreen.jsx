import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChessBoard from "./ChessBoard.jsx";
import GameHUD from "./GameHUD.jsx";
import ChatPanel from "./ChatPanel.jsx";
import Button from "./Button.jsx";
import GameEndBanner from "./GameEndBanner.jsx";
import "./ChessScreen.css";
import { createInitialBoard, createInitialState, applyMove, getGameStatus, positionKey, WHITE, BLACK, opponent } from "../game/chess/chessLogic.js";
import { difficultyLabel } from "../game/chess/chessAI.js";
import { usePlayerStore } from "../store/playerStore.js";
import { getTimeControlForBet, TIME_CONTROLS } from "../game/timeControl.js";
import { isSoundEnabled, playSound } from "../utils/sound.js";
import { confirmDialog, toastInfo } from "../store/uiStore.js";
import { formatCoinsFull } from "../game/rank.js";

const STATUS_LABEL = {
  checkmate: (winner) => `Checkmate — ${winner === WHITE ? "White" : "Black"} wins`,
  stalemate: () => "Draw by stalemate",
  draw: (winner, reason) =>
    ({
      "fifty-move-rule": "Draw — fifty-move rule",
      "insufficient-material": "Draw — insufficient material",
      "threefold-repetition": "Draw — threefold repetition",
      "draw-agreement": "Draw by agreement",
      "network-timeout": "Draw — connection lost",
    }[reason] || "Draw"),
  resigned: (winner) => `${winner === WHITE ? "White" : "Black"} wins by resignation`,
  "opponent-left": (winner) => `${winner === WHITE ? "White" : "Black"} wins — opponent left`,
  timeout: (winner) => `${winner === WHITE ? "White" : "Black"} wins on time`,
};

// mode: "local" | "ai" | "online"
// online-only props: socket, roomCode, opponentInfo, betAmount — the lobby
// already created the room and knows the socket; this screen just plays
// the match on it.
export default function ChessScreen({
  mode = "local",
  difficulty = "intermediate",
  playerColor = WHITE,
  socket = null,
  roomCode = null,
  opponentInfo = null,
  betAmount = 0,
  vsBot = false,
  onExit,
  onMatchEnd,
}) {
  const me = usePlayerStore((s) => s.player);
  const soundsOn = isSoundEnabled(me?.settings);

  const [board, setBoard] = useState(() => createInitialBoard());
  const [gameState, setGameState] = useState(() => createInitialState());
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null); // { status, winner, reason } | null
  const [showEndBanner, setShowEndBanner] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [drawOffer, setDrawOffer] = useState(null); // { from: "me"|"them", offererColor } | null
  const [networkNotice, setNetworkNotice] = useState(null); // "opponent-lost" | null
  const [scores, setScores] = useState({});
  const [chatOpen, setChatOpen] = useState(false);

  // Clocks: only for local and online play, not AI — per-move increment
  // chess clock, tier chosen by bet amount online, or picked up front for
  // local hot-seat games (no bet amount to derive it from there).
  const hasClock = mode === "local" || mode === "online";
  const [localTimeControl, setLocalTimeControl] = useState(null); // local mode only, chosen before play starts
  const [localNames, setLocalNames] = useState({ white: "", black: "" }); // local mode only — optional, falls back to "White"/"Black"
  const [clock, setClock] = useState(null); // { whiteMs, blackMs, turnStartedAt, increment } | null
  const clockTimeoutRef = useRef(null);

  const positionCounts = useRef(new Map());
  const commitMoveRef = useRef(null);
  const workerRef = useRef(null);

  const aiColor = mode === "ai" ? opponent(playerColor) : null;
  const isOnline = mode === "online";

  useEffect(() => {
    if (mode !== "ai") return undefined;
    const worker = new Worker(new URL("../game/chess/chessAI.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [mode]);

  const recordPosition = useCallback((b, s) => {
    const key = positionKey(b, s);
    positionCounts.current.set(key, (positionCounts.current.get(key) || 0) + 1);
  }, []);

  useEffect(() => {
    recordPosition(board, gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local: clock starts once the player picks a time control (see the
  // picker screen in the render below). Online: derived immediately from
  // the bet amount via the same shared function the server uses, so the
  // display has a correct starting value before the first server sync
  // arrives; the server's own numbers (sent with every chess:move) are
  // what actually governs the game from then on.
  useEffect(() => {
    if (clock) return;
    if (mode === "local" && localTimeControl) {
      setClock({
        whiteMs: localTimeControl.baseSeconds * 1000,
        blackMs: localTimeControl.baseSeconds * 1000,
        turnStartedAt: Date.now(),
        incrementMs: localTimeControl.incrementSeconds * 1000,
        totalMs: localTimeControl.baseSeconds * 1000,
      });
    } else if (mode === "online") {
      const tc = getTimeControlForBet("chess", betAmount);
      setClock({
        whiteMs: tc.baseSeconds * 1000,
        blackMs: tc.baseSeconds * 1000,
        turnStartedAt: Date.now(),
        incrementMs: tc.incrementSeconds * 1000,
        totalMs: tc.baseSeconds * 1000,
      });
    }
  }, [mode, localTimeControl, betAmount, clock]);

  // Timeout watcher — local mode only; online timeout is decided by the
  // server (see the socket effect below), since a client-side timer isn't
  // trustworthy for an authoritative result.
  useEffect(() => {
    clearTimeout(clockTimeoutRef.current);
    if (mode !== "local" || !clock || gameOver) return undefined;
    const moverColor = gameState.turn;
    const remaining = (moverColor === WHITE ? clock.whiteMs : clock.blackMs) - (Date.now() - clock.turnStartedAt);
    if (remaining <= 0) {
      setGameOver({ status: "timeout", winner: opponent(moverColor) });
      return undefined;
    }
    clockTimeoutRef.current = setTimeout(() => {
      setGameOver({ status: "timeout", winner: opponent(moverColor) });
    }, remaining);
    return () => clearTimeout(clockTimeoutRef.current);
  }, [mode, clock, gameState.turn, gameOver]);

  const commitMove = useCallback(
    (move, { fromRemote = false } = {}) => {
      if (gameOver) return;
      const { board: nextBoard, state: nextState } = applyMove(board, gameState, move);
      recordPosition(nextBoard, nextState);
      setBoard(nextBoard);
      setGameState(nextState);
      setLastMove(move);
      setDrawOffer(null);

      // Local clock is entirely client-owned (hot-seat, no server to
      // trust); online clock instead comes from the server's chess:move
      // payload (assigned in the socket effect below) since that side
      // must be authoritative.
      if (mode === "local" && clock) {
        const now = Date.now();
        const moverColor = gameState.turn; // whose turn it was before this move
        const spent = now - clock.turnStartedAt;
        const remaining = Math.max(0, (moverColor === WHITE ? clock.whiteMs : clock.blackMs) - spent) + clock.incrementMs;
        setClock((c) => ({
          ...c,
          whiteMs: moverColor === WHITE ? remaining : c.whiteMs,
          blackMs: moverColor === BLACK ? remaining : c.blackMs,
          turnStartedAt: now,
        }));
      }

      if (isOnline) {
        if (!fromRemote) socket?.emit("chess:move", { code: roomCode, move });
        return; // game-over is decided by the server, not here
      }

      const result = getGameStatus(nextBoard, nextState, positionCounts.current);
      if (result.status === "checkmate") setGameOver({ status: "checkmate", winner: result.winner });
      else if (result.status === "stalemate") setGameOver({ status: "stalemate", winner: null });
      else if (result.status === "draw") setGameOver({ status: "draw", winner: null, reason: result.reason });
    },
    [board, gameState, gameOver, recordPosition, isOnline, socket, roomCode, mode, clock]
  );

  // Keeps the stable socket-listener effect below from ever calling a
  // stale commitMove — see onMove's comment there for why this exists.
  useEffect(() => {
    commitMoveRef.current = commitMove;
  }, [commitMove]);

  useEffect(() => {
    if (!isOnline || !socket) return undefined;

    // IMPORTANT: this effect intentionally does NOT depend on commitMove
    // (that would tear down and rebuild every socket listener on every
    // single move). That means this closure would otherwise capture
    // whatever commitMove existed at mount time forever — permanently
    // applying every incoming remote move against the STARTING board
    // instead of the current one, which is exactly what caused pieces to
    // "reset then get stuck after one move." Routing through the ref
    // (always kept current, see above) fixes that: the listener itself
    // never needs to change, but it always calls the latest logic.
    const onMove = ({ move, whiteMs, blackMs, turnStartedAt }) => {
      commitMoveRef.current(move, { fromRemote: true });
      // Online clock is server-owned — every move payload carries the
      // authoritative remaining time for both sides, which is what the
      // GameClock display actually renders (see hasClock/clock below).
      if (typeof whiteMs === "number") {
        setClock((c) => ({ whiteMs, blackMs, turnStartedAt, incrementMs: c?.incrementMs ?? 0, totalMs: c?.totalMs }));
      }
    };
    const onClockSync = ({ whiteMs, blackMs, turnStartedAt }) => {
      setClock((c) => ({ whiteMs, blackMs, turnStartedAt, incrementMs: c?.incrementMs ?? 0, totalMs: c?.totalMs }));
    };
    const onRejected = ({ board: b, gameState: s }) => {
      setBoard(b);
      setGameState(s);
    };
    const onGameOver = ({ winnerId, reason, scores: finalScores }) => {
      const myId = opponentInfo?.myPlayerId;
      let winner = null;
      if (winnerId && myId) winner = winnerId === myId ? playerColor : opponent(playerColor);
      const status =
        reason === "checkmate"
          ? "checkmate"
          : reason === "resignation"
            ? "resigned"
            : reason === "opponent-left"
              ? "opponent-left"
              : reason === "timeout"
                ? "timeout"
                : "draw";
      setGameOver({ status, winner, reason });
      if (finalScores) setScores(finalScores);
    };
    const onDrawOffered = () => {
      setDrawOffer({ from: "them" });
      playSound("notify", soundsOn);
    };
    const onDrawDeclined = () => {
      setDrawOffer(null);
      toastInfo("Opponent declined the draw.");
    };
    const onNetworkLost = () => setNetworkNotice("opponent-lost");
    const onNetworkRestored = () => setNetworkNotice(null);
    const onNetworkTimeout = () => setGameOver({ status: "draw", winner: null, reason: "network-timeout" });

    socket.on("chess:move", onMove);
    socket.on("chess:clock:sync", onClockSync);
    socket.on("chess:move:rejected", onRejected);
    socket.on("chess:game:over", onGameOver);
    socket.on("chess:draw:offered", onDrawOffered);
    socket.on("chess:draw:declined", onDrawDeclined);
    socket.on("chess:opponent:network-lost", onNetworkLost);
    socket.on("chess:opponent:network-restored", onNetworkRestored);
    socket.on("chess:match:network-timeout", onNetworkTimeout);

    return () => {
      socket.off("chess:move", onMove);
      socket.off("chess:clock:sync", onClockSync);
      socket.off("chess:move:rejected", onRejected);
      socket.off("chess:game:over", onGameOver);
      socket.off("chess:draw:offered", onDrawOffered);
      socket.off("chess:draw:declined", onDrawDeclined);
      socket.off("chess:opponent:network-lost", onNetworkLost);
      socket.off("chess:opponent:network-restored", onNetworkRestored);
      socket.off("chess:match:network-timeout", onNetworkTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, socket, playerColor, opponentInfo, soundsOn]);

  useEffect(() => {
    if (mode !== "ai" || gameOver || gameState.turn !== aiColor || !workerRef.current) return;
    setAiThinking(true);
    const worker = workerRef.current;
    const requestId = `${Date.now()}`;
    const handler = (e) => {
      if (e.data.requestId !== requestId) return;
      setAiThinking(false);
      if (e.data.move) commitMove(e.data.move);
      worker.removeEventListener("message", handler);
    };
    worker.addEventListener("message", handler);
    const timer = setTimeout(() => {
      worker.postMessage({ board, state: gameState, color: aiColor, difficulty, requestId });
    }, 400);
    return () => {
      clearTimeout(timer);
      worker.removeEventListener("message", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameState, board, aiColor, difficulty, gameOver, commitMove]);

  const handleMove = (move) => {
    if (aiThinking) return;
    if (mode === "ai" && gameState.turn !== playerColor) return;
    if (isOnline && gameState.turn !== playerColor) return;
    commitMove(move);
  };


  const handleOfferDraw = () => {
    if (gameOver) return;
    if (isOnline) {
      socket?.emit("chess:draw:offer", { code: roomCode });
      setDrawOffer({ from: "me" }); // optimistic — server only echoes this to the opponent
      return;
    }
    setDrawOffer({ from: "them", offererColor: gameState.turn }); // hot-seat: whoever didn't click responds
  };
  const handleAcceptDraw = () => {
    if (isOnline) {
      socket?.emit("chess:draw:accept", { code: roomCode });
      return;
    }
    setGameOver({ status: "draw", winner: null, reason: "draw-agreement" });
  };
  const handleDeclineDraw = () => {
    if (isOnline) socket?.emit("chess:draw:decline", { code: roomCode });
    setDrawOffer(null);
  };

  const handleLeave = async () => {
    if (gameOver) {
      onExit?.();
      return;
    }
    const message = isOnline && betAmount > 0 ? `You'll forfeit this match and your ${formatCoinsFull(betAmount)} coin bet, plus a 100 coin penalty. Leave anyway?` : "Leave this game in progress?";
    const ok = await confirmDialog({ title: "Leave game?", message, confirmLabel: "Leave", tone: "danger" });
    if (!ok) return;
    if (isOnline) socket?.emit("chess:room:leave");
    onExit?.();
  };

  const handleRestart = () => {
    const fresh = createInitialBoard();
    const freshState = createInitialState();
    positionCounts.current = new Map();
    recordPosition(fresh, freshState);
    setBoard(fresh);
    setGameState(freshState);
    setLastMove(null);
    setGameOver(null);
    setDrawOffer(null);
    if (mode === "local" && localTimeControl) {
      setClock({
        whiteMs: localTimeControl.baseSeconds * 1000,
        blackMs: localTimeControl.baseSeconds * 1000,
        turnStartedAt: Date.now(),
        incrementMs: localTimeControl.incrementSeconds * 1000,
        totalMs: localTimeControl.baseSeconds * 1000,
      });
    }
  };

  const statusText = useMemo(() => {
    if (!gameOver) return null;
    if (gameOver.status === "checkmate") return STATUS_LABEL.checkmate(gameOver.winner);
    if (gameOver.status === "stalemate") return STATUS_LABEL.stalemate();
    if (gameOver.status === "draw") return STATUS_LABEL.draw(null, gameOver.reason);
    if (gameOver.status === "resigned") return STATUS_LABEL.resigned(gameOver.winner);
    if (gameOver.status === "opponent-left") return STATUS_LABEL["opponent-left"](gameOver.winner);
    if (gameOver.status === "timeout") return STATUS_LABEL.timeout(gameOver.winner);
    return null;
  }, [gameOver]);

  const inCheck = useMemo(() => getGameStatus(board, gameState, positionCounts.current).inCheck, [board, gameState]);

  // Dramatic game-end banner — shown the instant the match ends, then
  // fades to the normal result modal (local/AI) or hands off to the
  // post-game lobby (online). Mirrors Checkers' pattern.
  const GAME_END_BANNER_MS = 3000;
  useEffect(() => {
    if (!gameOver) return undefined;
    setShowEndBanner(true);
    const t = setTimeout(() => setShowEndBanner(false), GAME_END_BANNER_MS);
    return () => clearTimeout(t);
  }, [gameOver]);

  useEffect(() => {
    if (mode !== "online" || !gameOver) return undefined;
    const t = setTimeout(() => {
      onMatchEnd?.({ ...gameOver, betAmount, scores });
    }, GAME_END_BANNER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameOver]);

  const endBannerOutcome = gameOver
    ? gameOver.status === "stalemate" || gameOver.status === "draw"
      ? "draw"
      : mode === "local"
      ? "win"
      : gameOver.winner === playerColor
      ? "win"
      : "lose"
    : null;
  const endBannerTitle = gameOver
    ? gameOver.status === "stalemate" || gameOver.status === "draw"
      ? "Draw"
      : mode === "local"
      ? `${gameOver.winner === WHITE ? localNames.white.trim() || "White" : localNames.black.trim() || "Black"} Wins`
      : gameOver.winner === playerColor
      ? "Victory"
      : "Defeat"
    : null;
  const endBannerIcon = gameOver
    ? { checkmate: "👑", stalemate: "⚖️", draw: "🤝", resigned: "🏳️", "opponent-left": "📡", timeout: "⏱️" }[gameOver.status] || null
    : null;
  const endBannerSubtitle = gameOver
    ? {
        checkmate: "by checkmate",
        stalemate: "by stalemate",
        draw:
          {
            "fifty-move-rule": "fifty-move rule",
            "insufficient-material": "insufficient material",
            "threefold-repetition": "threefold repetition",
            "draw-agreement": "by agreement",
            "network-timeout": "connection lost",
          }[gameOver.reason] || null,
        resigned: "by resignation",
        "opponent-left": "opponent disconnected",
        timeout: "on time",
      }[gameOver.status] || null
    : null;

  // ---------- GameHUD prop derivation — turn/color as "white"/"black"
  // words (GameHUD's own convention), not chessLogic's "w"/"b" codes. ----------
  const turnWord = gameState.turn === WHITE ? "white" : "black";
  const playerColorWord = playerColor === WHITE ? "white" : "black";
  const playerName = mode === "local" ? localNames.white.trim() || "White" : me?.name || "You";
  const playerAvatar = mode === "local" ? null : me?.avatar;
  const opponentName = mode === "ai" ? `AI (${difficultyLabel(difficulty)})` : mode === "online" ? opponentInfo?.name || "Opponent" : localNames.black.trim() || "Black";
  const opponentAvatar = mode === "online" ? opponentInfo?.avatar : null;

  // Local hot-seat games have no bet amount to derive a time control from,
  // so the player picks one up front instead. Shown once, before the
  // board — the clock-init effect above then starts the clock from this.
  if (mode === "local" && !localTimeControl) {
    return (
      <div className="chess-screen">
        <div className="chess-time-picker">
          <h2>Set up your game</h2>
          <div className="chess-time-picker__names">
            <input
              type="text"
              placeholder="White player name"
              maxLength={20}
              value={localNames.white}
              onChange={(e) => setLocalNames((n) => ({ ...n, white: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Black player name"
              maxLength={20}
              value={localNames.black}
              onChange={(e) => setLocalNames((n) => ({ ...n, black: e.target.value }))}
            />
          </div>
          <p>Choose a time control — both players share the same clock, chess-clock style.</p>
          <div className="chess-time-picker__options">
            {Object.values(TIME_CONTROLS.chess).map((tc) => (
              <button key={tc.key} type="button" className="chess-time-picker__option" onClick={() => setLocalTimeControl(tc)}>
                <strong>{tc.label}</strong>
                <span>
                  {Math.round(tc.baseSeconds / 60)} min + {tc.incrementSeconds}s per move
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="chess-control-btn chess-control-btn--ghost" onClick={() => onExit?.()}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chess-screen">
      <GameHUD
        playerName={playerName}
        playerAvatar={playerAvatar}
        opponentName={opponentName}
        opponentAvatar={opponentAvatar}
        playerColor={mode === "local" ? "white" : playerColorWord}
        playerId={isOnline ? me?.id : null}
        opponentId={isOnline ? opponentInfo?.id : null}
        opponentProfile={isOnline && vsBot ? opponentInfo : null}
        turn={turnWord}
        mode={mode}
        vsBot={isOnline && vsBot}
        potAmount={isOnline ? betAmount * 2 : 0}
        onRestart={mode !== "online" ? handleRestart : undefined}
        onProposeDraw={mode !== "ai" && !gameOver && !drawOffer ? handleOfferDraw : undefined}
        onLeave={handleLeave}
        onToggleChat={isOnline ? () => setChatOpen((o) => !o) : undefined}
        chatOpen={chatOpen}
        chatSlot={
          isOnline && socket ? (
            <ChatPanel socket={socket} roomCode={roomCode} playerName={playerName} playerColor={playerColorWord} open={chatOpen} onClose={() => setChatOpen(false)} />
          ) : null
        }
        soundsOn={soundsOn}
        playerClock={
          hasClock && clock
            ? {
                msAtSync: mode === "local" ? clock.whiteMs : playerColorWord === "white" ? clock.whiteMs : clock.blackMs,
                syncedAt: clock.turnStartedAt,
                isActive: !gameOver && (mode === "local" ? gameState.turn === WHITE : gameState.turn === playerColor),
                totalMs: clock.totalMs,
              }
            : null
        }
        opponentClock={
          hasClock && clock
            ? {
                msAtSync: mode === "local" ? clock.blackMs : playerColorWord === "white" ? clock.blackMs : clock.whiteMs,
                syncedAt: clock.turnStartedAt,
                isActive: !gameOver && (mode === "local" ? gameState.turn === BLACK : gameState.turn !== playerColor),
                totalMs: clock.totalMs,
              }
            : null
        }
      >
        <div className="chess-turn-banner">
          {networkNotice === "opponent-lost" ? (
            <span className="chess-thinking">Opponent's connection dropped — waiting for them to reconnect…</span>
          ) : aiThinking ? (
            <span className="chess-thinking">Thinking…</span>
          ) : (
            <span>
              {(mode === "local" ? (turnWord === "white" ? playerName : opponentName) : turnWord === "white" ? "White" : "Black")}'s turn
              {inCheck ? " — Check!" : ""}
            </span>
          )}
        </div>

        <div className="chess-board-overlay-anchor">
          <ChessBoard
            board={board}
            gameState={gameState}
            onMove={handleMove}
            disabled={!!gameOver || aiThinking || (mode === "ai" && gameState.turn !== playerColor) || (isOnline && gameState.turn !== playerColor)}
            lastMove={lastMove}
            orientation={mode === "ai" || mode === "online" ? playerColor : WHITE}
          />
          {showEndBanner && gameOver && (
            <GameEndBanner outcome={endBannerOutcome} title={endBannerTitle} icon={endBannerIcon} subtitle={endBannerSubtitle} />
          )}
        </div>

        {drawOffer && !gameOver && (
          <div className="draw-offer-bar">
            {drawOffer.from === "them" ? (
              <>
                <span>
                  {mode === "local"
                    ? `${drawOffer.offererColor === WHITE ? localNames.white.trim() || "White" : localNames.black.trim() || "Black"} proposes a draw.`
                    : `${opponentName} proposes a draw.`}
                </span>
                <div className="draw-offer-bar__actions">
                  <Button variant="ghost" onClick={handleDeclineDraw}>
                    Decline
                  </Button>
                  <Button variant="gold" onClick={handleAcceptDraw}>
                    Accept
                  </Button>
                </div>
              </>
            ) : (
              <span>Waiting for {opponentName} to respond to your draw offer…</span>
            )}
          </div>
        )}

        {gameOver && mode !== "online" && (
          <div className="chess-modal-overlay">
            <div className="chess-modal">
              <p className="chess-modal-result">{statusText}</p>
              <div className="chess-modal-actions">
                <button type="button" className="chess-control-btn" onClick={handleRestart}>
                  Rematch
                </button>
                <button
                  type="button"
                  className="chess-control-btn chess-control-btn--ghost"
                  onClick={() => onExit?.(endBannerOutcome === "lose" ? "loss" : endBannerOutcome)}
                >
                  Return Home
                </button>
              </div>
            </div>
          </div>
        )}
      </GameHUD>
    </div>
  );
}
