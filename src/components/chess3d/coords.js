// The one place board[row][col] gets converted to a 3D world position.
// Every 3D component (pieces, markers, raycasting-to-square) goes through
// this — nothing hardcodes an individual square's coordinates. Orientation
// simply mirrors both axes, so the same function works unchanged for
// white's perspective, black's perspective, local, AI, and online play.
import { WHITE } from "../../game/chess/chessLogic.js";

export const SQUARE_SIZE = 0.77;
const BOARD_OFFSET = (8 - 1) / 2; // centers an 8-wide board on world origin

export function getWorldPosition(row, col, orientation = WHITE) {
  const flip = orientation !== WHITE;
  const dCol = flip ? 7 - col : col;
  const dRow = flip ? 7 - row : row;
  return {
    x: (dCol - BOARD_OFFSET) * SQUARE_SIZE,
    z: (dRow - BOARD_OFFSET) * SQUARE_SIZE,
  };
}

// Inverse of the above — used to turn a raycast hit's world X/Z back into
// a board row/col (see Chess3DBoard.jsx's square click handling).
export function worldToBoardPosition(x, z, orientation = WHITE) {
  const flip = orientation !== WHITE;
  const rawCol = Math.round(x / SQUARE_SIZE + BOARD_OFFSET);
  const rawRow = Math.round(z / SQUARE_SIZE + BOARD_OFFSET);
  const col = flip ? 7 - rawCol : rawCol;
  const row = flip ? 7 - rawRow : rawRow;
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return { row, col };
}
