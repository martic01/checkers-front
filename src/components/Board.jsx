import { useMemo, useState, useCallback, useEffect } from "react";
import "./Board.css";
import { BOARD_SIZE, isDark } from "../game/checkersLogic.js";

const COLS = "ABCDEFGHIJ".split("");

export default function Board({
  board,
  turn,
  legalMoves,
  onMove,
  view = "HORIZ",
  playerColor = "white",
  helper = true,
  disabled = false,
  lastMove = null,
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

  const destinationsForSelected = useMemo(() => {
    if (!selected) return [];
    return movesFrom.get(`${selected.row}-${selected.col}`) || [];
  }, [selected, movesFrom]);

  const handleSquareClick = useCallback(
    (row, col) => {
      if (disabled) return;
      const key = `${row}-${col}`;
      const piece = board[row][col];

      // Clicking a destination square commits the move.
      if (selected) {
        const move = destinationsForSelected.find((m) => m.to.row === row && m.to.col === col);
        if (move) {
          onMove(move);
          setSelected(null);
          return;
        }
      }

      if (piece && piece.color === turn && selectableSquares.has(key)) {
        setSelected({ row, col });
      } else {
        setSelected(null);
      }
    },
    [board, disabled, destinationsForSelected, onMove, selected, selectableSquares, turn]
  );

  const rotated = view === "VERT" && playerColor === "black";

  const rows = [...Array(BOARD_SIZE).keys()];
  const cols = [...Array(BOARD_SIZE).keys()];
  const rowOrder = rotated ? [...rows].reverse() : rows;
  const colOrder = rotated ? [...cols].reverse() : cols;

  return (
    <div className={`board-wrap ${view === "VERT" ? "board-wrap--vert" : "board-wrap--horiz"}`}>
      <div className="board-coords board-coords--top">
        {colOrder.map((c) => (
          <span key={c}>{COLS[c]}</span>
        ))}
      </div>
      <div className="board-middle">
        <div className="board-coords board-coords--left">
          {rowOrder.map((r) => (
            <span key={r}>{BOARD_SIZE - r}</span>
          ))}
        </div>

        <div className="board-grid">
          <svg className="grain-defs" width="0" height="0">
            <filter id="wood-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.9" numOctaves="3" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
            </filter>
          </svg>

          {rowOrder.map((row) =>
            colOrder.map((col) => {
              const dark = isDark(row, col);
              const piece = board[row][col];
              const key = `${row}-${col}`;
              const isSelected = selected && selected.row === row && selected.col === col;
              const isDestination = destinationsForSelected.some((m) => m.to.row === row && m.to.col === col);
              const isSelectable = helper && selectableSquares.has(key) && piece?.color === turn;
              const isLastMove =
                lastMove &&
                ((lastMove.from.row === row && lastMove.from.col === col) ||
                  (lastMove.to.row === row && lastMove.to.col === col));

              return (
                <div
                  key={key}
                  className={[
                    "square",
                    dark ? "square--dark" : "square--light",
                    isSelected ? "square--selected" : "",
                    isDestination ? "square--destination" : "",
                    isSelectable ? "square--hint" : "",
                    isLastMove ? "square--last-move" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => dark && handleSquareClick(row, col)}
                >
                  {isDestination && <span className="dot" />}
                  {piece && (
                    <div className={`piece piece--${piece.color} ${piece.king ? "piece--king" : ""}`}>
                      {piece.king && <span className="piece-crown">♛</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="board-coords board-coords--right">
          {rowOrder.map((r) => (
            <span key={r}>{BOARD_SIZE - r}</span>
          ))}
        </div>
      </div>
      <div className="board-coords board-coords--bottom">
        {colOrder.map((c) => (
          <span key={c}>{COLS[c]}</span>
        ))}
      </div>
    </div>
  );
}
