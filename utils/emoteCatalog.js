// Kept in sync with frontend/src/game/emoteCatalog.js's EMOTE_CATALOG —
// price + category are needed server-side, to validate a purchase.
export const EMOTE_CATALOG = {
  "reg-spark": { price: 100_000_000, category: "regular" },
  "reg-pulse": { price: 250_000_000, category: "regular" },
  "reg-glow": { price: 400_000_000, category: "regular" },

  "pro-comet": { price: 400_000_000, category: "pro" },
  "pro-aurora": { price: 1_000_000_000, category: "pro" },
  "pro-nova": { price: 2_000_000_000, category: "pro" },

  "exp-blaze": { price: 3_000_000_000, category: "expert" },
  "exp-storm": { price: 15_000_000_000, category: "expert" },
  "exp-eclipse": { price: 40_000_000_000, category: "expert" },

  "prem-royal": { price: 43_000_000_000, category: "premium" },
  "prem-inferno": { price: 70_000_000_000, category: "premium" },
  "prem-celestial": { price: 100_000_000_000, category: "premium" },

  "epic-sovereign": { price: 120_000_000_000, category: "epic" },
  "epic-mythic": { price: 500_000_000_000, category: "epic" },
  "epic-phoenix": { price: 700_000_000_000, category: "epic" },
  "epic-voidwalker": { price: 900_000_000_000, category: "epic" },
  "epic-titan": { price: 1_200_000_000_000, category: "epic" },
  "epic-godspeed": { price: 1_500_000_000_000, category: "epic" },
};

// Backwards-compatible flat price map (still used anywhere that only
// needs the price, e.g. display code).
export const EMOTE_PRICES = Object.fromEntries(
  Object.entries(EMOTE_CATALOG).map(([id, e]) => [id, e.price])
);

// Purchasing certain tiers is restricted to a player's current rank
// (lower rank number = better). A category not listed here has no rank
// requirement — anyone who can afford it can buy it.
export const EMOTE_RANK_REQUIREMENTS = {
  pro: 800,
  premium: 500,
  epic: 300,
};
