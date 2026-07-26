import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import playersRouter from "./routes/players.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import { attachGameSocket, getLobbyStats } from "./socket/gameSocket.js";
import { getCurrentSeason } from "./utils/season.js";
import { sweepExpiredMessages } from "./utils/messageExpiry.js";
import { transact } from "./utils/db.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // generous limit: custom avatars are sent as data URLs

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/lobby", (req, res) => {
  const { activeMatches, totalRooms, searching, playersOnline } = getLobbyStats();
  res.json({
    playersOnline,
    activeMatches,
    totalRooms,
    searching,
  });
});

app.get("/api/season", async (req, res) => {
  res.json(await getCurrentSeason());
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/players", playersRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

attachGameSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Checkers backend listening on http://localhost:${PORT}`);
});

// Run once immediately on boot (not just every 5 min) so messages that
// should already be expired — e.g. the server was down past their expiry —
// get swept right away instead of lingering until the next interval tick.
sweepExpiredMessages(transact).catch(() => {});
setInterval(() => {
  sweepExpiredMessages(transact).catch(() => {});
}, 5 * 60 * 1000);


