// Coin bet tiers a player can play online matches for. Only the first three
// are unlocked by default; the rest unlock as lifetime coin earnings grow.
export const BET_TIERS = [
  100, 200, 500, 1500, 3000, 5000, 10000, 20000, 40000, 80000, 100000, 300000,
  500000, 1000000, 4000000, 10000000, 30000000, 50000000, 100000000, 400000000,
  600000000, 800000000, 1000000000, 5000000000, 10000000000, 30000000000,
  60000000000, 100000000000, 300000000000, 500000000000, 1000000000000,
  5000000000000, 10000000000000, 50000000000000, 100000000000000,
  500000000000000, 1000000000000000,
];

// A tier unlocks once lifetime earnings reach 5x its stake. The first three
// tiers are always open so every new player can start playing immediately.
export function getUnlockThreshold(tierIndex) {
  if (tierIndex < 3) return 0;
  return BET_TIERS[tierIndex] * 5;
}

export function getUnlockedTiers(totalEarnings = 0) {
  return BET_TIERS.filter((_, i) => totalEarnings >= getUnlockThreshold(i));
}

export function isTierUnlocked(tier, totalEarnings = 0) {
  const idx = BET_TIERS.indexOf(tier);
  if (idx === -1) return false;
  return totalEarnings >= getUnlockThreshold(idx);
}

export const DAILY_BONUS_COINS = 200;
export const STARTING_COINS = 1000;

// Rank ladder: 1 is the best possible rank, 1000 is where everyone starts.
export const RANK_MIN = 1;
export const RANK_MAX = 1000;

export function computeRank(exp = 0) {
  const rank = RANK_MAX - Math.floor(exp / 15);
  return Math.min(RANK_MAX, Math.max(RANK_MIN, rank));
}

export const WIN_EXP = 25;
export const LOSS_EXP = 6;
export const DRAW_EXP = 12;

export const WIN_MOJO = 10;
export const LOSS_MOJO = 3;
export const DRAW_MOJO = 5;

// Rank badges recolor at these major milestones.
export const RANK_TIERS = [
  { max: 1, label: "Eternal Sovereign", color: "#ff6a2e", fire: true },
  { max: 2, label: "Ascendant", color: "#ff5c8a" },
  { max: 3, label: "Paragon", color: "#ff5c8a" },
  { max: 49, label: "Legend", color: "#ff5c8a", glow: "#ffd166" },
  { max: 149, label: "Master", color: "#c77dff" },
  { max: 299, label: "Diamond", color: "#7cc7ff" },
  { max: 499, label: "Platinum", color: "#8fd8d2" },
  { max: 699, label: "Gold", color: "#d9b34d" },
  { max: 899, label: "Silver", color: "#b9c2c9" },
  { max: 1000, label: "Bronze", color: "#a5673f" },
];

export function getRankTier(rank) {
  return RANK_TIERS.find((t) => rank <= t.max) || RANK_TIERS[RANK_TIERS.length - 1];
}
