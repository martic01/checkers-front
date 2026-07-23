import { formatCoins } from "../game/rank.js";
import { getBetFlavor } from "../game/betTierFlavor.js";
import "./BetTierGrid.css";

// isLocked(tier) => boolean, optional — when omitted, no tiers show as locked.
export default function BetTierGrid({ tiers, selected, onSelect, isLocked }) {
  return (
    <div className="bet-grid">
      {tiers.map((tier) => {
        const flavor = getBetFlavor(tier);
        const locked = isLocked?.(tier) ?? false;
        return (
          <button
            key={tier}
            className={`bet-card ${selected === tier ? "bet-card--selected" : ""} ${locked ? "bet-card--locked" : ""}`}
            style={{ "--bet-glow": flavor.color }}
            disabled={locked}
            onClick={() => onSelect(tier)}
          >
            {locked && <span className="bet-card__lock">🔒</span>}
            <span className="bet-card__icon">{flavor.icon}</span>
            <span className="bet-card__amount">{formatCoins(tier)}</span>
            <span className="bet-card__quote">{flavor.quote}</span>
          </button>
        );
      })}
    </div>
  );
}
