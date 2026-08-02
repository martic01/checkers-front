// Chess rules engine. Deliberately self-contained (no React, no DOM, no
// dependency on checkersLogic.js) — Chess and Checkers are architecturally
// separate games that happen to live in the same app, per the integration
// brief: "changes to Chess cannot accidentally break Checkers."
//
// Board convention:
//   8x8 array, board[row][col] is either null or { type, color }.
//   type  : "p" | "n" | "b" | "r" | "q" | "k" (lowercase for both colors)
//   color : "w" | "b"
//   row 0 = rank 8 (black's home rank), row 7 = rank 1 (white's home rank)
//   col 0 = file a, col 7 = file h
// This matches how the board is normally *drawn* (black at the top, white
// at the bottom) so ChessBoard.jsx doesn't need to flip anything for the
// default orientation — same spirit as how Board.jsx/checkersLogic.js line
// up row 0 with the top of the rendered board.

export const WHITE = "w";
export const BLACK = "b";
export const BOARD_SIZE = 8;

export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

const START_ROW = {
  b: ["r", "n", "b", "q", "k", "b", "n", "r"],
  w: ["r", "n", "b", "q", "k", "b", "n", "r"],
};

export function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: START_ROW.b[col], color: BLACK };
    board[1][col] = { type: "p", color: BLACK };
    board[6][col] = { type: "p", color: WHITE };
    board[7][col] = { type: START_ROW.w[col], color: WHITE };
  }
  return board;
}

export function createInitialState() {
  return {
    turn: WHITE,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    enPassantTarget: null, // { row, col } — the square a pawn can capture ONTO
    halfmoveClock: 0, // resets on any pawn move or capture; draw at 100 (50 full moves)
    fullmoveNumber: 1,
  };
}

export function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

const FILES = "abcdefgh";
export function algebraic(row, col) {
  return `${FILES[col]}${8 - row}`;
}

// ---------------------------------------------------------------------
// Attack detection — the building block for check, castling-through-check,
// and (via the simulate-and-check approach in getLegalMoves) pins.
// ---------------------------------------------------------------------

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Is (row,col) attacked by any piece belonging to `byColor`? Ignores whose
// turn it is entirely — this is a pure board-geometry question, used both
// for "is the king in check" and for "would the king pass through/land on
// an attacked square" during castling.
export function isSquareAttacked(board, row, col, byColor) {
  // Pawns: a byColor pawn attacks diagonally "forward" from its own
  // perspective, i.e. towards higher row numbers for black, lower for white.
  const pawnRowDelta = byColor === WHITE ? 1 : -1;
  for (const dCol of [-1, 1]) {
    const r = row + pawnRowDelta;
    const c = col + dCol;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "p") return true;
    }
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "n") return true;
    }
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell && cell.color === byColor && cell.type === "k") return true;
    }
  }

  for (const [dr, dc] of BISHOP_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell) {
        if (cell.color === byColor && (cell.type === "b" || cell.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  for (const [dr, dc] of ROOK_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const cell = board[r][c];
      if (cell) {
        if (cell.color === byColor && (cell.type === "r" || cell.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.color === color && cell.type === "k") return { row: r, col: c };
    }
  }
  return null;
}

export function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false; // shouldn't happen in a real game, but never crash on it
  return isSquareAttacked(board, king.row, king.col, opponent(color));
}

// ---------------------------------------------------------------------
// Pseudo-legal move generation — per-piece movement rules, NOT yet
// filtered for "does this leave my own king in check". getLegalMoves
// (below) does that filtering by simulating each move.
// ---------------------------------------------------------------------

function pawnMoves(board, row, col, color, state) {
  const moves = [];
  const dir = color === WHITE ? -1 : 1;
  const startRow = color === WHITE ? 6 : 1;
  const promoRow = color === WHITE ? 0 : 7;

  const oneRow = row + dir;
  if (inBounds(oneRow, col) && !board[oneRow][col]) {
    pushPawnMove(moves, row, col, oneRow, col, promoRow, null);
    const twoRow = row + dir * 2;
    if (row === startRow && !board[twoRow][col]) {
      moves.push({ from: { row, col }, to: { row: twoRow, col }, captured: null, isEnPassant: false, isCastle: null, promotion: null, isDoubleStep: true });
    }
  }

  for (const dCol of [-1, 1]) {
    const r = row + dir;
    const c = col + dCol;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (target && target.color !== color) {
      pushPawnMove(moves, row, col, r, c, promoRow, target);
    } else if (!target && state.enPassantTarget && state.enPassantTarget.row === r && state.enPassantTarget.col === c) {
      moves.push({
        from: { row, col },
        to: { row: r, col: c },
        captured: { type: "p", color: opponent(color) },
        capturedSquare: { row, col: c }, // the actual pawn being taken sits beside the mover, not on the destination
        isEnPassant: true,
        isCastle: null,
        promotion: null,
      });
    }
  }
  return moves;
}

function pushPawnMove(moves, fromRow, fromCol, toRow, toCol, promoRow, captured) {
  if (toRow === promoRow) {
    for (const promo of ["q", "r", "b", "n"]) {
      moves.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, captured, isEnPassant: false, isCastle: null, promotion: promo });
    }
  } else {
    moves.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, captured, isEnPassant: false, isCastle: null, promotion: null });
  }
}

function steppingMoves(board, row, col, color, offsets) {
  const moves = [];
  for (const [dr, dc] of offsets) {
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (!target || target.color !== color) {
      moves.push({ from: { row, col }, to: { row: r, col: c }, captured: target, isEnPassant: false, isCastle: null, promotion: null });
    }
  }
  return moves;
}

function slidingMoves(board, row, col, color, dirs) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) {
        moves.push({ from: { row, col }, to: { row: r, col: c }, captured: null, isEnPassant: false, isCastle: null, promotion: null });
      } else {
        if (target.color !== color) {
          moves.push({ from: { row, col }, to: { row: r, col: c }, captured: target, isEnPassant: false, isCastle: null, promotion: null });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function castlingMoves(board, row, col, color, state) {
  const moves = [];
  if (isSquareAttacked(board, row, col, opponent(color))) return moves; // can't castle out of check

  const homeRow = color === WHITE ? 7 : 0;
  if (row !== homeRow || col !== 4) return moves; // king not on its original square

  const kRight = color === WHITE ? "wK" : "bK";
  const qRight = color === WHITE ? "wQ" : "bQ";

  if (state.castlingRights[kRight]) {
    const rook = board[homeRow][7];
    if (rook && rook.type === "r" && rook.color === color && !board[homeRow][5] && !board[homeRow][6]) {
      const pathClear =
        !isSquareAttacked(board, homeRow, 5, opponent(color)) && !isSquareAttacked(board, homeRow, 6, opponent(color));
      if (pathClear) {
        moves.push({ from: { row, col }, to: { row: homeRow, col: 6 }, captured: null, isEnPassant: false, isCastle: "K", promotion: null });
      }
    }
  }
  if (state.castlingRights[qRight]) {
    const rook = board[homeRow][0];
    if (rook && rook.type === "r" && rook.color === color && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3]) {
      const pathClear =
        !isSquareAttacked(board, homeRow, 3, opponent(color)) && !isSquareAttacked(board, homeRow, 2, opponent(color));
      if (pathClear) {
        moves.push({ from: { row, col }, to: { row: homeRow, col: 2 }, captured: null, isEnPassant: false, isCastle: "Q", promotion: null });
      }
    }
  }
  return moves;
}

// All moves for the single piece at (row,col), ignoring whether they leave
// the mover's own king in check.
export function pseudoLegalMovesForPiece(board, row, col, state) {
  const piece = board[row][col];
  if (!piece) return [];
  switch (piece.type) {
    case "p":
      return pawnMoves(board, row, col, piece.color, state);
    case "n":
      return steppingMoves(board, row, col, piece.color, KNIGHT_OFFSETS);
    case "b":
      return slidingMoves(board, row, col, piece.color, BISHOP_DIRS);
    case "r":
      return slidingMoves(board, row, col, piece.color, ROOK_DIRS);
    case "q":
      return slidingMoves(board, row, col, piece.color, [...BISHOP_DIRS, ...ROOK_DIRS]);
    case "k":
      return [...steppingMoves(board, row, col, piece.color, KING_OFFSETS), ...castlingMoves(board, row, col, piece.color, state)];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------
// Applying a move (mutates nothing — always returns a new board/state)
// ---------------------------------------------------------------------

export function applyMove(board, state, move) {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  const color = piece.color;

  if (move.isEnPassant) {
    next[move.capturedSquare.row][move.capturedSquare.col] = null;
  }

  next[move.to.row][move.to.col] = move.promotion ? { type: move.promotion, color } : { ...piece };
  next[move.from.row][move.from.col] = null;

  if (move.isCastle) {
    const homeRow = move.from.row;
    if (move.isCastle === "K") {
      next[homeRow][5] = next[homeRow][7];
      next[homeRow][7] = null;
    } else {
      next[homeRow][3] = next[homeRow][0];
      next[homeRow][0] = null;
    }
  }

  const castlingRights = { ...state.castlingRights };
  if (piece.type === "k") {
    if (color === WHITE) {
      castlingRights.wK = false;
      castlingRights.wQ = false;
    } else {
      castlingRights.bK = false;
      castlingRights.bQ = false;
    }
  }
  // Losing a rook — whether it moved or got captured on its home square —
  // permanently forfeits castling on that side.
  const forfeit = (row, col) => {
    if (row === 7 && col === 0) castlingRights.wQ = false;
    if (row === 7 && col === 7) castlingRights.wK = false;
    if (row === 0 && col === 0) castlingRights.bQ = false;
    if (row === 0 && col === 7) castlingRights.bK = false;
  };
  forfeit(move.from.row, move.from.col);
  forfeit(move.to.row, move.to.col);

  const enPassantTarget = move.isDoubleStep ? { row: (move.from.row + move.to.row) / 2, col: move.from.col } : null;

  const halfmoveClock = piece.type === "p" || move.captured ? 0 : state.halfmoveClock + 1;
  const fullmoveNumber = color === BLACK ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  return {
    board: next,
    state: { turn: opponent(color), castlingRights, enPassantTarget, halfmoveClock, fullmoveNumber },
  };
}

// Every fully legal move for `color` — pseudo-legal moves filtered down to
// ones that don't leave that color's own king in check. Simulate-and-check
// rather than precomputed pins: simpler to get right, and an 8x8 board with
// at most a few dozen candidate moves per position makes the extra
// simulation cost a non-issue.
export function getLegalMoves(board, color, state) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      for (const move of pseudoLegalMovesForPiece(board, r, c, state)) {
        const { board: after } = applyMove(board, state, move);
        if (!isInCheck(after, color)) moves.push(move);
      }
    }
  }
  return moves;
}

export function hasAnyLegalMove(board, color, state) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      for (const move of pseudoLegalMovesForPiece(board, r, c, state)) {
        const { board: after } = applyMove(board, state, move);
        if (!isInCheck(after, color)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------
// Game-ending conditions
// ---------------------------------------------------------------------

// Deliberately the common, well-established subset of "insufficient
// material": K v K, K+minor v K, and K+B v K+B with same-colored bishops.
// Doesn't attempt every FIDE edge case (e.g. certain locked-pawn fortress
// positions) — those are vanishingly rare in practice and the fifty-move
// rule catches them eventually regardless.
export function isInsufficientMaterial(board) {
  const pieces = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.type !== "k") pieces.push({ ...cell, row: r, col: c });
    }
  }
  if (pieces.length === 0) return true; // K v K
  if (pieces.length === 1 && (pieces[0].type === "n" || pieces[0].type === "b")) return true; // K+minor v K
  if (pieces.length === 2 && pieces.every((p) => p.type === "b")) {
    const squareColor = (row, col) => (row + col) % 2;
    if (squareColor(pieces[0].row, pieces[0].col) === squareColor(pieces[1].row, pieces[1].col) && pieces[0].color !== pieces[1].color) {
      return true; // opposite-colored bishops, same square color (i.e. same-colored-square bishops) — can't force mate
    }
  }
  return false;
}

// FEN-ish position key for threefold-repetition tracking: board + turn +
// castling rights + en passant target. Deliberately excludes the halfmove/
// fullmove counters (those aren't part of what makes two positions "the
// same" for repetition purposes).
export function positionKey(board, state) {
  const rows = board.map((row) => row.map((c) => (c ? c.color + c.type : "-")).join(",")).join("|");
  const cr = state.castlingRights;
  const castle = `${cr.wK ? "K" : ""}${cr.wQ ? "Q" : ""}${cr.bK ? "k" : ""}${cr.bQ ? "q" : ""}`;
  const ep = state.enPassantTarget ? `${state.enPassantTarget.row},${state.enPassantTarget.col}` : "-";
  return `${rows}_${state.turn}_${castle}_${ep}`;
}

// positionCounts: a Map<positionKey, count> the caller maintains across the
// whole game (see ChessScreen.jsx) — kept outside this function since it
// needs to persist across moves, not be recomputed from scratch each time.
export function getGameStatus(board, state, positionCounts) {
  const color = state.turn;
  const inCheck = isInCheck(board, color);
  const hasMove = hasAnyLegalMove(board, color, state);

  if (!hasMove) {
    return inCheck ? { status: "checkmate", winner: opponent(color) } : { status: "stalemate", winner: null };
  }
  if (state.halfmoveClock >= 100) {
    return { status: "draw", reason: "fifty-move-rule", winner: null };
  }
  if (isInsufficientMaterial(board)) {
    return { status: "draw", reason: "insufficient-material", winner: null };
  }
  const key = positionKey(board, state);
  if ((positionCounts?.get(key) || 0) >= 3) {
    return { status: "draw", reason: "threefold-repetition", winner: null };
  }
  return { status: "in-progress", winner: null, inCheck };
}
