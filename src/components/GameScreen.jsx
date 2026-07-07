import { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board.jsx";
import GameHUD from "./GameHUD.jsx";
import {
  createInitialBoard,
  getAllMoves,
  applyMove,
  getWinner,
  WHITE,
  BLACK,
} from "../game/checkersLogic.js";
import { getAiMove } from "../game/ai.js";
import "./GameScreen.css";

export default function GameScreen({
  mode, // 'ai' | 'local' | 'online'
  difficulty = "medium",
  level = null,
  settings,
  playerName,
  opponentName,
  playerColor: fixedPlayerColor,
  socket,
  roomCode,
  onExit, // (result: 'win'|'loss'|'draw') => void
}) {
  const [board, setBoard] = useState(createInitialBoard);
  const [turn, setTurn] = useState(settings.firstMove === "BLACK" ? BLACK : WHITE);
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [connStatus, setConnStatus] = useState({ player: "connected", opponent: "connecting" });

  const mandatoryJumps = settings.mandatoryJumps !== "OFF";
  const playerColor = mode === "online" ? fixedPlayerColor : mode === "local" ? turn : fixedPlayerColor || WHITE;
  const aiColor = playerColor === WHITE ? BLACK : WHITE;

  const legalMoves = getAllMoves(board, turn, mandatoryJumps);

  // Restrict interactive moves to the color the local human may currently play.
  const interactiveMoves =
    mode === "local"
      ? legalMoves
      : turn === playerColor
      ? legalMoves
      : [];

  const isDisabled = gameOver !== null || interactiveMoves.length === 0;

  const commitMove = useCallback(
    (move) => {
      setBoard((prevBoard) => {
        const nextBoard = applyMove(prevBoard, move);
        setHistory((h) => [...h, { board: prevBoard, turn }]);
        setLastMove(move);
        const nextTurn = turn === WHITE ? BLACK : WHITE;
        const winner = getWinner(nextBoard, nextTurn, mandatoryJumps);
        if (winner) {
          finishGame(winner);
        }
        setTurn(nextTurn);
        return nextBoard;
      });
    },
    [turn, mandatoryJumps] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function finishGame(winner) {
    let result;
    if (mode === "ai") {
      result = winner === playerColor ? "win" : "loss";
    } else if (mode === "online") {
      result = winner === playerColor ? "win" : "loss";
    } else {
      result = `${winner} wins`;
    }
    setGameOver({ winner, result });
  }

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
    if (mode !== "ai" || gameOver) return;
    if (turn !== aiColor) return;
    const timer = setTimeout(() => {
      const move = getAiMove(board, aiColor, difficulty, mandatoryJumps);
      if (move) commitMove(move);
    }, 450);
    return () => clearTimeout(timer);
  }, [mode, turn, aiColor, board, difficulty, mandatoryJumps, gameOver, commitMove]);

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
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setBoard(prev.board);
    setTurn(prev.turn);
    setHistory((h) => h.slice(0, -1));
    setGameOver(null);
    setLastMove(null);
  };

  const handleRestart = () => {
    setBoard(createInitialBoard());
    setTurn(settings.firstMove === "BLACK" ? BLACK : WHITE);
    setHistory([]);
    setLastMove(null);
    setGameOver(null);
  };

  const handleHint = () => {
    if (interactiveMoves.length === 0) return;
    const best = getAiMove(board, turn, "hard", mandatoryJumps);
    if (best) setLastMove(best);
  };

  return (
    <div className="game-screen">
      <GameHUD
        playerName={playerName}
        opponentName={opponentName}
        playerColor={playerColor}
        turn={turn}
        connectionStatus={connStatus}
        mode={mode}
        canUndo={history.length > 0 && mode !== "online"}
        onUndo={mode !== "online" ? handleUndo : undefined}
        onHint={settings.helper !== "OFF" ? handleHint : undefined}
        onRestart={mode !== "online" ? handleRestart : undefined}
        onLeave={() => onExit(gameOver?.result)}
      />

      <Board
        board={board}
        turn={turn}
        legalMoves={interactiveMoves}
        onMove={handlePlayerMove}
        view={settings.view}
        playerColor={playerColor}
        helper={settings.helper !== "OFF"}
        disabled={isDisabled}
        lastMove={lastMove}
      />

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
            <div className="game-over-actions">
              <button onClick={handleRestart}>Play Again</button>
              <button onClick={() => onExit(gameOver.result, gameOver.winner)}>Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
