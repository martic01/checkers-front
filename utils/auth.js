import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { readDB } from "./db.js";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Demo-grade admin gate: either a shared secret key header, OR the request
// comes from a player whose account is flagged isAdmin (the first person to
// ever sign up gets this automatically — see db.js defaultPlayer).
export const ADMIN_KEY = process.env.ADMIN_KEY || "draughts-admin-2026";

export async function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key === ADMIN_KEY) return next();

  const playerId = req.headers["x-player-id"];
  if (playerId) {
    const db = await readDB();
    if (db.players[playerId]?.isAdmin) return next();
  }

  return res.status(401).json({ error: "Admin access required" });
}

// Strips sensitive fields before a player object is sent to the client.
export function sanitizePlayer(player) {
  if (!player) return player;
  const { passwordHash, ...rest } = player;
  return rest;
}
