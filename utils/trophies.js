export const TROPHY_CATALOG = [
  { id: "first-win", label: "First Blood", desc: "Win your first game.", check: (s) => s.wins >= 1, coinReward: 50 },
  { id: "five-wins", label: "Getting Good", desc: "Win 5 games.", check: (s) => s.wins >= 5, coinReward: 100 },
  { id: "twentyfive-wins", label: "Board Master", desc: "Win 25 games.", check: (s) => s.wins >= 25, coinReward: 300 },
  { id: "hundred-wins", label: "Draughts Legend", desc: "Win 100 games.", check: (s) => s.wins >= 100, coinReward: 750 },
  { id: "streak-3", label: "On a Roll", desc: "Win 3 games in a row.", check: (s) => s.bestWinStreak >= 3, coinReward: 150 },
  { id: "streak-10", label: "Unstoppable", desc: "Win 10 games in a row.", check: (s) => s.bestWinStreak >= 10, coinReward: 500 },
  { id: "veteran", label: "Veteran", desc: "Play 50 games.", check: (s) => s.gamesPlayed >= 50, coinReward: 250 },
  { id: "coin-1k", label: "Pocket Change", desc: "Earn 1,000 lifetime coins.", check: (s) => (s.totalEarnings || 0) >= 1000, coinReward: 50 },
  { id: "coin-100k", label: "High Roller", desc: "Earn 100,000 lifetime coins.", check: (s) => (s.totalEarnings || 0) >= 100000, coinReward: 500 },
  { id: "coin-1m", label: "Coin Baron", desc: "Earn 1,000,000 lifetime coins.", check: (s) => (s.totalEarnings || 0) >= 1000000, coinReward: 2000 },
  { id: "coin-1b", label: "Table Legend", desc: "Earn 1,000,000,000 lifetime coins.", check: (s) => (s.totalEarnings || 0) >= 1000000000, coinReward: 10000 },
];

export function evaluateTrophies(stats, currentTrophies) {
  const owned = new Set(currentTrophies);
  const newlyEarned = [];
  for (const trophy of TROPHY_CATALOG) {
    if (!owned.has(trophy.id) && trophy.check(stats)) {
      owned.add(trophy.id);
      newlyEarned.push(trophy.id);
    }
  }
  return { trophies: Array.from(owned), newlyEarned };
}
