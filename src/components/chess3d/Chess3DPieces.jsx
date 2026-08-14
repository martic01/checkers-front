import { useEffect, useRef, useState } from "react";
import Chess3DPiece from "./Chess3DPiece.jsx";
import { useGLTFPieceSet } from "./gltfPieces.js";

const CAPTURE_ANIM_MS = 480;

// lastMove (from chessLogic's move objects) already tells us everything
// needed to animate a turn — which square a piece left, which square it
// landed on, whether a rook also moved (castling), and which square held
// a captured piece (including en passant, where that's NOT the same as
// the destination square). No heuristics, no piece-identity guessing.
export default function Chess3DPieces({ board, lastMove, orientation, selected, onSelect }) {
  const pieceSet = useGLTFPieceSet();
  const [ghost, setGhost] = useState(null); // { type, color, row, col, key } | null
  const ghostTimer = useRef(null);

  useEffect(() => {
    if (!lastMove?.captured) return undefined;
    const square = lastMove.isEnPassant ? lastMove.capturedSquare : lastMove.to;
    setGhost({ type: lastMove.captured.type, color: lastMove.captured.color, row: square.row, col: square.col, key: `${Date.now()}` });
    clearTimeout(ghostTimer.current);
    ghostTimer.current = setTimeout(() => setGhost(null), CAPTURE_ANIM_MS);
    return () => clearTimeout(ghostTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove]);

  // Map of "destination square" -> "origin square" for pieces that moved
  // this turn, so the piece currently sitting there knows to animate in
  // from somewhere instead of just appearing.
  const origins = {};
  if (lastMove) {
    origins[`${lastMove.to.row},${lastMove.to.col}`] = lastMove.from;
    if (lastMove.isCastle) {
      const homeRow = lastMove.from.row;
      const rookFromCol = lastMove.isCastle === "K" ? 7 : 0;
      const rookToCol = lastMove.isCastle === "K" ? 5 : 3;
      origins[`${homeRow},${rookToCol}`] = { row: homeRow, col: rookFromCol };
    }
  }

  const pieces = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = board[row][col];
      if (!cell) continue;
      const fromSquare = origins[`${row},${col}`] || null;
      pieces.push(
        <Chess3DPiece
          key={`${row}-${col}-${cell.type}${cell.color}`}
          type={cell.type}
          color={cell.color}
          row={row}
          col={col}
          orientation={orientation}
          fromSquare={fromSquare}
          isSelected={!!selected && selected.row === row && selected.col === col}
          onSelect={onSelect}
          gltfPiece={pieceSet ? pieceSet[cell.color]?.[cell.type] : null}
        />
      );
    }
  }

  if (ghost) {
    pieces.push(
      <Chess3DPiece
        key={`ghost-${ghost.key}`}
        type={ghost.type}
        color={ghost.color}
        row={ghost.row}
        col={ghost.col}
        orientation={orientation}
        isCapturing
        onSelect={() => {}}
        gltfPiece={pieceSet ? pieceSet[ghost.color]?.[ghost.type] : null}
      />
    );
  }

  return <group>{pieces}</group>;
}