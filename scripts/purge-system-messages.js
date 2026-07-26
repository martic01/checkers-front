// One-time cleanup: removes every existing admin/system inbox message from
// every player, per the "delete all existing admin/system messages" request.
// This does NOT touch the auto-delete/expiry logic for future messages —
// that's fixed separately in utils/messageExpiry.js + server.js (an
// immediate sweep now also runs on server startup, not just every 5 min).
//
// Usage: node scripts/purge-system-messages.js
import { transact } from "../utils/db.js";

const removed = await transact((db) => {
  let count = 0;
  for (const player of Object.values(db.players)) {
    const before = player.inbox.length;
    player.inbox = player.inbox.filter((m) => m.from !== "admin" && m.from !== "system");
    count += before - player.inbox.length;
  }
  return count;
});

console.log(`Removed ${removed} admin/system inbox message(s) across all players.`);
process.exit(0);
