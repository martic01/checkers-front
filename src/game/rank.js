export const RANK_TIERS = [
  { max: 49, label: "Legend", color: "#ff5c8a" },
  { max: 149, label: "Master", color: "#c77dff" },
  { max: 299, label: "Diamond", color: "#7cc7ff" },
  { max: 499, label: "Platinum", color: "#8fd8d2" },
  { max: 699, label: "Gold", color: "#d9b34d" },
  { max: 899, label: "Silver", color: "#b9c2c9" },
  { max: 1000, label: "Bronze", color: "#a5673f" },
];

export function getRankTier(rank = 1000) {
  return RANK_TIERS.find((t) => rank <= t.max) || RANK_TIERS[RANK_TIERS.length - 1];
}

export const BET_TIERS = [
  100, 200, 500, 1500, 3000, 5000, 10000, 20000, 40000, 80000, 100000, 300000,
  500000, 1000000, 4000000, 10000000, 30000000, 50000000, 100000000, 400000000,
  600000000, 800000000, 1000000000, 5000000000, 10000000000, 30000000000,
  60000000000, 100000000000,
];

export function getUnlockThreshold(tierIndex) {
  if (tierIndex < 3) return 0;
  return BET_TIERS[tierIndex] * 5;
}

export function isTierUnlocked(tier, totalEarnings = 0) {
  const idx = BET_TIERS.indexOf(tier);
  if (idx === -1) return false;
  return totalEarnings >= getUnlockThreshold(idx);
}

export function formatCoins(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

// Full, comma-grouped amount (e.g. 1000000 -> "1,000,000") for contexts where
// the exact figure should read clearly rather than being abbreviated —
// confirmation messages, win/loss deltas, challenge/rematch offers.
export function formatCoinsFull(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}
