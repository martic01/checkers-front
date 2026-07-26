import { evaluateTrophies, TROPHY_CATALOG } from "./trophies.js";
import { computeRank, WIN_EXP, LOSS_EXP, DRAW_EXP, WIN_MOJO, LOSS_MOJO, DRAW_MOJO } from "./economy.js";
import { getCurrentSeason, getSeasonTier } from "./season.js";

// Mutates `player` in place (caller is responsible for persisting via writeDB)
// and returns a summary of what changed, useful for client-side toasts.
export async function applyGameResult(player, { result, mode = "ai", opponent = "AI", level = null, coinsDelta = 0 }) {
  const s = player.stats;
  s.gamesPlayed += 1;

  let expGain = DRAW_EXP;
  let mojoGain = DRAW_MOJO;

  if (result === "win") {
    s.wins += 1;
    s.winStreak += 1;
    s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
    expGain = WIN_EXP;
    mojoGain = WIN_MOJO;
    if (level && level < 5 && !player.unlockedLevels.includes(level + 1)) {
      player.unlockedLevels.push(level + 1);
    }
  } else if (result === "loss") {
    s.losses += 1;
    s.winStreak = 0;
    expGain = LOSS_EXP;
    mojoGain = LOSS_MOJO;
  } else {
    s.draws += 1;
    s.winStreak = 0;
  }

  player.exp = (player.exp || 0) + expGain;
  player.rank = computeRank(player.exp);

  if (coinsDelta) {
    player.coins = Math.max(0, (player.coins || 0) + coinsDelta);
    if (coinsDelta > 0) player.totalEarnings = (player.totalEarnings || 0) + coinsDelta;
  }

  const season = await getCurrentSeason();
  if (!player.seasonProgress || player.seasonProgress.seasonId !== season.id) {
    player.seasonProgress = { seasonId: season.id, mojo: 0, claimed: [] };
  }
  const prevTier = getSeasonTier(season, player.seasonProgress.mojo);
  player.seasonProgress.mojo += mojoGain;
  const newTier = getSeasonTier(season, player.seasonProgress.mojo);

  player.history.push({
    date: new Date().toISOString(),
    result,
    mode,
    opponent,
    level,
    coinsDelta,
  });
  player.history = player.history.slice(-100);

  const { trophies, newlyEarned } = evaluateTrophies(
    { ...s, totalEarnings: player.totalEarnings },
    player.trophies
  );
  player.trophies = trophies;

  let trophyCoins = 0;
  for (const id of newlyEarned) {
    const trophy = TROPHY_CATALOG.find((t) => t.id === id);
    if (trophy?.coinReward) trophyCoins += trophy.coinReward;
  }
  if (trophyCoins) {
    player.coins += trophyCoins;
    // Not counted toward totalEarnings/bet-tier unlocks — this is a bonus
    // for achievements, not "winnings" in the competitive sense.
  }

  return {
    newlyEarned,
    trophyCoins,
    expGain,
    mojoGain,
    rank: player.rank,
    seasonTierUps: Math.max(0, newTier - prevTier),
  };
}
