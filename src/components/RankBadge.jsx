import { getRankTier } from "../game/rank.js";
import { formatCoins } from "../game/rank.js";
import "./RankBadge.css";

export function RankBadge({ rank = 1000, size = "md" }) {
  const tier = getRankTier(rank);
  return (
    <span className={`rank-badge rank-badge--${size}`} style={{ "--rank-color": tier.color }}>
      <span className="rank-badge__label">{tier.label}</span>
      <span className="rank-badge__num">#{rank}</span>
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
