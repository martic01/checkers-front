// Official-style time controls, shared by Chess and Checkers. Each tier is
// base time (per player, in seconds) plus a per-move increment added AFTER
// the move that used it — the standard Fischer-increment chess-clock
// pattern, matching the source table's own numbers:
//
//   Chess:    Blitz 3min+2s | Rapid 15min+10s | Classical 90min(+30min after
//             move 40, approximated below as a flat bank)+30s from move 1
//   Checkers: Blitz 5min+3s | Rapid 15min+5s  | Classical 80min+1min (Fischer)
//
// Classical chess's real FIDE control has a move-40 time bonus, which this
// simplified single-phase version approximates as one flat base bank
// (90+30=120 min) rather than modeling the two-phase bonus — a deliberate,
// disclosed simplification; the increment-from-move-1 behavior is exact.
export const TIME_CONTROLS = {
  chess: {
    blitz: { key: "blitz", label: "Blitz", baseSeconds: 3 * 60, incrementSeconds: 2 },
    rapid: { key: "rapid", label: "Rapid", baseSeconds: 15 * 60, incrementSeconds: 10 },
    classical: { key: "classical", label: "Classical", baseSeconds: 120 * 60, incrementSeconds: 30 },
  },
  checkers: {
    blitz: { key: "blitz", label: "Blitz", baseSeconds: 5 * 60, incrementSeconds: 3 },
    rapid: { key: "rapid", label: "Rapid", baseSeconds: 15 * 60, incrementSeconds: 5 },
    classical: { key: "classical", label: "Classical", baseSeconds: 80 * 60, incrementSeconds: 60 },
  },
};

// Bet-tier thresholds: lower stakes get faster games, higher stakes get the
// full classical control — casual/cheap games shouldn't take hours, and a
// serious high-stakes match gets room to actually think.
const BLITZ_MAX_BET = 1500; // covers the entry tiers (100, 200, 500, 1500)
const RAPID_MAX_BET = 100000;

export function getTimeControlForBet(game, betAmount = 0) {
  const tiers = TIME_CONTROLS[game] || TIME_CONTROLS.chess;
  if (betAmount <= BLITZ_MAX_BET) return tiers.blitz;
  if (betAmount <= RAPID_MAX_BET) return tiers.rapid;
  return tiers.classical;
}

export function getTimeControl(game, key) {
  return (TIME_CONTROLS[game] || TIME_CONTROLS.chess)[key] || TIME_CONTROLS[game]?.rapid;
}

export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
