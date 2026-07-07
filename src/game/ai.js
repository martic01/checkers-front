import { getAllMoves, applyMove, opponent, WHITE, BLACK } from "./checkersLogic.js";

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

export function getAiMove(board, aiColor, difficulty = "medium", mandatoryJumps = true) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const moves = getAllMoves(board, aiColor, mandatoryJumps);
  if (moves.length === 0) return null;

  if (Math.random() < config.randomness) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const { move } = minimax(board, config.depth, -Infinity, Infinity, true, aiColor, mandatoryJumps);
  return move || moves[0];
}

export const DIFFICULTIES = Object.keys(DIFFICULTY_CONFIG);
