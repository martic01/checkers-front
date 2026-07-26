import dotenv from "dotenv";
dotenv.config();
import { Router } from "express";
import { nanoid } from "nanoid";
import { OAuth2Client } from "google-auth-library";
import { verifyToken, createClerkClient } from "@clerk/backend";
import { readDB, transact, defaultPlayer, findByUsername, findByGoogleId, findByClerkId, isDatabaseEmpty } from "../utils/db.js";
import { hashPassword, verifyPassword, sanitizePlayer } from "../utils/auth.js";

const router = Router();

// Set VITE_GOOGLE_CLIENT_ID (frontend) and GOOGLE_CLIENT_ID (backend, same
// value) to enable the standalone "Sign in with Google" button. This is a
// fallback path — if Clerk is configured (below) it handles Google too.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Set CLERK_SECRET_KEY (backend) and VITE_CLERK_PUBLISHABLE_KEY (frontend)
// to enable Clerk (Google + email/password sign-in/up, hosted by Clerk).
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const clerkClient = CLERK_SECRET_KEY ? createClerkClient({ secretKey: CLERK_SECRET_KEY }) : null;

router.post("/register", async (req, res) => {
  const { username, password, name, avatar } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  let error = null;
  const player = await transact((db) => {
    if (findByUsername(db, username)) {
      error = "That username is already taken";
      return null;
    }
    const id = nanoid(10);
    const p = defaultPlayer(
      id,
      name || username,
      { username, passwordHash: hashPassword(password), avatar },
      isDatabaseEmpty(db)
    );
    db.players[id] = p;
    return p;
  });

  if (error) return res.status(409).json({ error });
  res.json(sanitizePlayer(player));
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const db = await readDB();
  const player = findByUsername(db, username);
  if (!player || !verifyPassword(password || "", player.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.json(sanitizePlayer(player));
});

router.post("/google", async (req, res) => {
  if (!googleClient) {
    return res.status(501).json({ error: "Google sign-in isn't configured on this server yet" });
  }
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing Google credential" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google credential" });
  }

  const player = await transact((db) => {
    let p = findByGoogleId(db, payload.sub);
    if (!p) {
      const id = nanoid(10);
      p = defaultPlayer(
        id,
        payload.name || payload.email,
        { avatar: payload.picture ? { type: "custom", value: payload.picture } : undefined },
        isDatabaseEmpty(db)
      );
      p.googleId = payload.sub;
      p.email = payload.email;
      db.players[id] = p;
    }
    return p;
  });

  res.json(sanitizePlayer(player));
});

// Frontend checks this on load to know whether to show Clerk's UI or the
// built-in username/password + standalone Google button.
router.get("/config", (req, res) => {
  res.json({ clerkEnabled: !!clerkClient, googleEnabled: !!googleClient });
});

// Called after Clerk has already authenticated the user client-side. We
// verify their session token, then find-or-create a local player linked by
// clerkId so the rest of the app (coins, rank, stats...) works unchanged.
router.post("/clerk-sync", async (req, res) => {
  if (!clerkClient) {
    return res.status(501).json({ error: "Clerk isn't configured on this server yet" });
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing session token" });

  let verified;
  try {
    verified = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const clerkUserId = verified.sub;

  // Check first without holding the write-lock (avoids blocking every other
  // request on this app while we wait on Clerk's API for a brand new user).
  const existing = findByClerkId(await readDB(), clerkUserId);
  let clerkUser = null;
  if (!existing) {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  }

  const player = await transact((db) => {
    let p = findByClerkId(db, clerkUserId);
    if (!p && clerkUser) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email || "Player";
      const id = nanoid(10);
      p = defaultPlayer(
        id,
        name,
        { clerkId: clerkUserId, email, avatar: clerkUser.imageUrl ? { type: "custom", value: clerkUser.imageUrl } : undefined },
        isDatabaseEmpty(db)
      );
      db.players[id] = p;
    }
    return p;
  });

  if (!player) return res.status(500).json({ error: "Could not create your account — please try again" });
  res.json(sanitizePlayer(player));
});

export default router;
