import { getRankTier, getMilestoneBadge } from "../game/rank.js";
import { formatCoins } from "../game/rank.js";
import "./RankBadge.css";

export function RankBadge({ rank = 1000, size = "md" }) {
  const tier = getRankTier(rank);
  return (
    <span
      className={`rank-badge rank-badge--${size} ${tier.fire ? "rank-badge--fire" : ""}`}
      style={{ "--rank-color": tier.color }}
    >
      {tier.fire && <span className="rank-badge__flame">🔥</span>}
      <span className="rank-badge__label">{tier.label}</span>
      <span className="rank-badge__num">#{rank}</span>
    </span>
  );
}

// The "Top 100/50/30/10" milestone trophy title — independent of, and shown
// alongside, the league RankBadge above.
export function MilestoneBadge({ rank, size = "sm" }) {
  const badge = getMilestoneBadge(rank);
  if (!badge) return null;
  return (
    <span className={`milestone-badge milestone-badge--${size}`} style={{ "--milestone-color": badge.color }}>
      🏆 {badge.label}
    </span>
  );
}

export function CoinPill({ coins = 0 }) {
  return (
    <span className="coin-pill">
      <span className="coin-pill__icon">🪙</span>
      {formatCoins(coins)}
    </span>
  );
}
