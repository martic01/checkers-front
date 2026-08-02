import { useMemo, useState, useEffect } from "react";
import "./ChessBoard.css";
import { BOARD_SIZE, algebraic } from "../../game/chess/chessLogic.js";

const FILES = "abcdefgh".split("");

const PIECE_GLYPH = {
  white: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  black: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

// A standalone, responsive 8x8 board. Deliberately simpler than the
// Checkers Board.jsx (no 3D drag-camera) — same visual language (wood
// tones, gold accents, theme variables) but its own component so nothing
// here can affect Checkers rendering.
export default function ChessBoard({
  board,
  turn,
  legalMoves = [],
  onMove,
  onInvalid,
  onPromotionNeeded, // (moves[]) => void — called instead of onMove when a destination has >1 legal move (promotion choice)
  playerColor = "white",
  disabled = false,
  lastMove = null,
  checkSquare = null, // { row, col } of a king currently in check, or null
}) {
  const [selected, setSelected] = useState(null);

  useEffect(() => setSelected(null), [board]);

  const movesFrom = useMemo(() => {
    const map = new Map();
    for (const move of legalMoves) {
      const key = `${move.from.row}-${move.from.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(move);
    }
    return map;
  }, [legalMoves]);

  const selectableSquares = useMemo(() => new Set(movesFrom.keys()), [movesFrom]);

  const destinations = useMemo(() => {
    if (!selected) return [];
    return movesFrom.get(`${selected.row}-${selected.col}`) || [];
  }, [selected, movesFrom]);

  // Grouped by destination square — a destination with more than one move
  // queued up is a promotion choice (same from/to, different `promotion`).
  const movesByDestKey = useMemo(() => {
    const map = new Map();
    for (const m of destinations) {
      const key = `${m.to.row}-${m.to.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [destinations]);

  const flipped = playerColor === "black";
  const rowOrder = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];
  const colOrder = flipped ? [...Array(BOARD_SIZE).keys()].reverse() : [...Array(BOARD_SIZE).keys()];

  const handleSquareClick = (row, col) => {
    if (disabled) return;
    const key = `${row}-${col}`;
    const piece = board[row][col];

    if (selected) {
      const candidates = movesByDestKey.get(key);
      if (candidates) {
        if (candidates.length > 1) onPromotionNeeded?.(candidates);
        else onMove?.(candidates[0]);
        setSelected(null);
        return;
      }
      if (piece && piece.color === turn && selectableSquares.has(key)) {
        setSelected({ row, col });
        return;
      }
      setSelected(null);
      onInvalid?.();
      return;
    }

    if (piece && piece.color === turn && selectableSquares.has(key)) {
      setSelected({ row, col });
    } else if (piece) {
      onInvalid?.();
    }
  };

  return (
    <div className="chess-board-wrap">
      <div className="chess-board" role="grid" aria-label="Chess board">
        {rowOrder.map((row) =>
          colOrder.map((col) => {
            const isLight = (row + col) % 2 === 0;
            const piece = board[row][col];
            const key = `${row}-${col}`;
            const isSelected = selected && selected.row === row && selected.col === col;
            const isDestination = movesByDestKey.has(key);
            const isCapture = isDestination && !!piece;
            const isLastMoveSquare =
              lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col));
            const isCheck = checkSquare && checkSquare.row === row && checkSquare.col === col;

            return (
              <button
                key={key}
                type="button"
                className={[
                  "chess-square",
                  isLight ? "chess-square--light" : "chess-square--dark",
                  isSelected ? "chess-square--selected" : "",
                  isLastMoveSquare ? "chess-square--last-move" : "",
                  isCheck ? "chess-square--check" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleSquareClick(row, col)}
                aria-label={algebraic(row, col)}
              >
                {row === rowOrder[rowOrder.length - 1] && (
                  <span className="chess-square__file">{FILES[col]}</span>
                )}
                {col === colOrder[0] && <span className="chess-square__rank">{8 - row}</span>}

                {piece && (
                  <span className={`chess-piece chess-piece--${piece.color}`}>{PIECE_GLYPH[piece.color][piece.type]}</span>
                )}

                {isDestination && !isCapture && <span className="chess-square__dot" />}
                {isCapture && <span className="chess-square__capture-ring" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
