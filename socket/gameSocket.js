import { customAlphabet } from "nanoid";
import { readDB, transact } from "../utils/db.js";
import { isTierUnlocked, BET_TIERS } from "../utils/economy.js";
import { applyGameResult } from "../utils/gameResult.js";
import { generateBotProfile, publicBotProfile, SKILL_TIERS } from "../utils/botCatalog.js";

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);
const LEAVE_PENALTY = 100;
const CHALLENGE_TIMEOUT_MS = 2 * 60 * 1000;
// How long a mid-match connection drop gets before the match is voided and
// both sides refunded. A real disconnect (network loss, tab crash) is
// distinct from someone deliberately clicking "leave" — see room:leave vs
// the "disconnect" socket event below.
const NETWORK_GRACE_MS = 7 * 60 * 1000;

// In-memory room store: { code: { players, betAmount, chat, settled, scores } }
const rooms = new Map();

// Matchmaking queue, keyed by bet amount, so Quick Match only pairs players
// wagering the same stake. { [betAmount]: { socketId, playerId, name, avatar } }
const queues = new Map();

// Presence: playerId -> socketId, so friends can see who's online and be
// challenged directly.
const presence = new Map();

// Pending friend challenges: challengeId -> { fromId, toId, fromSocketId, toSocketId, betAmount, timer }
const challenges = new Map();

const BOT_WAIT_MS = 9000; // if nobody real shows up in this window, pair with a bot instead

// Higher stakes get paired against a tougher, more decorated bot — mixing
// in a little randomness so it's not perfectly predictable which tier shows
// up at a given bet. Million+ and billion+ bets get a guaranteed difficulty
// floor rather than leaving it purely to chance, so a huge bet can never
// accidentally land a weak bot.
function pickBotTier(betAmount) {
  const idx = Math.max(0, BET_TIERS.indexOf(betAmount));
  const target = Math.round((idx / (BET_TIERS.length - 1)) * (SKILL_TIERS.length - 1));
  const jitter = Math.round((Math.random() - 0.5) * 2); // -1, 0, or 1
  let tierIndex = Math.min(SKILL_TIERS.length - 1, Math.max(0, target + jitter));

  const expertIndex = SKILL_TIERS.findIndex((t) => t.id === "expert"); // aiDifficulty "hard"
  const masterIndex = SKILL_TIERS.findIndex((t) => t.id === "master"); // aiDifficulty "expert"

  if (betAmount >= 1_000_000_000) tierIndex = Math.max(tierIndex, masterIndex);
  else if (betAmount >= 1_000_000) tierIndex = Math.max(tierIndex, expertIndex);

  return SKILL_TIERS[tierIndex].id;
}

function makeBotOpponent(betAmount) {
  return generateBotProfile(pickBotTier(betAmount), betAmount);
}

// Chat is delivered to clients separately via chat:message/chat:expire, and
// nothing on the client ever reads room.chat — broadcasting it as part of
// every room:update/room:ready (join, leave, settle, forfeit...) was pure
// wasted bandwidth that grows with how much has been said in the match.
function roomView(room) {
  const { chat, ...rest } = room;
  return rest;
}

async function getPlayer(playerId) {
  const db = await readDB();
  return { db, player: db.players[playerId] };
}

async function publicPlayer(entry) {
  const { player } = await getPlayer(entry.playerId);
  return {
    id: entry.playerId,
    name: entry.name,
    avatar: entry.avatar,
    equippedTitle: player?.equippedTitle ?? null,
    equippedEmoteId: player?.equippedEmoteId ?? null,
    rank: player?.rank ?? null,
  };
}

function isPlayerBusy(playerId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.playerId === playerId)) return true;
  }
  return false;
}

export function attachGameSocket(io) {
  io.on("connection", (socket) => {
    socket.data.roomCode = null;
    socket.data.playerId = null;
    socket.emit("connected", { id: socket.id });

    // ---------- Presence (for friends list + challenges) ----------
    socket.on("presence:hello", ({ playerId } = {}) => {
      if (!playerId) return;
      socket.data.playerId = playerId;
      presence.set(playerId, socket.id);
    });

    socket.on("presence:check", (ids = [], cb) => {
      const online = {};
      for (const id of ids) online[id] = presence.has(id) && !isPlayerBusy(id);
      cb?.(online);
    });

    // ---------- Friend challenges ----------
    socket.on("challenge:send", async ({ fromId, fromName, fromAvatar, toId, betAmount } = {}, cb) => {
      const toSocketId = presence.get(toId);
      if (!toSocketId) return cb?.({ ok: false, error: "That friend is offline" });
      if (isPlayerBusy(toId)) return cb?.({ ok: false, error: "That friend is already in a match" });

      const { player } = await getPlayer(fromId);
      if (!player) return cb?.({ ok: false, error: "Unknown player" });
      if (!isTierUnlocked(betAmount, player.totalEarnings)) return cb?.({ ok: false, error: "That bet tier is locked" });
      if (player.coins < betAmount) return cb?.({ ok: false, error: "Not enough coins for this bet" });

      const { player: targetPlayer } = await getPlayer(toId);
      if (!targetPlayer) return cb?.({ ok: false, error: "Unknown player" });
      if (targetPlayer.coins < betAmount) {
        return cb?.({ ok: false, error: `${targetPlayer.name} doesn't have enough coins for that bet` });
      }

      const challengeId = genCode();
      const timer = setTimeout(() => {
        const c = challenges.get(challengeId);
        if (!c) return;
        challenges.delete(challengeId);
        io.to(c.fromSocketId).emit("challenge:expired", { challengeId });
      }, CHALLENGE_TIMEOUT_MS);

      challenges.set(challengeId, { fromId, toId, fromSocketId: socket.id, toSocketId, betAmount, timer });

      io.to(toSocketId).emit("challenge:incoming", {
        challengeId,
        fromId,
        fromName,
        fromAvatar,
        betAmount,
        expiresInMs: CHALLENGE_TIMEOUT_MS,
      });
      cb?.({ ok: true, challengeId });
    });

    socket.on("challenge:accept", async ({ challengeId, name, avatar } = {}, cb) => {
      const c = challenges.get(challengeId);
      if (!c) return cb?.({ ok: false, error: "That challenge has expired" });
      clearTimeout(c.timer);
      challenges.delete(challengeId);

      const fromSocket = io.sockets.sockets.get(c.fromSocketId);
      const toSocket = io.sockets.sockets.get(c.toSocketId);
      if (!fromSocket || !toSocket) return cb?.({ ok: false, error: "Challenger disconnected" });

      const { player: fromPlayer } = await getPlayer(c.fromId);
      const { player: toPlayer } = await getPlayer(c.toId);
      if (!fromPlayer || fromPlayer.coins < c.betAmount) {
        io.to(c.fromSocketId).emit("challenge:cancelled", { reason: "Challenger no longer has enough coins" });
        return cb?.({ ok: false, error: "Challenger no longer has enough coins" });
      }
      if (!toPlayer || toPlayer.coins < c.betAmount) {
        return cb?.({ ok: false, error: "You don't have enough coins for this bet" });
      }

      const code = genCode();
      const room = {
        betAmount: c.betAmount,
        players: [
          { socketId: c.fromSocketId, playerId: c.fromId, name: fromPlayer.name, avatar: fromPlayer.avatar, color: "WHITE" },
          { socketId: c.toSocketId, playerId: c.toId, name: name || toPlayer.name, avatar: avatar || toPlayer.avatar, color: "BLACK" },
        ],
        chat: [],
        settled: false,
        scores: { [c.fromId]: 0, [c.toId]: 0 },
      };
      rooms.set(code, room);
      fromSocket.join(code);
      toSocket.join(code);
      fromSocket.data.roomCode = code;
      toSocket.data.roomCode = code;

      await deductCoins(c.fromId, c.betAmount);
      await deductCoins(c.toId, c.betAmount);

      fromSocket.emit("match:found", { code, color: "WHITE", opponent: await publicPlayer(room.players[1]), betAmount: c.betAmount });
      toSocket.emit("match:found", { code, color: "BLACK", opponent: await publicPlayer(room.players[0]), betAmount: c.betAmount });
      cb?.({ ok: true, code });
    });

    socket.on("challenge:reject", ({ challengeId } = {}) => {
      const c = challenges.get(challengeId);
      if (!c) return;
      clearTimeout(c.timer);
      challenges.delete(challengeId);
      io.to(c.fromSocketId).emit("challenge:rejected", { challengeId });
    });

    // ---------- Quick Match (auto-pairing) ----------

    socket.on("quickmatch:join", async ({ playerId, betAmount, name, avatar } = {}, cb) => {
      const { player } = await getPlayer(playerId);
      if (!player) return cb?.({ ok: false, error: "Unknown player" });
      if (!isTierUnlocked(betAmount, player.totalEarnings)) {
        return cb?.({ ok: false, error: "That bet tier is locked" });
      }
      if (player.coins < betAmount) {
        return cb?.({ ok: false, error: "Not enough coins for this bet" });
      }

      const waiting = queues.get(betAmount);
      if (waiting && waiting.socketId !== socket.id) {
        clearTimeout(waiting.botTimer);
        queues.delete(betAmount);
        const code = genCode();
        const room = {
          betAmount,
          players: [
            { socketId: waiting.socketId, playerId: waiting.playerId, name: waiting.name, avatar: waiting.avatar, color: "WHITE" },
            { socketId: socket.id, playerId, name, avatar, color: "BLACK" },
          ],
          chat: [],
          settled: false,
          scores: { [waiting.playerId]: 0, [playerId]: 0 },
        };
        rooms.set(code, room);

        const waitingSocket = io.sockets.sockets.get(waiting.socketId);
        waitingSocket?.join(code);
        socket.join(code);
        if (waitingSocket) waitingSocket.data.roomCode = code;
        socket.data.roomCode = code;

        await deductCoins(waiting.playerId, betAmount);
        await deductCoins(playerId, betAmount);

        waitingSocket?.emit("match:found", { code, color: "WHITE", opponent: await publicPlayer(room.players[1]), betAmount });
        socket.emit("match:found", { code, color: "BLACK", opponent: await publicPlayer(room.players[0]), betAmount });
        cb?.({ ok: true, code });
      } else {
        // Only kicks in if no real opponent shows up in time — a genuine
        // second player joining always takes priority (see above).
        const botTimer = setTimeout(async () => {
          if (queues.get(betAmount)?.socketId !== socket.id) return; // already matched for real
          queues.delete(betAmount);
          const bot = makeBotOpponent(betAmount);
          const code = genCode();
          rooms.set(code, {
            betAmount,
            vsBot: true,
            players: [{ socketId: socket.id, playerId, name, avatar, color: "WHITE" }, { ...bot, socketId: null, color: "BLACK" }],
            chat: [],
            settled: false,
            scores: { [playerId]: 0, [bot.playerId]: 0 },
          });
          socket.join(code);
          socket.data.roomCode = code;
          await deductCoins(playerId, betAmount);
          socket.emit("match:found", {
            code,
            color: "WHITE",
            opponent: publicBotProfile(bot),
            aiDifficulty: bot.aiDifficulty,
            betAmount,
            vsBot: true,
          });
        }, BOT_WAIT_MS);

        queues.set(betAmount, { socketId: socket.id, playerId, name, avatar, botTimer });
        cb?.({ ok: true, waiting: true });
      }
    });

    socket.on("quickmatch:cancel", ({ betAmount } = {}) => {
      const waiting = queues.get(betAmount);
      if (waiting?.socketId === socket.id) {
        clearTimeout(waiting.botTimer);
        queues.delete(betAmount);
      }
    });

    // ---------- Manual room code (Create / Join) ----------
    socket.on("room:create", async ({ playerId, name, avatar, betAmount = 0 } = {}, cb) => {
      if (betAmount) {
        const { player } = await getPlayer(playerId);
        if (!player) return cb?.({ ok: false, error: "Unknown player" });
        if (!isTierUnlocked(betAmount, player.totalEarnings)) return cb?.({ ok: false, error: "That bet tier is locked" });
        if (player.coins < betAmount) return cb?.({ ok: false, error: "Not enough coins for this bet" });
      }

      let code = genCode();
      while (rooms.has(code)) code = genCode();

      rooms.set(code, {
        betAmount,
        players: [{ socketId: socket.id, playerId, name: name || "Player 1", avatar, color: "WHITE" }],
        chat: [],
        settled: false,
        scores: { [playerId]: 0 },
      });
      socket.join(code);
      socket.data.roomCode = code;
      cb?.({ ok: true, code });
      io.to(code).emit("room:update", roomView(rooms.get(code)));
    });

    socket.on("room:join", async ({ code, playerId, name, avatar } = {}, cb) => {
      const room = rooms.get(code);
      if (!room) return cb?.({ ok: false, error: "Room not found" });
      if (room.players.length >= 2) return cb?.({ ok: false, error: "Room is full" });

      if (room.betAmount) {
        const { player } = await getPlayer(playerId);
        if (!player) return cb?.({ ok: false, error: "Unknown player" });
        if (player.coins < room.betAmount) return cb?.({ ok: false, error: "Not enough coins for this bet" });
      }

      room.players.push({ socketId: socket.id, playerId, name: name || "Player 2", avatar, color: "BLACK" });
      room.scores[playerId] = 0;
      socket.join(code);
      socket.data.roomCode = code;

      if (room.betAmount) {
        await deductCoins(room.players[0].playerId, room.betAmount);
        await deductCoins(room.players[1].playerId, room.betAmount);
      }

      // Fill in rank/equippedTitle for both sides so the pairing-reveal
      // screen can show a trophy tag, same as quickmatch opponents get.
      for (const p of room.players) {
        const { player: full } = await getPlayer(p.playerId);
        p.rank = full?.rank ?? null;
        p.equippedTitle = full?.equippedTitle ?? null;
        p.equippedEmoteId = full?.equippedEmoteId ?? null;
      }

      cb?.({ ok: true, code, betAmount: room.betAmount });
      io.to(code).emit("room:update", roomView(room));
      io.to(code).emit("room:ready", roomView(room));
    });

    // ---------- Gameplay ----------
    socket.on("game:move", ({ code, move } = {}) => {
      if (!rooms.has(code)) return;
      socket.to(code).emit("game:move", { move });
    });

    // Winner reports the result once; server settles the pot for both sides.
    socket.on("game:result", async ({ code, winnerId } = {}) => {
      const room = rooms.get(code);
      if (!room || room.settled) return;
      room.settled = true;
      const pot = room.betAmount * 2;
      if (winnerId && room.scores) room.scores[winnerId] = (room.scores[winnerId] || 0) + 1;

      for (const p of room.players) {
        const isWinner = p.playerId === winnerId;
        const result = winnerId ? (isWinner ? "win" : "loss") : "draw";
        const coinsDelta = winnerId ? (isWinner ? pot : 0) : room.betAmount;
        const opponent = room.players.find((o) => o.playerId !== p.playerId);

        let summary = null;
        await transact(async (db) => {
          const player = db.players[p.playerId];
          if (!player) return;
          summary = await applyGameResult(player, {
            result,
            mode: "online",
            opponent: opponent?.name || "Opponent",
            coinsDelta,
          });
        });
        if (summary) io.to(p.socketId).emit("game:settled", { result, coinsDelta, scores: room.scores, ...summary });
      }
    });

    // ---------- Mid-game draw proposals ----------
    // Never automatic — one side proposes, the other has to agree (or, vs a
    // bot, the bot's own client makes a random accept/decline call using
    // this same handshake). Declining just clears the offer; the match
    // keeps going exactly as it was.
    socket.on("draw:offer", ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room || room.settled) return;
      room.drawOffer = { fromSocketId: socket.id };
      socket.to(code).emit("draw:offered");
    });

    socket.on("draw:accept", ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room || room.settled) return;
      room.drawOffer = null;
      io.to(code).emit("draw:agreed");
    });

    socket.on("draw:decline", ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room) return;
      room.drawOffer = null;
      socket.to(code).emit("draw:declined");
    });

    // ---------- Rematch (same room, tally kept, bet can change) ----------
    socket.on("rematch:offer", ({ code, betAmount } = {}) => {
      const room = rooms.get(code);
      if (!room) return;
      room.rematchOffer = { fromSocketId: socket.id, betAmount };
      socket.to(code).emit("rematch:offered", { betAmount });
    });

    socket.on("rematch:accept", async ({ code } = {}, cb) => {
      const room = rooms.get(code);
      if (!room?.rematchOffer) return cb?.({ ok: false, error: "No rematch offer pending" });
      const { betAmount } = room.rematchOffer;

      // Bot opponents aren't real accounts in the players DB, so they skip
      // the normal coin-balance check/deduction — but they still shouldn't
      // "afford" to accept a bet bigger than their own generated lifetime
      // earnings, or a human could bet a bot into an impossible wager.
      for (const p of room.players) {
        if (p.isBot) {
          if (betAmount > (p.totalEarnings || 0)) {
            io.to(code).emit("rematch:cancelled", { reason: `${p.name} can't afford a bet that high` });
            room.rematchOffer = null;
            return cb?.({ ok: false });
          }
          continue;
        }
        const { player } = await getPlayer(p.playerId);
        if (!player || player.coins < betAmount) {
          io.to(code).emit("rematch:cancelled", { reason: `${p.name} doesn't have enough coins for this bet` });
          room.rematchOffer = null;
          return cb?.({ ok: false });
        }
      }

      for (const p of room.players) {
        if (p.isBot) continue;
        await deductCoins(p.playerId, betAmount);
      }
      room.betAmount = betAmount;
      room.settled = false;
      room.rematchOffer = null;
      io.to(code).emit("rematch:started", { betAmount, scores: room.scores });
      cb?.({ ok: true });
    });

    socket.on("rematch:decline", ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room) return;
      room.rematchOffer = null;
      socket.to(code).emit("rematch:declined");
    });

    // A player leaving the post-game screen instead of rematching. Distinct
    // from "decline" so the other side gets a clear "X quit" instead of just
    // a declined offer, and so the room stops accepting new rematch offers.
    socket.on("rematch:quit", ({ code } = {}) => {
      const room = rooms.get(code);
      if (!room) return;
      room.rematchOffer = null;
      room.rematchClosed = true;
      const me = room.players.find((p) => p.socketId === socket.id);
      socket.to(code).emit("rematch:quit", { name: me?.name || "Opponent" });
    });

    // ---------- Ephemeral chat (never persisted; auto-expires) ----------
    socket.on("chat:message", ({ code, text, from } = {}) => {
      const room = rooms.get(code);
      if (!room || !text?.trim()) return;
      const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.slice(0, 300), from, at: Date.now() };
      room.chat.push(msg);
      io.to(code).emit("chat:message", msg);
      setTimeout(() => {
        room.chat = room.chat.filter((m) => m.id !== msg.id);
        io.to(code).emit("chat:expire", { id: msg.id });
      }, 60000);
    });

    socket.on("emoji:react", ({ code, emoji, from } = {}) => {
      if (!rooms.has(code)) return;
      io.to(code).emit("emoji:react", { emoji, from });
    });

    // ---------- Voice chat signaling (WebRTC, relayed only) ----------
    socket.on("voice:ready", ({ code } = {}) => socket.to(code).emit("voice:ready"));
    socket.on("voice:offer", ({ code, sdp } = {}) => socket.to(code).emit("voice:offer", { sdp }));
    socket.on("voice:answer", ({ code, sdp } = {}) => socket.to(code).emit("voice:answer", { sdp }));
    socket.on("voice:ice", ({ code, candidate } = {}) => socket.to(code).emit("voice:ice", { candidate }));
    socket.on("voice:leave", ({ code } = {}) => socket.to(code).emit("voice:leave"));

    socket.on("room:leave", () => leaveRoom(socket, io, { punish: true }));

    // A client calls this right after its socket reconnects (auto-retried
    // by socket.io, or once the browser's own connection comes back),
    // using the room code + playerId it remembered locally, to reclaim its
    // seat instead of the match being voided.
    socket.on("room:rejoin", ({ code, playerId } = {}, cb) => {
      const room = rooms.get(code);
      if (!room || room.settled) return cb?.({ ok: false });
      const slot = room.players.find((p) => p.playerId === playerId);
      if (!slot) return cb?.({ ok: false });

      slot.socketId = socket.id;
      slot.networkLost = false;
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerId = playerId;

      if (room.networkTimer) {
        clearTimeout(room.networkTimer);
        room.networkTimer = null;
      }

      io.to(code).emit("opponent:network-restored");
      cb?.({ ok: true, room: roomView(room) });
    });

    socket.on("disconnect", () => {
      for (const [amount, waiting] of queues.entries()) {
        if (waiting.socketId === socket.id) queues.delete(amount);
      }
      if (socket.data.playerId && presence.get(socket.data.playerId) === socket.id) {
        presence.delete(socket.data.playerId);
      }
      handleNetworkDrop(socket, io);
    });
  });
}

// A socket dropping (network loss, tab crash, backgrounded phone, etc.)
// isn't the same as someone deliberately leaving — give it NETWORK_GRACE_MS
// to reconnect via room:rejoin before the match is voided. Only applies to
// a live 2-player match in progress; anything else (a lone "waiting for
// code" room, an already-settled match) is cleaned up immediately like
// before, since there's no live opponent stake to protect.
function handleNetworkDrop(socket, io) {
  const code = socket.data.roomCode;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const slot = room.players.find((p) => p.socketId === socket.id);

  if (!room.settled && room.players.length === 2 && slot) {
    slot.socketId = null;
    slot.networkLost = true;
    socket.leave(code);
    socket.data.roomCode = null;

    io.to(code).emit("opponent:network-lost");
    room.networkTimer = setTimeout(() => voidMatchForNetworkTimeout(code, io), NETWORK_GRACE_MS);
    return;
  }

  leaveRoom(socket, io, { punish: true });
}

// Neither side is at fault when a connection just drops — refund both
// real players' stake (bots have no wallet to refund) and end the match
// instead of treating it as a forfeit.
async function voidMatchForNetworkTimeout(code, io) {
  const room = rooms.get(code);
  if (!room || room.settled) return;
  room.settled = true;

  for (const p of room.players) {
    if (p.isBot) continue;
    await transact((db) => {
      const player = db.players[p.playerId];
      if (player) player.coins += room.betAmount;
    });
  }

  io.to(code).emit("match:network-timeout");
  rooms.delete(code);
}

async function deductCoins(playerId, amount) {
  if (!playerId || !amount) return;
  await transact((db) => {
    const player = db.players[playerId];
    if (player) player.coins = Math.max(0, player.coins - amount);
  });
}

// A player leaving mid-match forfeits: the remaining player wins the full
// pot, and the leaver additionally pays a 100-coin penalty on top of their
// lost stake.
async function leaveRoom(socket, io, { punish = false } = {}) {
  const code = socket.data.roomCode;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const leaver = room.players.find((p) => p.socketId === socket.id);
  const stayed = room.players.filter((p) => p.socketId !== socket.id);

  const isActiveForfeit = punish && !room.settled && room.players.length === 2 && leaver && stayed.length === 1;

  if (isActiveForfeit) {
    room.settled = true;
    const winner = stayed[0];
    const pot = room.betAmount * 2;
    room.scores[winner.playerId] = (room.scores[winner.playerId] || 0) + 1;

    let winnerSummary = null;
    await transact(async (db) => {
      const winnerPlayer = db.players[winner.playerId];
      if (!winnerPlayer) return;
      winnerSummary = await applyGameResult(winnerPlayer, {
        result: "win",
        mode: "online",
        opponent: leaver.name,
        coinsDelta: pot,
      });
    });
    if (winnerSummary) {
      io.to(winner.socketId).emit("opponent:forfeit", { result: "win", coinsDelta: pot, scores: room.scores, ...winnerSummary });
    }

    await transact(async (db) => {
      const leaverPlayer = db.players[leaver.playerId];
      if (!leaverPlayer) return;
      await applyGameResult(leaverPlayer, {
        result: "loss",
        mode: "online",
        opponent: winner.name,
        coinsDelta: -LEAVE_PENALTY,
      });
    });
  }

  room.players = room.players.filter((p) => p.socketId !== socket.id);
  socket.leave(code);
  socket.data.roomCode = null;

  if (room.players.length === 0) {
    rooms.delete(code);
  } else if (!isActiveForfeit) {
    io.to(code).emit("room:update", roomView(room));
    io.to(code).emit("opponent:left");
  }
}

// While the real player base is small, showing "2 online" makes the lobby
// look dead and discourages people from trying online play. This blends a
// slowly-drifting baseline with the real count so it never looks static or
// obviously fake, but never hides genuine growth either (real count always
// wins once it passes the baseline).
const BASELINE_MIN = 10;
const BASELINE_MAX = 16;
let baselineSeed = BASELINE_MIN + Math.floor(Math.random() * (BASELINE_MAX - BASELINE_MIN));
setInterval(() => {
  const drift = Math.random() < 0.5 ? -1 : 1;
  baselineSeed = Math.min(BASELINE_MAX, Math.max(BASELINE_MIN, baselineSeed + drift));
}, 45000);

export function getLobbyStats() {
  let activeMatches = 0;
  for (const room of rooms.values()) {
    if (room.players.length === 2) activeMatches += 1;
  }
  let searching = 0;
  for (const q of queues.values()) if (q) searching += 1;
  return {
    activeMatches,
    totalRooms: rooms.size,
    searching,
    playersOnline: Math.max(presence.size, baselineSeed),
  };
}
