import { Router } from "express";
import { nanoid } from "nanoid";
import { readDB, transact } from "../utils/db.js";
import { requireAdmin, sanitizePlayer } from "../utils/auth.js";
import { RANK_MIN, RANK_MAX, computeRank } from "../utils/economy.js";

const router = Router();
router.use(requireAdmin);

router.get("/players", async (req, res) => {
  const db = await readDB();
  const list = Object.values(db.players).map((p) => ({
    id: p.id,
    name: p.name,
    username: p.username,
    coins: p.coins,
    rank: p.rank,
    totalEarnings: p.totalEarnings,
  }));
  res.json(list);
});

// Grant coins and/or set rank directly, optionally with a message that
// shows up in the player's inbox as a claimable reward.
router.post("/grant", async (req, res) => {
  const { playerId, coins = 0, rankSet, message, deleteMode = "7d-any" } = req.body || {};

  const player = await transact((db) => {
    const p = db.players[playerId];
    if (!p) return null;

    if (rankSet) {
      // player.rank is normally *derived* from player.exp every time a game
      // result is recorded (applyGameResult -> computeRank(exp)). Setting
      // p.rank alone here looked like it worked, but the very next game the
      // player finished would recompute rank from the old exp value and
      // silently stomp this override — that was the "resets after some
      // time" bug. Fix: also rewrite exp to the value that maps back to the
      // chosen rank, so future recomputation agrees with the admin's change
      // instead of reverting it.
      const clampedRank = Math.max(RANK_MIN, Math.min(RANK_MAX, rankSet));
      p.exp = Math.max(0, (RANK_MAX - clampedRank) * 15);
      p.rank = computeRank(p.exp);
    }

    if (coins) {
      p.inbox.push({
        id: nanoid(8),
        from: "admin",
        message: message || `An admin sent you ${coins} coins!`,
        reward: { coins },
        claimed: false,
        readAt: null,
        deleteMode,
        createdAt: new Date().toISOString(),
      });
    } else if (message) {
      p.inbox.push({
        id: nanoid(8),
        from: "admin",
        message,
        reward: null,
        claimed: false,
        readAt: null,
        deleteMode,
        createdAt: new Date().toISOString(),
      });
    }
    return p;
  });

  if (!player) return res.status(404).json({ error: "Player not found" });
  res.json(sanitizePlayer(player));
});

// System message to one player or everyone, with an optional coin reward.
router.post("/message", async (req, res) => {
  const { playerId, message, rewardCoins, deleteMode = "7d-any" } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  const notifiedCount = await transact((db) => {
    const targets = playerId === "all" ? Object.values(db.players) : [db.players[playerId]].filter(Boolean);
    for (const player of targets) {
      player.inbox.push({
        id: nanoid(8),
        from: "system",
        message,
        reward: rewardCoins ? { coins: rewardCoins } : null,
        claimed: false,
        readAt: null,
        deleteMode,
        createdAt: new Date().toISOString(),
      });
    }
    return targets.length;
  });

  if (notifiedCount === 0) return res.status(404).json({ error: "No matching player(s)" });
  res.json({ notified: notifiedCount });
});

export default router;
