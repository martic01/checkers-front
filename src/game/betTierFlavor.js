// Buckets by magnitude so every bet amount gets a consistent icon/quote/glow
// regardless of which exact BET_TIERS value it is. Ordered smallest first;
// first bucket whose `max` the amount is <= wins.
const BUCKETS = [
  { max: 1_000, icon: "🪙", quote: "Just getting started", color: "#8a9a8f" },
  { max: 10_000, icon: "🔥", quote: "Warming up", color: "#c98a4b" },
  { max: 100_000, icon: "⚡", quote: "Getting serious", color: "#d9b34d" },
  { max: 1_000_000, icon: "💎", quote: "High roller", color: "#7cc7ff" },
  { max: 100_000_000, icon: "🐋", quote: "Whale territory", color: "#5f9df7" },
  { max: 1_000_000_000, icon: "👑", quote: "Legendary stakes", color: "#e6b93d" },
  { max: 1_000_000_000_000, icon: "🏛️", quote: "Empire builder", color: "#c9a227" },
  { max: Infinity, icon: "🌌", quote: "Cosmic wealth", color: "#b47cff" },
];

export function getBetFlavor(amount) {
  return BUCKETS.find((b) => amount <= b.max) || BUCKETS[BUCKETS.length - 1];
}
