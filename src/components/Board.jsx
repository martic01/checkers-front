import { useMemo, useState, useCallback, useEffect } from "react";
import "./Board.css";
import { BOARD_SIZE, isDark } from "../game/checkersLogic.js";

const COLS = "ABCDEFGHIJ".split("");

export default function Board({
  board,
  pieces = [],
  turn,
  legalMoves,
  onMove,
  onInvalid,
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
        if (piece || selected) onInvalid?.();
        setSelected(null);
      }
    },
    [board, disabled, destinationsForSelected, onMove, onInvalid, selected, selectableSquares, turn]
  );

  const rotated = view === "VERT" && playerColor === "black";

  const rows = [...Array(BOARD_SIZE).keys()];
  const cols = [...Array(BOARD_SIZE).keys()];
  const rowOrder = rotated ? [...rows].reverse() : rows;
  const colOrder = rotated ? [...cols].reverse() : cols;

  const displayPos = (row, col) => ({
    dRow: rotated ? BOARD_SIZE - 1 - row : row,
    dCol: rotated ? BOARD_SIZE - 1 - col : col,
  });

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

        <div className="board-stage">
          <svg className="grain-defs" width="0" height="0">
            <filter id="wood-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.9" numOctaves="3" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
            </filter>
          </svg>

          <div className="board-grid">
            {rowOrder.map((row) =>
              colOrder.map((col) => {
                const dark = isDark(row, col);
                const key = `${row}-${col}`;
                const isSelected = selected && selected.row === row && selected.col === col;
                const isDestination = destinationsForSelected.some((m) => m.to.row === row && m.to.col === col);
                const isSelectable = helper && selectableSquares.has(key) && board[row][col]?.color === turn;
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
                  </div>
                );
              })
            )}
          </div>

          <div className="pieces-layer">
            {pieces.map((p) => {
              const { dRow, dCol } = displayPos(p.row, p.col);
              const isSelected = selected && selected.row === p.row && selected.col === p.col && !p.capturing;
              return (
                <div
                  key={p.id}
                  className={[
                    "piece-token",
                    `piece-token--${p.color}`,
                    p.king ? "piece-token--king" : "",
                    p.capturing ? "piece-token--capturing" : "",
                    isSelected ? "piece-token--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: `${dCol * 10}%`, top: `${dRow * 10}%` }}
                >
                  <div className="piece-token__body">{p.king && <span className="piece-crown">♛</span>}</div>
                </div>
              );
            })}
          </div>
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
