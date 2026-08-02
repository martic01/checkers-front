import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChessBoard from "./ChessBoard.jsx";
import "./ChessScreen.css";
import { createInitialBoard, createInitialState, applyMove, getGameStatus, positionKey, WHITE, opponent } from "../game/chess/chessLogic.js";
import { difficultyLabel } from "../game/chess/chessAI.js";

const STATUS_LABEL = {
  checkmate: (winner) => `Checkmate — ${winner === WHITE ? "White" : "Black"} wins`,
  stalemate: () => "Draw by stalemate",
  draw: (winner, reason) =>
    ({
      "fifty-move-rule": "Draw — fifty-move rule",
      "insufficient-material": "Draw — insufficient material",
      "threefold-repetition": "Draw — threefold repetition",
      "draw-agreement": "Draw by agreement",
    }[reason] || "Draw"),
  resigned: (winner) => `${winner === WHITE ? "White" : "Black"} wins by resignation`,
  "opponent-left": (winner) => `${winner === WHITE ? "White" : "Black"} wins — opponent left`,
};

// mode: "local" | "ai" | "online"
// online-only props: socket, roomCode, opponentInfo — the lobby (or
// wherever the match was set up) already created the room and knows the
// socket; this screen just plays the match on it.
export default function ChessScreen({
  mode = "local",
  difficulty = "intermediate",
  playerColor = WHITE,
  socket = null,
  roomCode = null,
  opponentInfo = null,
  onExit,
}) {
  const [board, setBoard] = useState(() => createInitialBoard());
  const [gameState, setGameState] = useState(() => createInitialState());
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null); // { status, winner, reason } | null
  const [aiThinking, setAiThinking] = useState(false);
  const [drawOffer, setDrawOffer] = useState(null); // color that offered, or null
  const [networkNotice, setNetworkNotice] = useState(null); // "opponent-lost" | null
  const [rematchNotice, setRematchNotice] = useState(null); // { betAmount } | null — incoming offer from opponent

  const positionCounts = useRef(new Map());
  const workerRef = useRef(null);

  const aiColor = mode === "ai" ? opponent(playerColor) : null;
  const isOnline = mode === "online";

  // The AI search runs in a Web Worker so it never blocks board
  // interaction, animations, or the rest of the app while it thinks —
  // deliberate given how slow a full-strength (depth 4) search can get.
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

  // Seed the starting position into the repetition counter once.
  useEffect(() => {
    recordPosition(board, gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Applies a move to local board/state (both for the player's own move —
  // optimistic in online mode, see handleMove — and for a move relayed
  // back from the server for the opponent's turn). In online mode,
  // game-over is deliberately NOT decided here: it only ever comes from
  // the server's authoritative chess:game:over event, so a client can
  // never determine its own win/loss/coins.
  const commitMove = useCallback(
    (move, { fromRemote = false } = {}) => {
      if (gameOver) return;
      const { board: nextBoard, state: nextState } = applyMove(board, gameState, move);
      recordPosition(nextBoard, nextState);
      setBoard(nextBoard);
      setGameState(nextState);
      setLastMove(move);
      setDrawOffer(null);

      if (isOnline) {
        if (!fromRemote) socket?.emit("chess:move", { code: roomCode, move });
        return;
      }

      const result = getGameStatus(nextBoard, nextState, positionCounts.current);
      if (result.status === "checkmate") setGameOver({ status: "checkmate", winner: result.winner });
      else if (result.status === "stalemate") setGameOver({ status: "stalemate", winner: null });
      else if (result.status === "draw") setGameOver({ status: "draw", winner: null, reason: result.reason });
    },
    [board, gameState, gameOver, recordPosition, isOnline, socket, roomCode]
  );

  // ---------- Online: socket event wiring ----------
  useEffect(() => {
    if (!isOnline || !socket) return undefined;

    const onMove = ({ move }) => commitMove(move, { fromRemote: true });
    const onRejected = ({ board: b, gameState: s }) => {
      // Our own client thought a move was legal but the server disagreed
      // (should only happen for a tampered/buggy client) — resync to the
      // server's authoritative state rather than staying desynced.
      setBoard(b);
      setGameState(s);
    };
    const onGameOver = ({ winnerId, reason }) => {
      const myId = opponentInfo?.myPlayerId;
      let winner = null;
      if (winnerId && myId) winner = winnerId === myId ? playerColor : opponent(playerColor);
      const status =
        reason === "checkmate" ? "checkmate" : reason === "resignation" ? "resigned" : reason === "opponent-left" ? "opponent-left" : "draw";
      setGameOver({ status, winner, reason });
    };
    const onDrawOffered = () => setDrawOffer(opponent(playerColor));
    const onDrawDeclined = () => setDrawOffer(null);
    const onNetworkLost = () => setNetworkNotice("opponent-lost");
    const onNetworkRestored = () => setNetworkNotice(null);
    const onNetworkTimeout = () => setGameOver({ status: "draw", winner: null, reason: "network-timeout" });
    const onRematchOffered = ({ betAmount }) => setRematchNotice({ betAmount });
    const onRematchStarted = (room) => {
      setBoard(room.board);
      setGameState(room.gameState);
      positionCounts.current = new Map();
      recordPosition(room.board, room.gameState);
      setLastMove(null);
      setGameOver(null);
      setDrawOffer(null);
      setRematchNotice(null);
    };
    const onRematchDeclined = () => setRematchNotice(null);
    const onRematchCancelled = () => setRematchNotice(null);

    socket.on("chess:move", onMove);
    socket.on("chess:move:rejected", onRejected);
    socket.on("chess:game:over", onGameOver);
    socket.on("chess:draw:offered", onDrawOffered);
    socket.on("chess:draw:declined", onDrawDeclined);
    socket.on("chess:opponent:network-lost", onNetworkLost);
    socket.on("chess:opponent:network-restored", onNetworkRestored);
    socket.on("chess:match:network-timeout", onNetworkTimeout);
    socket.on("chess:rematch:offered", onRematchOffered);
    socket.on("chess:rematch:started", onRematchStarted);
    socket.on("chess:rematch:declined", onRematchDeclined);
    socket.on("chess:rematch:cancelled", onRematchCancelled);

    return () => {
      socket.off("chess:move", onMove);
      socket.off("chess:move:rejected", onRejected);
      socket.off("chess:game:over", onGameOver);
      socket.off("chess:draw:offered", onDrawOffered);
      socket.off("chess:draw:declined", onDrawDeclined);
      socket.off("chess:opponent:network-lost", onNetworkLost);
      socket.off("chess:opponent:network-restored", onNetworkRestored);
      socket.off("chess:match:network-timeout", onNetworkTimeout);
      socket.off("chess:rematch:offered", onRematchOffered);
      socket.off("chess:rematch:started", onRematchStarted);
      socket.off("chess:rematch:declined", onRematchDeclined);
      socket.off("chess:rematch:cancelled", onRematchCancelled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, socket, playerColor, opponentInfo]);

  // AI's turn: ask the worker for a move once it's actually the bot's turn.
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
    // Slight delay so a very fast (beginner) response doesn't feel instant/robotic.
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

  const handleResign = () => {
    if (gameOver) return;
    if (isOnline) {
      socket?.emit("chess:resign", { code: roomCode });
      return;
    }
    setGameOver({ status: "resigned", winner: opponent(gameState.turn) });
  };

  const handleOfferDraw = () => {
    if (gameOver) return;
    if (isOnline) {
      socket?.emit("chess:draw:offer", { code: roomCode });
      return;
    }
    setDrawOffer(gameState.turn);
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

  const handleRestart = () => {
    if (isOnline) {
      socket?.emit("chess:rematch:offer", { code: roomCode, betAmount: 0 });
      return;
    }
    const fresh = createInitialBoard();
    const freshState = createInitialState();
    positionCounts.current = new Map();
    recordPosition(fresh, freshState);
    setBoard(fresh);
    setGameState(freshState);
    setLastMove(null);
    setGameOver(null);
    setDrawOffer(null);
  };

  const statusText = useMemo(() => {
    if (!gameOver) return null;
    if (gameOver.status === "checkmate") return STATUS_LABEL.checkmate(gameOver.winner);
    if (gameOver.status === "stalemate") return STATUS_LABEL.stalemate();
    if (gameOver.status === "draw") return gameOver.reason === "network-timeout" ? "Draw — connection lost" : STATUS_LABEL.draw(null, gameOver.reason);
    if (gameOver.status === "resigned") return STATUS_LABEL.resigned(gameOver.winner);
    if (gameOver.status === "opponent-left") return STATUS_LABEL["opponent-left"](gameOver.winner);
    return null;
  }, [gameOver]);

  const turnLabel = gameState.turn === WHITE ? "White" : "Black";
  const inCheck = useMemo(() => getGameStatus(board, gameState, positionCounts.current).inCheck, [board, gameState]);

  const screenTitle =
    mode === "ai"
      ? `Chess vs AI (${difficultyLabel(difficulty)})`
      : mode === "online"
      ? `Chess Online${opponentInfo?.name ? ` vs ${opponentInfo.name}` : ""}`
      : "Chess — Local";

  return (
    <div className="chess-screen">
      <div className="chess-screen__top">
        <button type="button" className="back-link" onClick={() => onExit?.()}>
          ← Back
        </button>
        <div className="chess-screen__title">{screenTitle}</div>
      </div>

      <div className="chess-turn-banner">
        {networkNotice === "opponent-lost" ? (
          <span className="chess-thinking">Opponent's connection dropped — waiting for them to reconnect…</span>
        ) : aiThinking ? (
          <span className="chess-thinking">Thinking…</span>
        ) : (
          <span>
            {turnLabel}'s turn{inCheck ? " — Check!" : ""}
          </span>
        )}
      </div>

      <ChessBoard
        board={board}
        gameState={gameState}
        onMove={handleMove}
        disabled={!!gameOver || aiThinking || (mode === "ai" && gameState.turn !== playerColor) || (isOnline && gameState.turn !== playerColor)}
        lastMove={lastMove}
        orientation={mode === "ai" || mode === "online" ? playerColor : WHITE}
      />

      <div className="chess-controls">
        <button type="button" className="chess-control-btn" onClick={handleResign} disabled={!!gameOver}>
          Resign
        </button>
        <button type="button" className="chess-control-btn" onClick={handleOfferDraw} disabled={!!gameOver || !!drawOffer}>
          Offer Draw
        </button>
      </div>

      {drawOffer && !gameOver && (
        <div className="chess-modal-overlay">
          <div className="chess-modal">
            <p>{drawOffer === WHITE ? "White" : "Black"} offers a draw.</p>
            <div className="chess-modal-actions">
              <button type="button" className="chess-control-btn" onClick={handleAcceptDraw}>
                Accept
              </button>
              <button type="button" className="chess-control-btn chess-control-btn--ghost" onClick={handleDeclineDraw}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {rematchNotice && !gameOver && isOnline && (
        <div className="chess-modal-overlay">
          <div className="chess-modal">
            <p>Opponent wants a rematch.</p>
            <div className="chess-modal-actions">
              <button type="button" className="chess-control-btn" onClick={() => socket?.emit("chess:rematch:accept", { code: roomCode })}>
                Accept
              </button>
              <button
                type="button"
                className="chess-control-btn chess-control-btn--ghost"
                onClick={() => {
                  socket?.emit("chess:rematch:decline", { code: roomCode });
                  setRematchNotice(null);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="chess-modal-overlay">
          <div className="chess-modal">
            <p className="chess-modal-result">{statusText}</p>
            <div className="chess-modal-actions">
              <button type="button" className="chess-control-btn" onClick={handleRestart}>
                Rematch
              </button>
              <button type="button" className="chess-control-btn chess-control-btn--ghost" onClick={() => onExit?.()}>
                Return Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
