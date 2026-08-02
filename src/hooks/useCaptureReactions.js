import { useCallback, useRef, useState } from "react";
import { decideCaptureReaction, REACTION_DURATION_MS } from "../game/captureReactions.js";

// Dedicated, self-contained state for the capture-reaction emote overlay
// (🔥 / 😎 / 😨). This is intentionally its own module: the game engine
// (checkersLogic.js), king promotion, turn handling, and move animation in
// GameScreen.jsx know nothing about this and never need to — they just
// report "this piece captured, here's the running count" once per capture,
// and this hook is the only thing that decides what (if anything) to show
// and for how long. It never reads board/pieces/turn/king state and never
// writes to it — the only thing it produces is a plain
// { [pieceId]: "cool" | "fire" | "scared" } map for Board.jsx to render.
export function useCaptureReactions() {
  const [pieceReactions, setPieceReactions] = useState({});

  // The "unique capture event id" the reaction system runs on. Global,
  // monotonically increasing, bumped once per triggered reaction — never
  // reset, never reused. Every timer that later clears a reaction checks
  // this before doing anything, which is what makes ALL of the following
  // safe by construction, not by convention:
  //   - a stale timer can never clear a newer reaction on the same piece
  //   - the same reaction type firing again (e.g. "fire" on capture #4
  //     right after capture #3) still counts as a brand new event, so its
  //     visible duration correctly restarts instead of expiring early
  //   - board re-renders, selection changes, or turn changes can't touch
  //     this at all — nothing here reads any of that
  const nextEventId = useRef(1);
  const activeEventIdByPiece = useRef(new Map());

  const clearAfterDelay = useCallback((pieceId, eventId, ms) => {
    setTimeout(() => {
      if (activeEventIdByPiece.current.get(pieceId) !== eventId) return; // superseded by a newer reaction
      setPieceReactions((prev) => {
        if (!(pieceId in prev)) return prev;
        const next = { ...prev };
        delete next[pieceId];
        return next;
      });
    }, ms);
  }, []);

  const show = useCallback(
    (pieceId, type) => {
      if (!pieceId) return;
      const eventId = nextEventId.current++;
      activeEventIdByPiece.current.set(pieceId, eventId);
      setPieceReactions((prev) => ({ ...prev, [pieceId]: type }));
      clearAfterDelay(pieceId, eventId, REACTION_DURATION_MS[type]);
    },
    [clearAfterDelay]
  );

  // The single entry point the game calls. Call this exactly once per
  // successful capture — i.e. once per hop of a multi-jump that actually
  // removed an opponent piece, never for a non-capturing move and never
  // twice for the same capture.
  //
  //   capturingPieceId     the piece that made this capture (its id never
  //                        changes across a multi-jump, even through a
  //                        king promotion, so the reaction always finds
  //                        the right piece wherever it currently is)
  //   capturesSoFar        how many pieces THIS move has captured so far,
  //                        including this one (1, 2, 3, 4, ...) — nothing
  //                        about king status is passed in here on purpose
  //   survivingOpponentIds every opponent piece id still on the board
  //                        right now; only consulted when this capture
  //                        crosses the fire threshold
  const recordCapture = useCallback(
    (capturingPieceId, capturesSoFar, survivingOpponentIds = []) => {
      const type = decideCaptureReaction(capturesSoFar);
      if (!type) return; // capture #1: no reaction, by design
      show(capturingPieceId, type);
      if (type === "fire") {
        for (const oppId of survivingOpponentIds) show(oppId, "scared");
      }
    },
    [show]
  );

  const resetReactions = useCallback(() => {
    setPieceReactions({});
  }, []);

  return { pieceReactions, recordCapture, resetReactions };
}
