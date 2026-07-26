export const DELETE_MODES = [
  { id: "instant", label: "Instantly after read" },
  { id: "24h", label: "24 hours after read" },
  { id: "3d", label: "3 days after read" },
  { id: "7d-any", label: "7 days (read or not)" },
  { id: "30d-any", label: "30 days (read or not)" },
];

const MS = { "24h": 86400000, "3d": 3 * 86400000, "7d-any": 7 * 86400000, "30d-any": 30 * 86400000 };

export function isExpired(msg, now = Date.now()) {
  const mode = msg.deleteMode || "7d-any";
  const created = new Date(msg.createdAt).getTime();

  if (mode === "instant") return !!msg.readAt; // deleted right on read (see markRead)
  if (mode === "7d-any" || mode === "30d-any") return now - created > MS[mode];
  if (mode === "24h" || mode === "3d") return !!msg.readAt && now - msg.readAt > MS[mode];
  return false;
}

// Removes any expired inbox messages across every player. Cheap enough to
// run on a plain interval given the small scale of this app.
export async function sweepExpiredMessages(transact) {
  await transact((db) => {
    const now = Date.now();
    for (const player of Object.values(db.players)) {
      player.inbox = player.inbox.filter((m) => !isExpired(m, now));
    }
  });
}
