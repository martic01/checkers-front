import { RANK_TIERS, getRankTier } from "./economy.js";

// Must stay in sync with frontend/src/game/trophyCatalog.js (ids + rough
// difficulty of earning each one). Duplicated here rather than imported
// across the frontend/backend boundary to keep the two deployable
// independently.
const TROPHY_IDS = [
  "first-win",
  "five-wins",
  "streak-3",
  "twentyfive-wins",
  "veteran",
  "coin-1k",
  "streak-10",
  "hundred-wins",
  "coin-100k",
  "coin-1m",
  "coin-1b",
];

// Every skill tier lines up 1:1 with the app's existing league ladder
// (RANK_TIERS) so a bot's "league" is never something a real player
// couldn't also have — that's what keeps the profile indistinguishable
// from a real one. aiDifficulty maps to frontend/src/game/ai.js's
// DIFFICULTY_CONFIG keys, which is what actually drives its moves.
export const SKILL_TIERS = [
  { id: "beginner", label: "Beginner", aiDifficulty: "beginner", rankRange: [820, 1000], winRate: [0.3, 0.42], games: [12, 60], trophyCount: [0, 2] },
  { id: "casual", label: "Casual", aiDifficulty: "easy", rankRange: [650, 899], winRate: [0.38, 0.5], games: [30, 150], trophyCount: [1, 3] },
  { id: "skilled", label: "Skilled", aiDifficulty: "medium", rankRange: [450, 699], winRate: [0.46, 0.58], games: [60, 300], trophyCount: [2, 5] },
  { id: "expert", label: "Expert", aiDifficulty: "hard", rankRange: [280, 499], winRate: [0.53, 0.64], games: [100, 500], trophyCount: [3, 7] },
  { id: "master", label: "Master", aiDifficulty: "expert", rankRange: [130, 299], winRate: [0.58, 0.7], games: [150, 700], trophyCount: [5, 9] },
  { id: "grandmaster", label: "Grandmaster", aiDifficulty: "expert", rankRange: [40, 149], winRate: [0.63, 0.75], games: [200, 900], trophyCount: [6, 10] },
  { id: "legend", label: "Legend", aiDifficulty: "expert", rankRange: [1, 49], winRate: [0.68, 0.82], games: [300, 1200], trophyCount: [8, 11] },
];

// Trophies are only handed out if the bot's own generated stats would
// plausibly have earned them — keeps a "Beginner" from showing up with a
// "Draughts Legend" (100 wins) trophy.
function trophyEligible(id, { wins, gamesPlayed, bestWinStreak }) {
  switch (id) {
    case "first-win":
      return wins >= 1;
    case "five-wins":
      return wins >= 5;
    case "streak-3":
      return bestWinStreak >= 3;
    case "twentyfive-wins":
      return wins >= 25;
    case "veteran":
      return gamesPlayed >= 50;
    case "coin-1k":
      return gamesPlayed >= 10;
    case "streak-10":
      return bestWinStreak >= 10;
    case "hundred-wins":
      return wins >= 100;
    case "coin-100k":
      return gamesPlayed >= 120;
    case "coin-1m":
      return gamesPlayed >= 300;
    case "coin-1b":
      return gamesPlayed >= 700;
    default:
      return false;
  }
}

export const PERSONALITIES = ["friendly", "funny", "competitive", "angry", "playful", "respectful", "silent"];

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Riley", "Taylor", "Casey", "Morgan", "Jamie", "Avery", "Quinn",
  "Kwame", "Amara", "Diego", "Yuki", "Priya", "Lars", "Fatima", "Mateo", "Ingrid", "Chidi",
  "Elena", "Hiro", "Zara", "Oleg", "Nadia", "Kofi", "Mei", "Liam", "Sofia", "Noah",
];
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVW".split("");
const HANDLE_SUFFIXES = ["", "", "", "_x", "official", "88", "gg", "22", "_", "pro"];

const COUNTRIES = [
  "🇺🇸 United States", "🇨🇦 Canada", "🇬🇧 United Kingdom", "🇳🇬 Nigeria", "🇧🇷 Brazil",
  "🇮🇳 India", "🇩🇪 Germany", "🇰🇪 Kenya", "🇵🇭 Philippines", "🇦🇺 Australia",
  "🇫🇷 France", "🇬🇭 Ghana", "🇯🇲 Jamaica", "🇲🇽 Mexico", "🇿🇦 South Africa",
  "🇪🇸 Spain", "🇯🇵 Japan", "🇸🇪 Sweden", "🇹🇷 Turkey", "🇵🇱 Poland",
];

const THEMES = ["classic-maple", "ebony-ivory", "rosewood-birch", "midnight-jade"];

const BIO_TEMPLATES = {
  friendly: ["Just here for good games and good vibes.", "Always happy to play — win or lose, gg!", "Checkers brings people together. Let's have fun."],
  funny: ["Warning: may talk trash while losing.", "Professional piece-hopper. Amateur trash-talker.", "I peaked in checkers, it's all downhill from here."],
  competitive: ["Here to climb the ranks. No mercy.", "Every game counts. Bring your A-game.", "Rank is everything. Let's go."],
  angry: ["Don't get comfortable.", "I don't lose twice to the same opponent.", "Play nice or don't play at all."],
  playful: ["Kings everywhere, chaos guaranteed.", "Let's make this interesting 😏", "Double jumps are my love language."],
  respectful: ["Good luck, have fun.", "Always a pleasure to play a fair game.", "May the best strategy win."],
  silent: ["...", "Here to play, not to chat.", "Board says more than words do."],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function randFloat(min, max) {
  return min + Math.random() * (max - min);
}
function daysAgoISO(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function generateName() {
  const first = pick(FIRST_NAMES);
  const style = Math.random();
  if (style < 0.4) return `${first}${pick(LAST_INITIALS)}${randInt(1, 99)}`;
  if (style < 0.7) return `${first}${pick(HANDLE_SUFFIXES)}`;
  return `${first}${pick(LAST_INITIALS)}`;
}

// The single entry point: builds one complete, internally-consistent AI
// opponent — used both for online quickmatch bot pairing and anywhere else
// an AI profile needs to be shown. `tierId` can be forced (e.g. to weight
// bots tougher at higher bet tiers); otherwise a tier is picked at random.
// `betAmount`, if given, is the stake this bot is about to play for — its
// generated earnings/balance are guaranteed to comfortably cover it, so a
// bot never shows up wagering more than it could plausibly have.
export function generateBotProfile(tierId = null, betAmount = 0) {
  const tier = SKILL_TIERS.find((t) => t.id === tierId) || pick(SKILL_TIERS);

  const rank = randInt(tier.rankRange[0], tier.rankRange[1]);
  const gamesPlayed = randInt(tier.games[0], tier.games[1]);
  const winRate = randFloat(tier.winRate[0], tier.winRate[1]);
  const wins = Math.round(gamesPlayed * winRate);
  const draws = Math.round(gamesPlayed * randFloat(0.02, 0.09));
  const losses = Math.max(0, gamesPlayed - wins - draws);
  const bestWinStreak = Math.min(wins, randInt(1, Math.max(1, Math.round(tier.trophyCount[1] * 1.4))));

  const stats = { wins, losses, draws, gamesPlayed, bestWinStreak };

  const eligible = TROPHY_IDS.filter((id) => trophyEligible(id, stats));
  const trophyCount = Math.min(eligible.length, randInt(tier.trophyCount[0], tier.trophyCount[1]));
  const trophies = shuffle(eligible).slice(0, trophyCount);

  // Higher tiers show off their best trophy more consistently; lower tiers
  // equip more haphazardly, same as a real casual player would.
  const byPrestige = [...trophies].sort((a, b) => TROPHY_IDS.indexOf(b) - TROPHY_IDS.indexOf(a));
  const showsBestTrophy = tier.trophyCount[1] >= 6 ? Math.random() < 0.85 : Math.random() < 0.35;
  const equippedTitle = trophies.length ? (showsBestTrophy ? byPrestige[0] : pick(trophies)) : null;

  const personality = pick(PERSONALITIES);

  // Base earnings from career stats, then guaranteed to comfortably clear
  // whatever it's about to bet (a bot betting a million coins should never
  // show up with lifetime earnings smaller than that).
  const statsBasedEarnings = Math.round(wins * randFloat(80, 400));
  const betFloor = betAmount > 0 ? Math.round(betAmount * randFloat(1.6, 4)) : 0;
  const totalEarnings = Math.max(statsBasedEarnings, betFloor);
  // Current balance: never shown on a profile (real players' balances
  // aren't public either — see /api/players/:id/public), but kept
  // internally consistent in case it ever is.
  const coins = Math.max(Math.round(totalEarnings * randFloat(0.3, 0.8)), betAmount > 0 ? Math.round(betAmount * randFloat(1.2, 2.5)) : 0);

  return {
    playerId: `bot-${Math.random().toString(36).slice(2, 10)}`,
    name: generateName(),
    avatar: { type: "default", value: `avatar-${randInt(1, 8)}` },
    isBot: true,
    tier: tier.id,
    tierLabel: tier.label,
    aiDifficulty: tier.aiDifficulty,
    personality,
    country: pick(COUNTRIES),
    favoriteTheme: pick(THEMES),
    bio: pick(BIO_TEMPLATES[personality]),
    createdAt: daysAgoISO(randInt(30, 720)),
    rank,
    league: getRankTier(rank).label,
    stats,
    totalEarnings,
    coins,
    trophies,
    equippedTitle,
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Strips a generated bot profile down to what's safe/relevant to hand to a
// client as an "opponent" — same idea as sanitizePlayer for real accounts.
export function publicBotProfile(bot) {
  const { id, name, avatar, rank, league, stats, trophies, equippedTitle, totalEarnings, country, favoriteTheme, bio, createdAt } = bot;
  return {
    id: id || bot.playerId,
    name,
    avatar,
    rank,
    league,
    stats,
    trophies,
    equippedTitle,
    totalEarnings,
    country,
    favoriteTheme,
    bio,
    createdAt,
  };
}
