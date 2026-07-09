import { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board.jsx";
import GameHUD from "./GameHUD.jsx";
import ChatPanel from "./ChatPanel.jsx";
import {
  createInitialBoard,
  boardToPieces,
  getAllMoves,
  applyMove,
  getWinner,
  BOARD_SIZE,
  WHITE,
  BLACK,
} from "../game/checkersLogic.js";
import { getAiMove } from "../game/ai.js";
import { playSound, isSoundEnabled } from "../utils/sound.js";
import { confirmDialog } from "../store/uiStore.js";
import "./GameScreen.css";

// How long the slide/capture animation takes before the turn actually
// advances. Kept in one place so every move (human, AI, or online) shares
// the same pacing instead of pieces teleporting between turns.
const MOVE_ANIMATION_MS = 620;

export default function GameScreen({
  mode, // 'ai' | 'local' | 'online'
  difficulty = "medium",
  level = null,
  settings,
  playerName,
  opponentName,
  playerColor: fixedPlayerColor,
  playerId,
  opponentId,
  betAmount = 0,
  socket,
  roomCode,
  onSettled, // ({ result, coinsDelta, newlyEarned, ... }) => void
  onExit, // (result: 'win'|'loss'|'draw') => void
}) {
  const [board, setBoard] = useState(createInitialBoard);
  const [pieces, setPieces] = useState(() => boardToPieces(createInitialBoard()));
  const [turn, setTurn] = useState(settings.firstMove === "BLACK" ? BLACK : WHITE);
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [connStatus, setConnStatus] = useState({ player: "connected", opponent: "connecting" });

  const soundsOn = isSoundEnabled(settings);
  const animTimer = useRef(null);
  useEffect(() => () => clearTimeout(animTimer.current), []);

  const mandatoryJumps = settings.mandatoryJumps !== "OFF";
  const playerColor = mode === "online" ? fixedPlayerColor : mode === "local" ? turn : fixedPlayerColor || WHITE;
  const aiColor = playerColor === WHITE ? BLACK : WHITE;

  const legalMoves = getAllMoves(board, turn, mandatoryJumps);

  // Restrict interactive moves to the color the local human may currently play.
  const interactiveMoves =
    mode === "local" ? legalMoves : turn === playerColor ? legalMoves : [];

  const isDisabled = isAnimating || gameOver !== null || interactiveMoves.length === 0;

  function finishGame(winner) {
    let result;
    if (mode === "ai" || mode === "online") {
      result = winner === playerColor ? "win" : "loss";
    } else {
      result = `${winner} wins`;
    }
    setGameOver({ winner, result });
    playSound(mode !== "local" && winner !== playerColor ? "lose" : "win", soundsOn);

    if (mode === "online" && socket) {
      const winnerId = winner === playerColor ? playerId : opponentId;
      socket.emit("game:result", { code: roomCode, winnerId });
    }
  }

  // Online: the server settles coins/rank/mojo once per match and reports back.
  useEffect(() => {
    if (mode !== "online" || !socket) return;
    const handler = (payload) => onSettled?.(payload);
    socket.on("game:settled", handler);
    return () => socket.off("game:settled", handler);
  }, [mode, socket, onSettled]);

  const commitMove = useCallback(
    (move) => {
      playSound(move.captures.length > 0 ? "capture" : "move", soundsOn);

      // Snapshot current state for Undo before mutating anything.
      setHistory((h) => [...h, { board, turn, pieces }]);
      setLastMove(move);
      setIsAnimating(true);

      // Move the piece and flag any captured pieces so they can play their
      // fade/shrink animation before actually leaving the board.
      setPieces((prev) => {
        const movingIndex = prev.findIndex(
          (p) => !p.capturing && p.row === move.from.row && p.col === move.from.col
        );
        return prev.map((p, idx) => {
          if (idx === movingIndex) {
            const promoted =
              !p.king && (p.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1);
            return { ...p, row: move.to.row, col: move.to.col, king: p.king || promoted };
          }
          const wasCaptured = move.captures.some((c) => c.row === p.row && c.col === p.col);
          return wasCaptured ? { ...p, capturing: true } : p;
        });
      });

      const nextBoard = applyMove(board, move);
      const nextTurn = turn === WHITE ? BLACK : WHITE;
      const kingedUp = pieces.some(
        (p) =>
          p.row === move.from.row &&
          p.col === move.from.col &&
          !p.king &&
          (p.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1)
      );
      if (kingedUp) {
        setTimeout(() => playSound("king", soundsOn), MOVE_ANIMATION_MS * 0.5);
      }

      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => {
        setPieces((prev) => prev.filter((p) => !p.capturing));
        setBoard(nextBoard);
        setTurn(nextTurn);
        setIsAnimating(false);

        const winner = getWinner(nextBoard, nextTurn, mandatoryJumps);
        if (winner) finishGame(winner);
      }, MOVE_ANIMATION_MS);
    },
    [board, turn, pieces, mandatoryJumps, soundsOn] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Player-initiated move (click on the board).
  const handlePlayerMove = useCallback(
    (move) => {
      if (isDisabled) return;
      commitMove(move);
      if (mode === "online" && socket) {
        socket.emit("game:move", { code: roomCode, move, turn });
      }
    },
    [commitMove, isDisabled, mode, roomCode, socket, turn]
  );

  // AI turn.
  useEffect(() => {
    if (mode !== "ai" || gameOver || isAnimating) return;
    if (turn !== aiColor) return;
    const timer = setTimeout(() => {
      const move = getAiMove(board, aiColor, difficulty, mandatoryJumps);
      if (move) commitMove(move);
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, turn, aiColor, board, difficulty, mandatoryJumps, gameOver, isAnimating, commitMove]);

  // Online: listen for opponent moves.
  useEffect(() => {
    if (mode !== "online" || !socket) return;
    const handler = ({ move }) => commitMove(move);
    socket.on("game:move", handler);
    socket.on("opponent:left", () => setConnStatus((c) => ({ ...c, opponent: "reconnecting" })));
    setConnStatus({ player: "connected", opponent: "connected" });
    return () => {
      socket.off("game:move", handler);
      socket.off("opponent:left");
    };
  }, [mode, socket, commitMove]);

  const handleUndo = () => {
    if (mode !== "local" && mode !== "ai") return;
    if (history.length === 0 || isAnimating) return;
    const prev = history[history.length - 1];
    setBoard(prev.board);
    setTurn(prev.turn);
    setPieces(prev.pieces);
    setHistory((h) => h.slice(0, -1));
    setGameOver(null);
    setLastMove(null);
    playSound("click", soundsOn);
  };

  const handleRestart = () => {
    clearTimeout(animTimer.current);
    const fresh = createInitialBoard();
    setBoard(fresh);
    setPieces(boardToPieces(fresh));
    setTurn(settings.firstMove === "BLACK" ? BLACK : WHITE);
    setHistory([]);
    setLastMove(null);
    setGameOver(null);
    setIsAnimating(false);
    playSound("click", soundsOn);
  };

  const handleHint = () => {
    if (interactiveMoves.length === 0) return;
    const best = getAiMove(board, turn, "hard", mandatoryJumps);
    if (best) setLastMove(best);
    playSound("notify", soundsOn);
  };

  const handleInvalidClick = () => playSound("invalid", soundsOn);

  const handleLeave = async () => {
    if (!gameOver) {
      const message =
        mode === "online" && betAmount > 0
          ? `You'll forfeit this match and your ${betAmount} coin bet. Leave anyway?`
          : "Leave this game in progress?";
      const ok = await confirmDialog({ title: "Leave game?", message, confirmLabel: "Leave", tone: "danger" });
      if (!ok) return;
    }
    onExit(gameOver?.result);
  };

  return (
    <div className="game-screen">
      <GameHUD
        playerName={playerName}
        opponentName={opponentName}
        playerColor={playerColor}
        playerId={mode === "online" ? playerId : null}
        opponentId={mode === "online" ? opponentId : null}
        turn={turn}
        connectionStatus={connStatus}
        mode={mode}
        canUndo={history.length > 0 && mode !== "online"}
        onUndo={mode !== "online" ? handleUndo : undefined}
        onHint={settings.helper !== "OFF" ? handleHint : undefined}
        onRestart={mode !== "online" ? handleRestart : undefined}
        onLeave={handleLeave}
      >
        <Board
          board={board}
          pieces={pieces}
          turn={turn}
          legalMoves={interactiveMoves}
          onMove={handlePlayerMove}
          onInvalid={handleInvalidClick}
          view={settings.view}
          playerColor={playerColor}
          helper={settings.helper !== "OFF"}
          disabled={isDisabled}
          lastMove={lastMove}
        />
      </GameHUD>

      {mode === "online" && socket && (
        <ChatPanel socket={socket} roomCode={roomCode} playerName={playerName} playerColor={playerColor} />
      )}

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h3>{gameOver.winner === playerColor || mode === "local" ? "Game Over" : "Defeat"}</h3>
            <p>
              {mode === "local"
                ? `${gameOver.winner.toUpperCase()} wins!`
                : gameOver.winner === playerColor
                ? "You win! 🎉"
                : "You lose. Try again?"}
            </p>
            {mode === "online" && betAmount > 0 && (
              <p className="game-over-bet">
                {gameOver.winner === playerColor ? `+${betAmount * 2}` : `-${betAmount}`} 🪙
              </p>
            )}
            <div className="game-over-actions">
              {mode !== "online" && <button onClick={handleRestart}>Play Again</button>}
              <button onClick={() => onExit(gameOver.result, gameOver.winner)}>
                {mode === "online" ? "Back to Lobby" : "Exit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
