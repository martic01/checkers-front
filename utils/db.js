// JSON-file backed storage. We tried Node's built-in `node:sqlite` here but
// it's still experimental and threw intermittent "statement has been
// finalized" errors in the wild (including breaking sign-in) — so this
// reverts to a plain, dependency-free JSON file, which has been reliable
// throughout testing. All storage access goes through readDB()/writeDB()
// below, so swapping in a real database later only means editing this file.
import { readFile, writeFile } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { STARTING_COINS } from "./economy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "players.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Guards against concurrent writes clobbering each other.
let writeChain = Promise.resolve();

async function ensureFile() {
  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, JSON.stringify({ players: {} }, null, 2));
  }
}

async function readRaw() {
  await ensureFile();
  const raw = await readFile(DB_PATH, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { players: {} };
  }
  if (data.players) {
    for (const p of Object.values(data.players)) migratePlayer(p);
  }
  return data;
}

// Player records created before a field existed won't have it in the saved
// JSON — this backfills any such gaps in place so every route can safely
// assume the shape in defaultPlayer() below, instead of crashing on
// `undefined.includes(...)` etc. for older accounts.
function migratePlayer(p) {
  if (!Array.isArray(p.ownedEmotes)) p.ownedEmotes = [];
  if (p.equippedEmoteId === undefined) p.equippedEmoteId = null;
  return p;
}

async function writeRaw(data) {
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// Every read-then-write request (grant coins, settle a match, accept a
// friend request, etc.) must go through here. It queues each transaction
// one at a time — read the latest file, hand it to `fn` to mutate in
// place, write it back — before the next transaction is allowed to start.
//
// This is what fixes coins/rank "reverting" after a delay: previously,
// two overlapping requests could each read the same stale snapshot, and
// whichever one finished writing *last* would silently erase the other's
// change. Serializing the whole read-modify-write cycle (not just the
// final write) closes that gap.
export function transact(fn) {
  const result = writeChain.then(async () => {
    const db = await readRaw();
    const value = await fn(db);
    await writeRaw(db);
    return value;
  });
  // Keep the queue alive even if this transaction throws, so one failed
  // request doesn't permanently block every request after it.
  writeChain = result.then(
    () => {},
    () => {}
  );
  return result;
}

// Read-only accessor for GET routes that never write back. Still reads the
// live file (not a cached copy), so it always reflects the latest state.
export async function readDB() {
  return readRaw();
}

// Kept for any lingering direct callers; routes a plain write through the
// same queue so it can't race with an in-flight transaction either.
export async function writeDB(data) {
  return transact((db) => {
    Object.assign(db, data);
  });
}

export function isDatabaseEmpty(db) {
  return !db || Object.keys(db.players || {}).length === 0;
}

export function defaultPlayer(id, name, extra = {}, dbIsEmpty = false) {
  return {
    id,
    username: extra.username || null,
    passwordHash: extra.passwordHash || null,
    clerkId: extra.clerkId || null,
    googleId: extra.googleId || null,
    email: extra.email || null,
    isAdmin: !!dbIsEmpty,
    name: name || `Player-${id.slice(0, 5)}`,
    avatar: extra.avatar || { type: "default", value: "avatar-1" },
    createdAt: new Date().toISOString(),
    bio: "",
    country: null,
    dateOfBirth: null,
    agreedToTermsAt: null,
    ownedEmotes: [],
    equippedEmoteId: null,
    country: null,
    dateOfBirth: null,
    agreedToTermsAt: null,

    coins: STARTING_COINS,
    totalEarnings: 0,
    exp: 0,
    rank: 1000,
    lastDailyClaim: null,

    seasonProgress: { seasonId: null, mojo: 0, claimed: [] },

    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      winStreak: 0,
      bestWinStreak: 0,
    },
    settings: {
      view: "HORIZ",
      sounds: "ON",
      music: "ON",
      musicUrl: "",
      firstMove: "WHITE",
      playAs: "WHITE",
      helper: "ON",
      mandatoryJumps: "ON",
      theme: "classic-maple",
    },
    trophies: [],
    equippedTitle: null, // trophy id whose label shows as a small tag next to the player's name
    unlockedLevels: [1],
    inbox: [
      {
        id: `welcome-${id}`,
        from: "admin",
        message: `Welcome to MarCheckers, ${name || "friend"}! 🎉 You've got 1,000 coins to start — good luck at the table.`,
        reward: null,
        claimed: false,
        readAt: null,
        deleteMode: "30d-any",
        createdAt: new Date().toISOString(),
      },
    ],
    friends: [], // player ids
    friendRequests: [], // incoming: [{ id, from, name, avatar, at }]
    history: [], // { date, opponent, result, mode, coinsDelta }
  };
}

export function findByUsername(db, username) {
  if (!username) return null;
  const lower = username.toLowerCase();
  return Object.values(db.players).find((p) => p.username?.toLowerCase() === lower) || null;
}

export function findByClerkId(db, clerkId) {
  if (!clerkId) return null;
  return Object.values(db.players).find((p) => p.clerkId === clerkId) || null;
}

export function findByGoogleId(db, googleId) {
  if (!googleId) return null;
  return Object.values(db.players).find((p) => p.googleId === googleId) || null;
}
