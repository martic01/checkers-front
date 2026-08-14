// Chess AI. NOT Stockfish — there's no network access available to fetch a
// real engine binary/wasm here, so this is a genuine from-scratch negamax
// search with alpha-beta pruning, similar in spirit to game/ai.js (the
// Checkers AI) but for chess. It plays a real, legitimately different game
// at each difficulty tier via search depth + move randomization — it will
// not play at Stockfish/grandmaster strength, and callers/UI copy should
// say "Chess AI", not claim a specific named engine.
import { getLegalMoves, applyMove, opponent, isInCheck, WHITE, BLACK } from "./chessLogic.js";

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Standard "simplified evaluation function" piece-square tables (the
// Tomasz Michniewski set, widely used as a lightweight-but-real starting
// point for these) — full coverage for all six piece types, not just
// pawns/knights/bishops/king. Indexed [row][col] from White's perspective
// (row 0 = rank 8); mirrored vertically for Black. Rook and Queen were
// previously skipped ("material value carries them") — they're now
// included too, since a real evaluation should reward rooks on open/7th
// rank files and queens staying out of early trouble.
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
const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];
const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];
// King safety matters in the middlegame (stay tucked behind pawns) but
// inverts in the endgame (an active, centralized king is an asset once
// there's no attack to hide from) — two tables, blended by game phase in
// evaluate() below via a cheap non-pawn-material check.
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
const KING_ENDGAME_PST = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];
const PST = { p: PAWN_PST, n: KNIGHT_PST, b: BISHOP_PST, r: ROOK_PST, q: QUEEN_PST };

// Combined non-pawn material (both sides, in centipawns) at or below which
// the position counts as an endgame for king-table purposes — roughly
// "queens are off, or most other pieces have been traded".
const ENDGAME_MATERIAL_THRESHOLD = 3200;

function pstValue(type, color, row, col) {
  const table = PST[type];
  if (!table) return 0; // king handled separately in evaluate() — it needs the game-phase table, not a fixed one
  return color === WHITE ? table[row][col] : table[7 - row][col];
}

// Positive = good for `color`. Single board pass: kings are scored last
// once the game phase (mid vs endgame) is known from the non-pawn
// material tally, rather than re-scanning the board a second time.
export function evaluate(board, color) {
  let score = 0;
  let nonPawnMaterial = 0;
  let whiteKing = null;
  let blackKing = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      if (cell.type === "k") {
        if (cell.color === WHITE) whiteKing = { r, c };
        else blackKing = { r, c };
        continue;
      }
      const value = PIECE_VALUE[cell.type] + pstValue(cell.type, cell.color, r, c);
      score += cell.color === color ? value : -value;
      if (cell.type !== "p") nonPawnMaterial += PIECE_VALUE[cell.type];
    }
  }

  const kingTable = nonPawnMaterial <= ENDGAME_MATERIAL_THRESHOLD ? KING_ENDGAME_PST : KING_MIDGAME_PST;
  if (whiteKing) {
    const value = kingTable[whiteKing.r][whiteKing.c];
    score += color === WHITE ? value : -value;
  }
  if (blackKing) {
    const value = kingTable[7 - blackKing.r][blackKing.c];
    score += color === BLACK ? value : -value;
  }

  return score;
}

// MVV-LVA (Most Valuable Victim, Least Valuable Attacker) for captures —
// victim value dominates the sort (so "queen takes pawn" never outranks
// "pawn takes queen"), attacker value breaks ties among captures of the
// same victim. Promotions and checks are also pushed to the front — all
// three are the checks a strong player looks at first, and trying them
// first is what makes alpha-beta pruning actually earn its keep. Needs
// `board`/`state` (not just the move list) to look up the attacking piece
// and to test for check.
function orderMoves(moves, board, state) {
  const scored = moves.map((move) => {
    let priority = 0;
    if (move.captured) {
      const attacker = board[move.from.row][move.from.col];
      priority += PIECE_VALUE[move.captured.type] * 10 - PIECE_VALUE[attacker.type];
    }
    if (move.promotion) priority += 900;
    const { board: nb } = applyMove(board, state, move);
    if (isInCheck(nb, opponent(state.turn))) priority += 500;
    return { move, priority };
  });
  scored.sort((a, b) => b.priority - a.priority);
  return scored.map((s) => s.move);
}

class SearchTimeout extends Error {}

function negamax(board, state, color, depth, alpha, beta, deadline, nodeCount) {
  nodeCount.n += 1;
  if ((nodeCount.n & 1023) === 0 && Date.now() >= deadline) throw new SearchTimeout();

  const moves = getLegalMoves(board, state.turn, state);
  if (moves.length === 0) {
    // No legal moves: checkmate (very bad/good) or stalemate (neutral).
    return isInCheck(board, state.turn) ? -100000 - depth : 0;
  }
  if (depth === 0) return evaluate(board, color);

  let best = -Infinity;
  for (const move of orderMoves(moves, board, state)) {
    const { board: nb, state: ns } = applyMove(board, state, move);
    const score = -negamax(nb, ns, opponent(state.turn), depth - 1, -beta, -alpha, deadline, nodeCount);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // alpha-beta cutoff
  }
  return best;
}

const DIFFICULTY = {
  beginner: { depth: 1, blunderChance: 0.5, topN: 5, timeBudgetMs: 300 },
  easy: { depth: 2, blunderChance: 0.3, topN: 4, timeBudgetMs: 600 },
  intermediate: { depth: 3, blunderChance: 0.12, topN: 3, timeBudgetMs: 1200 },
  advanced: { depth: 4, blunderChance: 0.04, topN: 2, timeBudgetMs: 1800 },
  expert: { depth: 6, blunderChance: 0, topN: 1, timeBudgetMs: 2800 },
};

// Searches iteratively deepening from depth 1 up to config.depth, always
// keeping the last FULLY completed depth's result. A hard wall-clock
// budget means a slow position can never make the search run away — worst
// case, it falls back to whatever depth it managed to finish, rather than
// hanging indefinitely (this matters even more now that "expert" reaches
// depth 6: without a bound, a deep search on an open, tactical position
// could otherwise take much longer than any UI — or, for the server-side
// bot, any concurrent player — should ever have to wait).
function searchBestMove(board, state, color, config) {
  const moves = getLegalMoves(board, color, state);
  const deadline = Date.now() + config.timeBudgetMs;
  const nodeCount = { n: 0 };

  let lastCompleted = null;
  for (let depth = 1; depth <= config.depth; depth++) {
    try {
      const scored = orderMoves(moves, board, state).map((move) => {
        const { board: nb, state: ns } = applyMove(board, state, move);
        const score = -negamax(nb, ns, opponent(color), depth - 1, -Infinity, Infinity, deadline, nodeCount);
        return { move, score };
      });
      scored.sort((a, b) => b.score - a.score);
      lastCompleted = scored;
      if (Date.now() >= deadline) break;
    } catch (err) {
      if (err instanceof SearchTimeout) break; // keep lastCompleted from the previous finished depth
      throw err;
    }
  }
  // Depth 1 should realistically always finish inside its own budget, but
  // if it somehow didn't even start, fall back to a flat one-ply score
  // rather than ever returning nothing.
  if (!lastCompleted) {
    lastCompleted = moves
      .map((move) => {
        const { board: nb } = applyMove(board, state, move);
        return { move, score: -evaluate(nb, opponent(color)) };
      })
      .sort((a, b) => b.score - a.score);
  }
  return lastCompleted;
}

// Picks a move for `color` to play. Returns null if there are no legal
// moves (caller should already know the game is over in that case).
export function getChessAiMove(board, state, color, difficulty = "intermediate") {
  const moves = getLegalMoves(board, color, state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = DIFFICULTY[difficulty] || DIFFICULTY.intermediate;
  const scored = searchBestMove(board, state, color, config);

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
