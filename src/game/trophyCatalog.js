// `strength` drives the trophy room's visual tier (color/animation) and the
// coin reward granted the moment a trophy is first earned.
export const TROPHY_CATALOG = [
  { id: "first-win", label: "First Blood", desc: "Win your first game.", strength: "bronze", coinReward: 50 },
  { id: "five-wins", label: "Getting Good", desc: "Win 5 games.", strength: "bronze", coinReward: 100 },
  { id: "streak-3", label: "On a Roll", desc: "Win 3 games in a row.", strength: "silver", coinReward: 150 },
  { id: "twentyfive-wins", label: "Board Master", desc: "Win 25 games.", strength: "silver", coinReward: 300 },
  { id: "veteran", label: "Veteran", desc: "Play 50 games.", strength: "silver", coinReward: 250 },
  { id: "coin-1k", label: "Pocket Change", desc: "Earn 1,000 lifetime coins.", strength: "bronze", coinReward: 50 },
  { id: "streak-10", label: "Unstoppable", desc: "Win 10 games in a row.", strength: "gold", coinReward: 500 },
  { id: "hundred-wins", label: "Draughts Legend", desc: "Win 100 games.", strength: "gold", coinReward: 750 },
  { id: "coin-100k", label: "High Roller", desc: "Earn 100,000 lifetime coins.", strength: "gold", coinReward: 500 },
  { id: "coin-1m", label: "Coin Baron", desc: "Earn 1,000,000 lifetime coins.", strength: "platinum", coinReward: 2000 },
  { id: "coin-1b", label: "Table Legend", desc: "Earn 1,000,000,000 lifetime coins.", strength: "platinum", coinReward: 10000 },
];

export const STRENGTH_META = {
  bronze: { color: "#a5673f", glow: "rgba(165, 103, 63, 0.5)", label: "Bronze" },
  silver: { color: "#b9c2c9", glow: "rgba(185, 194, 201, 0.5)", label: "Silver" },
  gold: { color: "#d9b34d", glow: "rgba(217, 179, 77, 0.6)", label: "Gold" },
  platinum: { color: "#7cc7ff", glow: "rgba(124, 199, 255, 0.6)", label: "Platinum" },
};

export function getTrophy(id) {
  return TROPHY_CATALOG.find((t) => t.id === id) || null;
}

export function getTrophyLabel(id) {
  return getTrophy(id)?.label || null;
}
