// Entry emotes play at the center of the board right as a match starts.
// Two independent sources of emotes:
//  1) Purchasable catalog — bought with coins, price tier controls how much
//     profile info shows and how long it plays.
//  2) Rank emotes — free, automatically available to whoever currently
//     holds rank 1-10, content scales with how close to #1 they are.
// A player can own several purchased emotes and equips exactly one at a
// time; if they're currently top-10, their rank emote is offered as an
// equip option too (but a purchased equip choice always wins if set).

// Categories requiring a certain live rank (lower number = better) to
// purchase from — keeps the flashiest emotes exclusive to top players.
// A category not listed here has no rank requirement.
export const EMOTE_RANK_REQUIREMENTS = {
  pro: 800,
  premium: 500,
  epic: 300,
};

export const EMOTE_CATEGORIES = [
  {
    id: "regular",
    label: "Regular",
    minPrice: 100_000_000,
    maxPrice: 400_000_000,
    maxDurationS: 4,
    content: [], // no profile info, just a light-up effect
    glow: "#8fd8d2",
    intensity: 1,
  },
  {
    id: "pro",
    label: "Pro",
    minPrice: 400_000_000,
    maxPrice: 2_000_000_000,
    maxDurationS: 4,
    content: [], // no profile info, a nicer light-up effect
    glow: "#7cc7ff",
    intensity: 1.3,
  },
  {
    id: "expert",
    label: "Expert",
    minPrice: 3_000_000_000,
    maxPrice: 40_000_000_000,
    maxDurationS: 4,
    content: ["name"],
    glow: "#c77dff",
    intensity: 1.7,
  },
  {
    id: "premium",
    label: "Premium",
    minPrice: 43_000_000_000,
    maxPrice: 100_000_000_000,
    maxDurationS: 6,
    content: ["name", "wins"],
    glow: "#e6b93d",
    intensity: 2.2,
  },
  {
    id: "epic",
    label: "Epic",
    minPrice: 120_000_000_000,
    maxPrice: Infinity,
    maxDurationS: 10,
    content: ["name", "quote", "pic", "wins", "streak"],
    glow: "#ff6a2e",
    intensity: 3,
  },
];

export function getEmoteCategory(id) {
  return EMOTE_CATEGORIES.find((c) => c.id === id) || null;
}

// The purchasable catalog itself — a handful of concrete emotes per
// category (not fully open-ended), each with its own price within the
// category's range and a distinct visual flavor.
export const EMOTE_CATALOG = [
  { id: "reg-spark", category: "regular", name: "Spark", price: 100_000_000, effect: "spark" },
  { id: "reg-pulse", category: "regular", name: "Pulse", price: 250_000_000, effect: "pulse" },
  { id: "reg-glow", category: "regular", name: "Glow", price: 400_000_000, effect: "aurora" },

  { id: "pro-comet", category: "pro", name: "Comet", price: 400_000_000, effect: "comet" },
  { id: "pro-aurora", category: "pro", name: "Aurora", price: 1_000_000_000, effect: "aurora" },
  { id: "pro-nova", category: "pro", name: "Nova", price: 2_000_000_000, effect: "nova" },

  { id: "exp-blaze", category: "expert", name: "Blaze", price: 3_000_000_000, effect: "blaze" },
  { id: "exp-storm", category: "expert", name: "Storm", price: 15_000_000_000, effect: "storm" },
  { id: "exp-eclipse", category: "expert", name: "Eclipse", price: 40_000_000_000, effect: "eclipse" },

  { id: "prem-royal", category: "premium", name: "Royal Entrance", price: 43_000_000_000, effect: "royal" },
  { id: "prem-inferno", category: "premium", name: "Inferno", price: 70_000_000_000, effect: "inferno" },
  { id: "prem-celestial", category: "premium", name: "Celestial", price: 100_000_000_000, effect: "celestial" },

  { id: "epic-sovereign", category: "epic", name: "Sovereign's Arrival", price: 120_000_000_000, effect: "sovereign" },
  { id: "epic-mythic", category: "epic", name: "Mythic Ascension", price: 500_000_000_000, effect: "mythic" },
  { id: "epic-phoenix", category: "epic", name: "Phoenix Rebirth", price: 700_000_000_000, effect: "phoenix" },
  { id: "epic-voidwalker", category: "epic", name: "Voidwalker", price: 900_000_000_000, effect: "voidwalker" },
  { id: "epic-titan", category: "epic", name: "Titanfall", price: 1_200_000_000_000, effect: "titan" },
  { id: "epic-godspeed", category: "epic", name: "Godspeed", price: 1_500_000_000_000, effect: "godspeed" },
];

// Free milestone emotes tied to a player's *lifetime* earnings — kicks in
// once someone has earned into the millions, and gets flashier at each
// higher bracket. This is a fallback layer: it only plays if the player
// has no purchased emote equipped and isn't currently top-10 (rank emotes
// still take priority, since those are rarer to hold).
const EARNINGS_MILESTONES = [
  { min: 1_000_000, id: "earn-rising", content: ["name"], glow: "#8fd8d2", intensity: 1, effect: "spark" },
  { min: 50_000_000, id: "earn-climbing", content: ["name"], glow: "#7cc7ff", intensity: 1.3, effect: "comet" },
  { min: 500_000_000, id: "earn-veteran", content: ["name", "wins"], glow: "#c77dff", intensity: 1.7, effect: "aurora" },
  { min: 5_000_000_000, id: "earn-elite", content: ["name", "wins"], glow: "#e6b93d", intensity: 2.2, effect: "royal" },
  { min: 50_000_000_000, id: "earn-legend", content: ["name", "wins", "streak"], glow: "#ff6a2e", intensity: 2.6, effect: "nova" },
];

export function getEarningsEmote(totalEarnings) {
  let matched = null;
  for (const tier of EARNINGS_MILESTONES) {
    if (totalEarnings >= tier.min) matched = tier;
  }
  if (!matched) return null;
  return { ...matched, maxDurationS: 5, category: "earnings" };
}

export function getEmote(id) {
  return EMOTE_CATALOG.find((e) => e.id === id) || null;
}

// Free rank-based emotes, for whoever currently holds rank 1-10. Not owned
// like purchased emotes — availability follows the player's live rank.
export function getRankEmote(rank) {
  if (rank === 1) {
    return { id: "rank-1", rank: 1, content: ["name", "quote", "pic", "wins", "streak", "rank"], maxDurationS: 6, glow: "#ff6a2e", fire: true, effect: "mythic", intensity: 3 };
  }
  if (rank === 2 || rank === 3) {
    return { id: "rank-2-3", rank, content: ["name", "rank", "pic"], maxDurationS: 6, glow: "#ff5c8a", effect: "royal", intensity: 2.2 };
  }
  if (rank >= 4 && rank <= 10) {
    return { id: "rank-4-10", rank, content: ["name", "rank"], maxDurationS: 6, glow: "#d9b34d", effect: "pulse", intensity: 1.7 };
  }
  return null;
}

// Resolves which emote actually plays for a given player, in priority
// order: their equipped purchased emote, else their rank emote if they
// qualify (top 10), else a milestone emote matching their lifetime
// earnings, else null (no entry emote — just enter the match normally).
export function resolveEquippedEmote({ equippedEmoteId, rank, totalEarnings = 0 }) {
  if (equippedEmoteId) {
    const purchased = getEmote(equippedEmoteId);
    if (purchased) {
      const cat = getEmoteCategory(purchased.category);
      return {
        source: "purchased",
        id: purchased.id,
        name: purchased.name,
        category: purchased.category,
        effect: purchased.effect,
        intensity: cat.intensity,
        content: cat.content,
        maxDurationS: cat.maxDurationS,
        glow: cat.glow,
      };
    }
  }
  const rankEmote = getRankEmote(rank);
  if (rankEmote) {
    return {
      source: "rank",
      id: rankEmote.id,
      name: null,
      category: "rank",
      effect: rankEmote.effect,
      intensity: rankEmote.intensity,
      content: rankEmote.content,
      maxDurationS: rankEmote.maxDurationS,
      glow: rankEmote.glow,
      fire: rankEmote.fire,
    };
  }
  const earningsEmote = getEarningsEmote(totalEarnings);
  if (earningsEmote) {
    return {
      source: "earnings",
      id: earningsEmote.id,
      name: null,
      category: earningsEmote.category,
      effect: earningsEmote.effect,
      intensity: earningsEmote.intensity,
      content: earningsEmote.content,
      maxDurationS: earningsEmote.maxDurationS,
      glow: earningsEmote.glow,
    };
  }
  return null;
}
