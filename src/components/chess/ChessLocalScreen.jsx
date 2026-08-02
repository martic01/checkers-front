import { useState } from "react";
import ChessBoard from "./ChessBoard.jsx";
import "./ChessLocalScreen.css";
import "../GameScreen.css"; // reuses .game-over-overlay/.game-over-card/.game-over-actions
import {
  createInitialState,
  allLegalMoves,
  applyMove,
  getGameStatus,
  isInCheck,
  WHITE,
  PIECE_NAMES,
} from "../../game/chess/chessLogic.js";
import { playSound, isSoundEnabled } from "../../utils/sound.js";

const DRAW_REASON_LABEL = {
  "insufficient-material": "Draw — insufficient material",
  "threefold-repetition": "Draw — threefold repetition",
  "fifty-move-rule": "Draw — fifty-move rule",
};

function findKingSquare(board, color) {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === "k") return { row: r, col: c };
    }
  }
  return null;
}

// Local hot-seat Chess — two players, one screen, no network involved.
// Entirely separate from Checkers' GameScreen: its own state, its own
// board component, its own rules engine. Nothing here touches Checkers.
export default function ChessLocalScreen({ settings, onBack }) {
  const [state, setState] = useState(() => createInitialState());
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null); // { type, winner? , reason? } | null
  const [pendingPromotion, setPendingPromotion] = useState(null); // moves[] sharing a destination

  const soundsOn = isSoundEnabled(settings);
  const legalMoves = gameOver ? [] : allLegalMoves(state, state.turn);
  const inCheck = !gameOver && isInCheck(state.board, state.turn);
  const checkSquare = inCheck ? findKingSquare(state.board, state.turn) : null;

  const commitMove = (move) => {
    const next = applyMove(state, move);
    setState(next);
    setLastMove(move);

    const status = getGameStatus(next);
    if (status) {
      if (status.type === "checkmate") {
        setGameOver({ type: "checkmate", winner: status.winner });
        playSound(status.winner ? "gameEndWin" : "gameEndLose", soundsOn);
      } else if (status.type === "stalemate") {
        setGameOver({ type: "stalemate" });
        playSound("gameEndDraw", soundsOn);
      } else {
        setGameOver({ type: "draw", reason: status.reason });
        playSound("gameEndDraw", soundsOn);
      }
      return;
    }

    if (isInCheck(next.board, next.turn)) {
      playSound("notify", soundsOn);
    } else {
      playSound("click", soundsOn);
    }
  };

  const handleMove = (move) => {
    commitMove(move);
  };

  const handleInvalid = () => playSound("invalid", soundsOn);

  const handlePromotionPick = (piece) => {
    const move = pendingPromotion?.find((m) => m.promotion === piece);
    setPendingPromotion(null);
    if (move) commitMove(move);
  };

  const handleRestart = () => {
    setState(createInitialState());
    setLastMove(null);
    setGameOver(null);
    setPendingPromotion(null);
    playSound("click", soundsOn);
  };

  const turnLabel = state.turn === WHITE ? "White" : "Black";

  return (
    <div className="chess-local-screen">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>

      <h2 className="chess-local-title">♞ Local Chess</h2>

      {!gameOver && (
        <p className={`chess-turn-indicator ${inCheck ? "chess-turn-indicator--check" : ""}`}>
          {turnLabel} to move{inCheck ? " — Check!" : ""}
        </p>
      )}

      <ChessBoard
        board={state.board}
        turn={state.turn}
        legalMoves={legalMoves}
        onMove={handleMove}
        onInvalid={handleInvalid}
        onPromotionNeeded={(moves) => setPendingPromotion(moves)}
        disabled={!!gameOver || !!pendingPromotion}
        lastMove={lastMove}
        checkSquare={checkSquare}
      />

      {pendingPromotion && (
        <div className="chess-promotion-overlay">
          <div className="chess-promotion-card">
            <h3>Promote pawn to:</h3>
            <div className="chess-promotion-choices">
              {["q", "r", "b", "n"].map((piece) => (
                <button key={piece} className="chess-promotion-choice" onClick={() => handlePromotionPick(piece)}>
                  {PIECE_NAMES[piece]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h3>
              {gameOver.type === "checkmate"
                ? `Checkmate — ${gameOver.winner === WHITE ? "White" : "Black"} wins`
                : gameOver.type === "stalemate"
                  ? "Stalemate — Draw"
                  : DRAW_REASON_LABEL[gameOver.reason] || "Draw"}
            </h3>
            <p>
              {gameOver.type === "checkmate"
                ? "Nice finish — want a rematch?"
                : "Neither side could force a win here."}
            </p>
            <div className="game-over-actions">
              <button onClick={handleRestart}>Play Again</button>
              <button onClick={onBack}>Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
