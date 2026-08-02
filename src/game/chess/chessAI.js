// Chess AI. NOT Stockfish — there's no network access available to fetch a
// real engine binary/wasm here, so this is a genuine from-scratch negamax
// search with alpha-beta pruning, similar in spirit to game/ai.js (the
// Checkers AI) but for chess. It plays a real, legitimately different game
// at each difficulty tier via search depth + move randomization — it will
// not play at Stockfish/grandmaster strength, and callers/UI copy should
// say "Chess AI", not claim a specific named engine.
import { getLegalMoves, applyMove, opponent, isInCheck, WHITE, BLACK } from "./chessLogic.js";

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Small, standard-flavored positional nudges — not claiming
// tournament-grade piece-square tables, just enough to make the AI prefer
// central control, king safety, and piece development over purely random
// material-equal moves. Indexed [row][col] from white's perspective (row 0
// = rank 8); mirrored vertically for black.
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];
const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];
const KING_MIDGAME_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];
const PST = { p: PAWN_PST, n: KNIGHT_PST, b: BISHOP_PST, k: KING_MIDGAME_PST };

function pstValue(type, color, row, col) {
  const table = PST[type];
  if (!table) return 0; // rook/queen: material value carries them, no PST needed for a lightweight eval
  return color === WHITE ? table[row][col] : table[7 - row][col];
}

// Positive = good for `color`.
function evaluate(board, color) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const value = PIECE_VALUE[cell.type] + pstValue(cell.type, cell.color, r, c);
      score += cell.color === color ? value : -value;
    }
  }
  return score;
}

function orderMoves(moves) {
  // Cheap move ordering (captures first, promotions first) — meaningfully
  // improves alpha-beta pruning efficiency for near-zero cost.
  return [...moves].sort((a, b) => {
    const aScore = (a.captured ? PIECE_VALUE[a.captured.type] : 0) + (a.promotion ? 800 : 0);
    const bScore = (b.captured ? PIECE_VALUE[b.captured.type] : 0) + (b.promotion ? 800 : 0);
    return bScore - aScore;
  });
}

function negamax(board, state, color, depth, alpha, beta) {
  const moves = getLegalMoves(board, state.turn, state);
  if (moves.length === 0) {
    // No legal moves: checkmate (very bad/good) or stalemate (neutral).
    return isInCheck(board, state.turn) ? -100000 - depth : 0;
  }
  if (depth === 0) return evaluate(board, color);

  let best = -Infinity;
  for (const move of orderMoves(moves)) {
    const { board: nb, state: ns } = applyMove(board, state, move);
    const score = -negamax(nb, ns, opponent(state.turn), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // alpha-beta cutoff
  }
  return best;
}

const DIFFICULTY = {
  beginner: { depth: 1, blunderChance: 0.5, topN: 5 },
  easy: { depth: 2, blunderChance: 0.3, topN: 4 },
  intermediate: { depth: 3, blunderChance: 0.12, topN: 3 },
  advanced: { depth: 3, blunderChance: 0.04, topN: 2 },
  expert: { depth: 4, blunderChance: 0, topN: 1 },
};

// Picks a move for `color` to play. Returns null if there are no legal
// moves (caller should already know the game is over in that case).
export function getChessAiMove(board, state, color, difficulty = "intermediate") {
  const moves = getLegalMoves(board, color, state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = DIFFICULTY[difficulty] || DIFFICULTY.intermediate;

  const scored = orderMoves(moves).map((move) => {
    const { board: nb, state: ns } = applyMove(board, state, move);
    const score = -negamax(nb, ns, opponent(color), config.depth - 1, -Infinity, Infinity);
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Lower difficulties don't always play their own best move — they pick
  // from a shortlist of their top candidates, weighted toward the best one
  // but with a real chance of a "human-like" imperfect choice, so each
  // level actually feels like a different opponent rather than the same
  // engine with a time limit.
  if (Math.random() < config.blunderChance) {
    const pool = scored.slice(0, Math.min(config.topN + 2, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }
  const pool = scored.slice(0, Math.min(config.topN, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].move;
}

// Shared with the checkers AI's naming convention: a small helper for other
// binary AI choices (e.g. "does the bot accept this draw offer") that scale
// with difficulty — stronger AIs are choosier about accepting draws.
export function chessAiAcceptsDraw(evalScoreForBot, difficulty = "intermediate") {
  // evalScoreForBot: positive means the bot thinks it's winning.
  if (evalScoreForBot <= -200) return true; // losing badly — take the draw
  if (evalScoreForBot >= 150) return false; // winning — decline
  const config = DIFFICULTY[difficulty] || DIFFICULTY.intermediate;
  return Math.random() < 0.5 + config.blunderChance / 2;
}

export function difficultyLabel(difficulty) {
  return (
    { beginner: "Beginner", easy: "Easy", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" }[
      difficulty
    ] || "Intermediate"
  );
}
