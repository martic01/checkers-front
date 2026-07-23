export const RANK_TIERS = [
  { max: 1, label: "Eternal Sovereign", color: "#ff6a2e", fire: true },
  { max: 2, label: "Ascendant", color: "#ff5c8a" },
  { max: 3, label: "Paragon", color: "#ff5c8a" },
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

// Independent of league color/name — an extra trophy title for being ranked
// in the numeric top 100/50/30/10 globally, on top of whichever league tier
// that rank also falls in.
export const MILESTONE_BADGES = [
  { max: 10, label: "Top 10", color: "#ff5c8a" },
  { max: 30, label: "Top 30", color: "#ffb454" },
  { max: 50, label: "Top 50", color: "#d9b34d" },
  { max: 100, label: "Top 100", color: "#8fd8d2" },
];

export function getMilestoneBadge(rank) {
  return MILESTONE_BADGES.find((b) => rank <= b.max) || null;
}

export const BET_TIERS = [
  100, 200, 500, 1500, 3000, 5000, 10000, 20000, 40000, 80000, 100000, 300000,
  500000, 1000000, 4000000, 10000000, 30000000, 50000000, 100000000, 400000000,
  600000000, 800000000, 1000000000, 5000000000, 10000000000, 30000000000,
  60000000000, 100000000000, 300000000000, 500000000000, 1000000000000,
  5000000000000, 10000000000000, 50000000000000, 100000000000000,
  500000000000000, 1000000000000000,
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
  if (n >= 1_000_000_000_000_000) return `${(n / 1_000_000_000_000_000).toFixed(n % 1_000_000_000_000_000 === 0 ? 0 : 1)}Qa`;
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(n % 1_000_000_000_000 === 0 ? 0 : 1)}T`;
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
