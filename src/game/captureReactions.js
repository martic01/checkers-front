// Pure decision logic for the capture-reaction emote system. No React, no
// timers, no piece objects, no board — just "given how many pieces this one
// capture sequence has taken so far, what reaction (if any) should the
// capturing piece show?"
//
// Deliberately kept this dependency-free so it's trivial to verify against
// the spec table below by inspection, and so it is *structurally*
// impossible for anything else — king promotion, re-renders, selection,
// turn changes, whose turn it is, online vs local, any of it — to
// influence the answer. It only ever sees a plain integer.
//
//   capturesSoFar : 1  -> null    (no special reaction)
//   capturesSoFar : 2  -> "cool"
//   capturesSoFar : 3+ -> "fire"  (caller separately triggers "scared" on
//                                  every surviving opponent piece when this
//                                  returns "fire" — that's a rendering
//                                  decision, not this function's job)
export function decideCaptureReaction(capturesSoFar) {
  if (capturesSoFar === 2) return "cool";
  if (capturesSoFar >= 3) return "fire";
  return null;
}

// Roughly matches the requested durations. "scared" is only ever triggered
// alongside "fire" (see useCaptureReactions.recordCapture), never on its
// own.
export const REACTION_DURATION_MS = {
  cool: 3000,
  fire: 5000,
  scared: 2000,
};
