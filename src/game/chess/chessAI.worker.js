// Runs chess AI search off the main thread entirely, so a slow "expert"
// search never freezes board interaction, animations, or the rest of the
// app while it thinks. chessLogic.js/chessAI.js are already pure (no DOM,
// no React) so they need zero changes to run inside a worker.
import { getChessAiMove } from "./chessAI.js";

self.onmessage = (e) => {
  const { board, state, color, difficulty, requestId } = e.data;
  const move = getChessAiMove(board, state, color, difficulty);
  self.postMessage({ move, requestId });
};
