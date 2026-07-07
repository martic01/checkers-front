// International Draughts (10x10) rules engine.
// Board is a 10x10 grid. Only "dark" squares (row+col odd) are playable.
// A square is either null or { color: 'white' | 'black', king: boolean }.

export const BOARD_SIZE = 10;
export const WHITE = "white";
export const BLACK = "black";

export function isDark(row, col) {
  return (row + col) % 2 === 1;
}

export function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isDark(row, col)) continue;
      if (row < 4) board[row][col] = { color: BLACK, king: false };
      else if (row > 5) board[row][col] = { color: WHITE, king: false };
    }
  }
  return board;
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// Finds every legal capture sequence for a piece at (row, col).
// Men in international draughts capture forward or backward.
// Kings are "flying kings": they move/capture any distance along a diagonal.
function findCaptureSequences(board, row, col, piece, visitedCaptures = []) {
  const sequences = [];

  for (const [dr, dc] of DIRS) {
    if (piece.king) {
      // Flying king: scan outward for the first enemy piece, then any empty
      // landing square beyond it.
      let r = row + dr;
      let c = col + dc;
      let enemyPos = null;
      while (inBounds(r, c)) {
        const cell = board[r][c];
        if (cell === null) {
          if (enemyPos) {
            const alreadyCaptured = visitedCaptures.some(
              (p) => p.row === enemyPos.row && p.col === enemyPos.col
            );
            if (!alreadyCaptured) {
              const newBoard = cloneBoard(board);
              newBoard[row][col] = null;
              newBoard[enemyPos.row][enemyPos.col] = null;
              newBoard[r][c] = { ...piece };
              const nextVisited = [...visitedCaptures, enemyPos];
              const further = findCaptureSequences(newBoard, r, c, piece, nextVisited);
              if (further.length === 0) {
                sequences.push({ to: { row: r, col: c }, captures: nextVisited });
              } else {
                for (const seq of further) {
                  sequences.push({ to: seq.to, captures: seq.captures, chain: [{ row: r, col: c }, ...(seq.chain || [])] });
                }
              }
            }
          }
          r += dr;
          c += dc;
          continue;
        }
        if (cell.color === piece.color) break; // blocked by own piece
        if (enemyPos) break; // second enemy piece in a row blocks
        enemyPos = { row: r, col: c };
        r += dr;
        c += dc;
      }
    } else {
      // Man: capture exactly one adjacent enemy piece, landing one square beyond.
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + dr * 2;
      const landC = col + dc * 2;
      if (!inBounds(landR, landC)) continue;
      const midCell = board[midR]?.[midC];
      const landCell = board[landR]?.[landC];
      if (midCell && midCell.color !== piece.color && landCell === null) {
        const alreadyCaptured = visitedCaptures.some(
          (p) => p.row === midR && p.col === midC
        );
        if (alreadyCaptured) continue;
        const newBoard = cloneBoard(board);
        newBoard[row][col] = null;
        newBoard[midR][midC] = null;
        const promoted = !piece.king && (piece.color === WHITE ? landR === 0 : landR === BOARD_SIZE - 1);
        newBoard[landR][landC] = { ...piece, king: piece.king || promoted };
        const nextVisited = [...visitedCaptures, { row: midR, col: midC }];
        // Once promoted mid-sequence, standard rules stop the chain (simplification).
        const further = promoted ? [] : findCaptureSequences(newBoard, landR, landC, newBoard[landR][landC], nextVisited);
        if (further.length === 0) {
          sequences.push({ to: { row: landR, col: landC }, captures: nextVisited });
        } else {
          for (const seq of further) {
            sequences.push({ to: seq.to, captures: seq.captures, chain: [{ row: landR, col: landC }, ...(seq.chain || [])] });
          }
        }
      }
    }
  }

  return sequences;
}

function findSimpleMoves(board, row, col, piece) {
  const moves = [];
  for (const [dr, dc] of DIRS) {
    if (piece.king) {
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c) && board[r][c] === null) {
        moves.push({ to: { row: r, col: c } });
        r += dr;
        c += dc;
      }
    } else {
      // Men move forward only for simple (non-capturing) moves.
      const forward = piece.color === WHITE ? -1 : 1;
      if (dr !== forward) continue;
      const r = row + dr;
      const c = col + dc;
      if (inBounds(r, c) && board[r][c] === null) {
        moves.push({ to: { row: r, col: c } });
      }
    }
  }
  return moves;
}

// Returns all legal moves for `color`. If any capture exists anywhere on the
// board, mandatory-capture rules require picking among capture moves only.
// Among captures, the sequence(s) with the maximum number of captured pieces
// must be chosen (international "grand" rule), unless mandatoryJumps=false.
export function getAllMoves(board, color, mandatoryJumps = true) {
  const allCaptures = [];
  const allSimple = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;

      const captureSeqs = findCaptureSequences(board, row, col, piece);
      for (const seq of captureSeqs) {
        allCaptures.push({
          from: { row, col },
          to: seq.to,
          captures: seq.captures,
          chain: seq.chain || [],
          isCapture: true,
        });
      }

      if (captureSeqs.length === 0) {
        const simple = findSimpleMoves(board, row, col, piece);
        for (const mv of simple) {
          allSimple.push({ from: { row, col }, to: mv.to, captures: [], isCapture: false });
        }
      }
    }
  }

  if (allCaptures.length > 0 && mandatoryJumps) {
    const maxCaptures = Math.max(...allCaptures.map((m) => m.captures.length));
    return allCaptures.filter((m) => m.captures.length === maxCaptures);
  }
  if (allCaptures.length > 0) {
    // Mandatory jumps off: any move is legal, captures included.
    return [...allCaptures, ...allSimple];
  }
  return allSimple;
}

export function applyMove(board, move) {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.row][move.from.col];
  newBoard[move.from.row][move.from.col] = null;

  for (const cap of move.captures) {
    newBoard[cap.row][cap.col] = null;
  }

  const promoted =
    !piece.king && (piece.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1);
  newBoard[move.to.row][move.to.col] = { ...piece, king: piece.king || promoted };

  return newBoard;
}

export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

export function countPieces(board) {
  let white = 0;
  let black = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.color === WHITE) white += 1;
      else black += 1;
    }
  }
  return { white, black };
}

// Returns 'white' | 'black' | null (null = game continues)
export function getWinner(board, turn, mandatoryJumps = true) {
  const { white, black } = countPieces(board);
  if (white === 0) return BLACK;
  if (black === 0) return WHITE;
  const movesForTurn = getAllMoves(board, turn, mandatoryJumps);
  if (movesForTurn.length === 0) return opponent(turn);
  return null;
}
