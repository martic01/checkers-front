import { getAllMoves, applyMove, opponent, WHITE, BLACK, boardPositionKey } from "./checkersLogic.js";

// Difficulty -> search depth + randomness factor.
const DIFFICULTY_CONFIG = {
  beginner: { depth: 1, randomness: 0.6 },
  easy: { depth: 2, randomness: 0.35 },
  medium: { depth: 3, randomness: 0.15 },
  hard: { depth: 4, randomness: 0.05 },
  expert: { depth: 5, randomness: 0 },
};

function evaluateBoard(board, aiColor) {
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const value = cell.king ? 3 : 1;
      score += cell.color === aiColor ? value : -value;
    }
  }
  return score;
}

function minimax(board, depth, alpha, beta, maximizing, aiColor, mandatoryJumps) {
  const currentColor = maximizing ? aiColor : opponent(aiColor);
  const moves = getAllMoves(board, currentColor, mandatoryJumps);

  if (depth === 0 || moves.length === 0) {
    return { score: evaluateBoard(board, aiColor), move: null };
  }

  let bestMove = moves[0];

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMove(board, move);
      const { score } = minimax(next, depth - 1, alpha, beta, false, aiColor, mandatoryJumps);
      if (score > best) {
        best = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  } else {
    let best = Infinity;
    for (const move of moves) {
      const next = applyMove(board, move);
      const { score } = minimax(next, depth - 1, alpha, beta, true, aiColor, mandatoryJumps);
      if (score < best) {
        best = score;
        bestMove = move;
      }
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  }
}

// `recentPositionCounts` (optional) is the same position-tracking map the
// draw-detection tracker keeps, keyed by boardPositionKey. When supplied,
// the AI avoids steering into a position it has already repeated when an
// equally good alternative move exists — otherwise two AIs (or an AI stuck
// in a dead-drawn endgame) can shuffle back and forth indefinitely instead
// of letting the 3-fold-repetition draw rule end the match promptly.
export function getAiMove(board, aiColor, difficulty = "medium", mandatoryJumps = true, recentPositionCounts = null) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const moves = getAllMoves(board, aiColor, mandatoryJumps);
  if (moves.length === 0) return null;

  if (Math.random() < config.randomness) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (!recentPositionCounts || moves.length === 1) {
    const { move } = minimax(board, config.depth, -Infinity, Infinity, true, aiColor, mandatoryJumps);
    return move || moves[0];
  }

  const scored = moves.map((move) => {
    const next = applyMove(board, move);
    const { score } = minimax(next, config.depth - 1, -Infinity, Infinity, false, aiColor, mandatoryJumps);
    const key = boardPositionKey(next, opponent(aiColor));
    return { move, score, seenCount: recentPositionCounts[key] || 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;
  const fresh = scored.filter((s) => s.score >= bestScore - 0.5 && s.seenCount === 0);
  const pool = fresh.length > 0 ? fresh : scored;
  return pool[0].move;
}

// A "bot" opponent's answer to any yes/no social question it can't really
// have an opinion on — accepting a draw offer, agreeing to a rematch, etc.
// Deliberately not based on board evaluation: the person asked for this to
// be a coin flip, not the AI calculating whether it's actually losing.
export function aiRandomDecision(probability = 0.5) {
  return Math.random() < probability;
}

export const DIFFICULTIES = Object.keys(DIFFICULTY_CONFIG);
