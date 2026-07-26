import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEASON_FILE = path.join(__dirname, "..", "data", "season.json");

const SEASON_LENGTH_MS = 60 * 24 * 60 * 60 * 1000; // ~2 months

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REWARD_TYPES = ["coin", "avatar", "emoji", "theme", "title", "table"];

const REWARD_ICONS = {
  coin: "🪙",
  avatar: "🥇",
  emoji: "⚽",
  theme: "🏟️",
  title: "🎗️",
  table: "🏆",
};

// The reward track is regenerated fresh each season, so it can be fully
// swapped out for a new event without touching any code.
function buildRewardTrack(seasonId) {
  return LETTERS.map((letter, i) => {
    const type = REWARD_TYPES[i % REWARD_TYPES.length];
    const mojoRequired = (i + 1) * 120;
    const coinValue = type === "coin" ? (i + 1) * 250 : 0;
    return {
      id: `${seasonId}-${letter}`,
      letter,
      mojoRequired,
      type,
      icon: REWARD_ICONS[type],
      label: rewardLabel(type, letter, i),
      coinValue,
    };
  });
}

function rewardLabel(type, letter, i) {
  switch (type) {
    case "coin":
      return `${(i + 1) * 250} Golden Coins`;
    case "avatar":
      return `Champion Avatar Frame ${letter}`;
    case "emoji":
      return `Fan Emoji Pack ${letter}`;
    case "theme":
      return `Stadium Board Theme ${letter}`;
    case "title":
      return `Title: "Golden Boot ${letter}"`;
    case "table":
      return `Team Jersey Tag ${letter}`;
    default:
      return `Reward ${letter}`;
  }
}

function newSeason() {
  const startedAt = Date.now();
  const id = `season-${startedAt}`;
  return {
    id,
    name: "World Cup Oven",
    startedAt,
    endsAt: startedAt + SEASON_LENGTH_MS,
    rewardTrack: buildRewardTrack(id),
  };
}

async function readSeasonFile() {
  if (!existsSync(SEASON_FILE)) return null;
  try {
    return JSON.parse(await readFile(SEASON_FILE, "utf-8"));
  } catch {
    return null;
  }
}

// Returns the active season, rotating in a brand-new one (with a fresh
// reward track) if the previous one has expired.
export async function getCurrentSeason() {
  let season = await readSeasonFile();
  if (!season || Date.now() > season.endsAt) {
    season = newSeason();
    await writeFile(SEASON_FILE, JSON.stringify(season, null, 2));
  }
  return season;
}

export function getSeasonTier(season, mojo) {
  let tier = -1;
  for (const reward of season.rewardTrack) {
    if (mojo >= reward.mojoRequired) tier += 1;
    else break;
  }
  return tier;
}
