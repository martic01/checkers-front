import { useMemo, useRef, useState } from "react";
import "./ChessBoard.css";
import { getLegalMoves, isInCheck, findKing, algebraic, WHITE } from "../game/chess/chessLogic.js";
import Chess3DScene from "./chess3d/Chess3DScene.jsx";
import { detectWebGLSupport } from "./chess3d/webglSupport.js";

const COLS = "abcdefgh".split("");
const PIECE_GLYPH = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const PROMOTION_CHOICES = ["q", "r", "b", "n"];

export default function ChessBoard({
  board,
  gameState,
  onMove,
  disabled = false,
  lastMove = null,
  orientation = WHITE, // which color's perspective the board is drawn from
}) {
  const [selected, setSelected] = useState(null); // {row, col} | null
  const [pendingPromotion, setPendingPromotion] = useState(null); // {from, to, choices} | null
  const [is3D, setIs3D] = useState(false);
  // WebGL capability is checked once, lazily, the first time it's actually
  // needed — never blocks loading the (always-available) 2D board.
  const [webglChecked, setWebglChecked] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [softwareRendered, setSoftwareRendered] = useState(false);
  const [threeDFailed, setThreeDFailed] = useState(false);
  const orbitControlsRef = useRef(null);

  // ---------- Shared game-interaction state (used by BOTH render paths —
  // the 3D scene never duplicates this, it only calls handleSquareClick) ----------
  const legalMoves = useMemo(() => {
    if (!selected) return [];
    const all = getLegalMoves(board, gameState.turn, gameState);
    return all.filter((m) => m.from.row === selected.row && m.from.col === selected.col);
  }, [board, gameState, selected]);

  const destinationsBySquare = useMemo(() => {
    const map = new Map();
    for (const m of legalMoves) {
      const key = `${m.to.row},${m.to.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [legalMoves]);

  const inCheck = isInCheck(board, gameState.turn);
  const checkedKing = inCheck ? findKing(board, gameState.turn) : null;

  const handleSquareClick = (row, col) => {
    if (disabled || pendingPromotion) return;
    const cell = board[row][col];
    const key = `${row},${col}`;
    const matches = destinationsBySquare.get(key);

    if (selected && matches && matches.length > 0) {
      if (matches.length > 1) {
        setPendingPromotion({ from: selected, to: { row, col }, choices: matches });
      } else {
        onMove(matches[0]);
      }
      setSelected(null);
      return;
    }

    if (cell && cell.color === gameState.turn) setSelected({ row, col });
    else setSelected(null);
  };

  const confirmPromotion = (piece) => {
    const move = pendingPromotion.choices.find((m) => m.promotion === piece);
    if (move) onMove(move);
    setPendingPromotion(null);
  };

  const handleToggle3D = () => {
    console.info("[Chess3D] 3D toggle clicked. Currently 3D:", is3D);
    if (is3D) {
      setIs3D(false);
      return;
    }
    // Checked lazily (not on mount) so the 2D board never waits on this,
    // and a device that will never use 3D never pays for the check.
    if (!webglChecked) {
      const { supported, softwareRendered: sw } = detectWebGLSupport();
      setWebglChecked(true);
      setWebglOk(supported);
      setSoftwareRendered(sw);
      if (!supported) return; // stay on 2D — console already explains why
    } else if (!webglOk) {
      console.info("[Chess3D] WebGL was already checked and found unavailable — staying on 2D.");
      return;
    }
    setThreeDFailed(false);
    setIs3D(true);
  };

  const handleResetCamera = () => {
    orbitControlsRef.current?.reset();
  };

  const rotated = orientation !== WHITE;
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];
  const rowOrder = rotated ? [...rows].reverse() : rows;
  const colOrder = rotated ? [...cols].reverse() : cols;
  const displayPos = (row, col) => ({ dRow: rotated ? 7 - row : row, dCol: rotated ? 7 - col : col });

  const show3D = is3D && webglOk && !threeDFailed;

  return (
    <div className="chess-board-wrap">
      {show3D ? (
        <Chess3DScene
          board={board}
          gameState={gameState}
          orientation={orientation}
          lastMove={lastMove}
          selected={selected}
          destinationsBySquare={destinationsBySquare}
          checkedKing={checkedKing}
          onSquareClick={handleSquareClick}
          controlsRef={orbitControlsRef}
          forceLowQuality={softwareRendered}
          onFatalError={() => {
            // WebGL/Three.js broke mid-session — never let that take Chess
            // down with it, just drop back to the always-working 2D board.
            setThreeDFailed(true);
            setIs3D(false);
          }}
        />
      ) : (
        <>
          <div className="chess-coords chess-coords--top">
            {colOrder.map((c) => (
              <span key={c}>{COLS[c]}</span>
            ))}
          </div>

          <div className="chess-board-middle">
            <div className="chess-coords chess-coords--left">
              {rowOrder.map((r) => (
                <span key={r}>{8 - r}</span>
              ))}
            </div>

            <div className="chess-grid-flat">
              {rowOrder.map((row) =>
                colOrder.map((col) => {
                  const isLight = (row + col) % 2 === 0;
                  const isSelected = selected && selected.row === row && selected.col === col;
                  const isLastMoveSquare =
                    lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col));
                  const isCheckedKing = checkedKing && checkedKing.row === row && checkedKing.col === col;
                  const destMoves = destinationsBySquare.get(`${row},${col}`);
                  const isLegalDest = selected && destMoves && destMoves.length > 0;
                  const isCaptureDest = isLegalDest && destMoves.some((m) => m.captured);
                  const cell = board[row][col];

                  return (
                    <button
                      key={`${row}-${col}`}
                      type="button"
                      className={[
                        "chess-square-flat",
                        isLight ? "chess-square-flat--light" : "chess-square-flat--dark",
                        isSelected ? "chess-square-flat--selected" : "",
                        isLastMoveSquare ? "chess-square-flat--last-move" : "",
                        isCheckedKing ? "chess-square-flat--check" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleSquareClick(row, col)}
                      disabled={disabled}
                      aria-label={algebraic(row, col)}
                    >
                      {cell && <span className="chess-piece-shadow-flat" />}
                      {cell && <span className={`chess-glyph chess-glyph--${cell.color}`}>{PIECE_GLYPH[cell.color][cell.type]}</span>}
                      {isLegalDest && !cell && <span className="chess-move-dot-flat" />}
                      {isCaptureDest && <span className="chess-capture-ring-flat" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="chess-coords chess-coords--right">
              {rowOrder.map((r) => (
                <span key={r}>{8 - r}</span>
              ))}
            </div>
          </div>

          <div className="chess-coords chess-coords--bottom">
            {colOrder.map((c) => (
              <span key={c}>{COLS[c]}</span>
            ))}
          </div>
        </>
      )}

      <div className="chess-3d-controls">
        <button
          type="button"
          className={`chess-3d-toggle ${show3D ? "chess-3d-toggle--active" : ""}`}
          onClick={handleToggle3D}
          disabled={webglChecked && !webglOk}
          title={webglChecked && !webglOk ? "3D isn't available on this device — staying on the 2D board" : show3D ? "Switch to 2D View" : "Enable 3D View"}
          aria-label={show3D ? "Switch to 2D view" : "Enable 3D view"}
        >
          <span className="chess-btn-icon">🧊</span>
          <span className="chess-btn-text">{show3D ? "2D" : "3D"}</span>
        </button>
        {show3D && (
          <button type="button" className="chess-3d-toggle" onClick={handleResetCamera} title="Reset camera" aria-label="Reset camera">
            <span className="chess-btn-icon">🎯</span>
            <span className="chess-btn-text">Reset</span>
          </button>
        )}
      </div>

      {show3D && (
        <p className="chess-3d-credit">
          "Chess Board" by{" "}
          <a href="https://sketchfab.com/paulyanez" target="_blank" rel="noreferrer noopener">
            Anthony Yanez
          </a>{" "}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer noopener">
            CC-BY-4.0
          </a>
          )
        </p>
      )}

      {pendingPromotion && (
        <div className="chess-promotion-overlay">
          <div className="chess-promotion-modal">
            <p className="chess-promotion-title">Promote to</p>
            <div className="chess-promotion-choices">
              {PROMOTION_CHOICES.map((piece) => (
                <button key={piece} type="button" className="chess-promotion-choice" onClick={() => confirmPromotion(piece)} aria-label={`Promote to ${piece}`}>
                  {PIECE_GLYPH[gameState.turn][piece]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
