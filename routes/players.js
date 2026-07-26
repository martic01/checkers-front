import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, transact, defaultPlayer, isDatabaseEmpty } from "../utils/db.js";
import { applyGameResult } from "../utils/gameResult.js";
import { sanitizePlayer } from "../utils/auth.js";
import { DAILY_BONUS_COINS, getUnlockedTiers } from "../utils/economy.js";
import { EMOTE_CATALOG, EMOTE_RANK_REQUIREMENTS } from "../utils/emoteCatalog.js";
import { getCurrentSeason, getSeasonTier } from "../utils/season.js";
import { isExpired } from "../utils/messageExpiry.js";

const router = Router();

// Create a guest player profile (no username/password)
router.post("/", async (req, res) => {
  const player = await transact((db) => {
    const id = nanoid(10);
    const p = defaultPlayer(id, req.body?.name, {}, isDatabaseEmpty(db));
    db.players[id] = p;
    return p;
  });
  res.json(sanitizePlayer(player));
});

// Search players by name (partial, case-insensitive) or exact id, for
// sending friend requests. MUST be registered before /:id routes below,
// or Express would match "search" itself as an :id param.
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  const excludeId = req.query.excludeId;

  const db = await readDB();
  const matches = Object.values(db.players)
    .filter((p) => p.id !== excludeId)
    .filter((p) => p.id.toLowerCase() === q || p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q))
    .slice(0, 20)
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, rank: p.rank }));

  res.json(matches);
});

router.get("/:id/public", async (req, res) => {
  const db = await readDB();
  const player = db.players[req.params.id];
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    rank: player.rank,
    stats: player.stats,
    trophies: player.trophies,
    equippedTitle: player.equippedTitle,
    totalEarnings: player.totalEarnings,
    createdAt: player.createdAt,
    bio: player.bio || "",
    country: player.country || "",
    equippedEmoteId: player.equippedEmoteId || null,
  });
});

router.get("/:id", async (req, res) => {
  const db = await readDB();
  const player = db.players[req.params.id];
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/name", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.name = req.body?.name || p.name;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/avatar", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.avatar = req.body?.avatar || p.avatar;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/bio", async (req, res) => {
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim().slice(0, 100) : "";
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.bio = bio;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/onboarding", async (req, res) => {
  const { country, dateOfBirth, agreedToTerms } = req.body || {};
  if (!agreedToTerms) return res.status(400).json({ error: "You must agree to the Terms & Policy" });
  if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({ error: "Please select a valid country" });
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return res.status(400).json({ error: "Please enter a valid date of birth" });
  }
  const ageMs = Date.now() - dob.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 13) return res.status(400).json({ error: "You must be at least 13 years old" });

  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) {
      p.country = country;
      p.dateOfBirth = dateOfBirth;
      p.agreedToTermsAt = new Date().toISOString();
    }
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/equip-title", async (req, res) => {
  const { trophyId } = req.body || {};
  let error = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    if (trophyId !== null && !p.trophies.includes(trophyId)) {
      error = "You haven't earned that trophy yet";
      return p;
    }
    p.equippedTitle = trophyId;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(400).json({ error });
  res.json(sanitizePlayer(player));
});

router.post("/:id/emotes/purchase", async (req, res) => {
  const { emoteId } = req.body || {};
  const catalogEntry = EMOTE_CATALOG[emoteId];
  let error = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    if (!Array.isArray(p.ownedEmotes)) p.ownedEmotes = [];
    if (!catalogEntry) {
      error = "Unknown emote";
      return p;
    }
    if (p.ownedEmotes.includes(emoteId)) {
      error = "You already own this emote";
      return p;
    }
    const rankNeeded = EMOTE_RANK_REQUIREMENTS[catalogEntry.category];
    if (rankNeeded && (!p.rank || p.rank > rankNeeded)) {
      error = `Only the top ${rankNeeded} players can buy this emote`;
      return p;
    }
    if (p.coins < catalogEntry.price) {
      error = "Not enough coins";
      return p;
    }
    p.coins -= catalogEntry.price;
    p.ownedEmotes = [...p.ownedEmotes, emoteId];
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(400).json({ error });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/equip-emote", async (req, res) => {
  const { emoteId } = req.body || {};
  let error = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    if (!Array.isArray(p.ownedEmotes)) p.ownedEmotes = [];
    // null clears the equipped emote (falls back to a rank emote if the
    // player currently qualifies for one — resolved client-side).
    if (emoteId !== null && !p.ownedEmotes.includes(emoteId)) {
      error = "You don't own that emote";
      return p;
    }
    p.equippedEmoteId = emoteId;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(400).json({ error });
  res.json(sanitizePlayer(player));
});

router.patch("/:id/settings", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.settings = { ...p.settings, ...req.body };
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

// Daily login bonus: 200 coins, once per calendar day.
router.post("/:id/daily-claim", async (req, res) => {
  let alreadyClaimed = false;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    const today = new Date().toDateString();
    if (p.lastDailyClaim === today) {
      alreadyClaimed = true;
      return p;
    }
    p.coins += DAILY_BONUS_COINS;
    p.lastDailyClaim = today;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (alreadyClaimed) return res.status(409).json({ error: "Already claimed today", player: sanitizePlayer(player) });
  res.json({ player: sanitizePlayer(player), amount: DAILY_BONUS_COINS });
});

router.get("/:id/inbox", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.inbox = p.inbox.filter((m) => !isExpired(m));
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(player.inbox);
});

// Mark a message read (starts its read-based expiry countdown; 'instant'
// messages are removed right away).
router.post("/:id/inbox/:msgId/read", async (req, res) => {
  let notFoundMsg = false;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    const msg = p.inbox.find((m) => m.id === req.params.msgId);
    if (!msg) {
      notFoundMsg = true;
      return p;
    }
    msg.readAt = Date.now();
    if (msg.deleteMode === "instant") {
      p.inbox = p.inbox.filter((m) => m.id !== msg.id);
    }
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (notFoundMsg) return res.status(404).json({ error: "Message not found" });
  res.json(player.inbox);
});

router.post("/:id/inbox/:msgId/claim", async (req, res) => {
  let error = null;
  let reward = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    const msg = p.inbox.find((m) => m.id === req.params.msgId);
    if (!msg) {
      error = "Message not found";
      return p;
    }
    if (msg.claimed) {
      error = "Already claimed";
      return p;
    }
    msg.claimed = true;
    if (msg.reward?.coins) {
      p.coins += msg.reward.coins;
      p.totalEarnings += msg.reward.coins;
    }
    reward = msg.reward;
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(error === "Already claimed" ? 409 : 404).json({ error });
  res.json({ player: sanitizePlayer(player), reward });
});

// Record a finished game result: { result: 'win'|'loss'|'draw', mode, opponent, level, coinsDelta }
router.post("/:id/result", async (req, res) => {
  let summary = null;
  const player = await transact(async (db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    summary = await applyGameResult(p, req.body || {});
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json({ player: sanitizePlayer(player), ...summary });
});

// Current season + this player's progress on the reward track.
router.get("/:id/season", async (req, res) => {
  const season = await getCurrentSeason();
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    if (!p.seasonProgress || p.seasonProgress.seasonId !== season.id) {
      p.seasonProgress = { seasonId: season.id, mojo: 0, claimed: [] };
    }
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  const tier = getSeasonTier(season, player.seasonProgress.mojo);
  res.json({ season, progress: player.seasonProgress, tier });
});

router.post("/:id/season/claim/:letter", async (req, res) => {
  const season = await getCurrentSeason();
  const reward = season.rewardTrack.find((r) => r.letter === req.params.letter.toUpperCase());
  if (!reward) return res.status(404).json({ error: "Unknown reward" });

  let error = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    if (p.seasonProgress.mojo < reward.mojoRequired) {
      error = "Not unlocked yet";
      return p;
    }
    if (p.seasonProgress.claimed.includes(reward.id)) {
      error = "Already claimed";
      return p;
    }
    p.seasonProgress.claimed.push(reward.id);
    if (reward.coinValue) {
      p.coins += reward.coinValue;
      p.totalEarnings += reward.coinValue;
    }
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(error === "Not unlocked yet" ? 400 : 409).json({ error });
  res.json({ player: sanitizePlayer(player), reward });
});

// Which coin tiers this player can currently bet online.
router.get("/:id/tiers", async (req, res) => {
  const db = await readDB();
  const player = db.players[req.params.id];
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json({ unlocked: getUnlockedTiers(player.totalEarnings), totalEarnings: player.totalEarnings });
});

// ---------- Friends ----------
router.post("/:id/friends/request", async (req, res) => {
  let error = null;
  await transact((db) => {
    const player = db.players[req.params.id];
    const target = db.players[req.body?.targetId];
    if (!player || !target) {
      error = "Player not found";
      return;
    }
    if (player.id === target.id) {
      error = "Can't friend yourself";
      return;
    }
    if (player.friends.includes(target.id)) {
      error = "Already friends";
      return;
    }
    if (target.friendRequests.some((r) => r.from === player.id)) {
      error = "Request already sent";
      return;
    }
    target.friendRequests.push({
      id: nanoid(8),
      from: player.id,
      name: player.name,
      avatar: player.avatar,
      at: new Date().toISOString(),
    });
  });
  if (error === "Player not found") return res.status(404).json({ error });
  if (error) return res.status(409).json({ error });
  res.json({ ok: true });
});

router.post("/:id/friends/accept", async (req, res) => {
  let error = null;
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    const requesterId = req.body?.requesterId;
    const request = p.friendRequests.find((r) => r.from === requesterId);
    if (!request) {
      error = "No such request";
      return p;
    }
    const requester = db.players[requesterId];
    p.friendRequests = p.friendRequests.filter((r) => r.from !== requesterId);
    if (!p.friends.includes(requesterId)) p.friends.push(requesterId);
    if (requester && !requester.friends.includes(p.id)) requester.friends.push(p.id);
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (error) return res.status(404).json({ error });
  res.json(sanitizePlayer(player));
});

router.post("/:id/friends/reject", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (p) p.friendRequests = p.friendRequests.filter((r) => r.from !== req.body?.requesterId);
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.delete("/:id/friends/:friendId", async (req, res) => {
  const player = await transact((db) => {
    const p = db.players[req.params.id];
    if (!p) return null;
    p.friends = p.friends.filter((id) => id !== req.params.friendId);
    const friend = db.players[req.params.friendId];
    if (friend) friend.friends = friend.friends.filter((id) => id !== p.id);
    return p;
  });
  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

router.get("/:id/friends", async (req, res) => {
  const db = await readDB();
  const player = db.players[req.params.id];
  if (!player) return res.status(404).json({ error: "Player not found" });

  const friends = player.friends
    .map((fid) => db.players[fid])
    .filter(Boolean)
    .map((f) => ({ id: f.id, name: f.name, avatar: f.avatar, rank: f.rank, coins: f.coins }));

  res.json({ friends, requests: player.friendRequests });
});

// Leaderboard: top players by rank (lower rank number = better)
router.get("/", async (req, res) => {
  const db = await readDB();
  const list = Object.values(db.players)
    .map((p) => ({ id: p.id, name: p.name, wins: p.stats.wins, rank: p.rank, coins: p.coins }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 20);
  res.json(list);
});

export default router;
