const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createPlayer: (name) => request("/api/players", { method: "POST", body: JSON.stringify({ name }) }),
  getPlayer: (id) => request(`/api/players/${id}`),
  getPublicProfile: (id) => request(`/api/players/${id}/public`),
  updateName: (id, name) => request(`/api/players/${id}/name`, { method: "PATCH", body: JSON.stringify({ name }) }),
  updateAvatar: (id, avatar) => request(`/api/players/${id}/avatar`, { method: "PATCH", body: JSON.stringify({ avatar }) }),
  updateSettings: (id, settings) => request(`/api/players/${id}/settings`, { method: "PATCH", body: JSON.stringify(settings) }),
  reportResult: (id, payload) => request(`/api/players/${id}/result`, { method: "POST", body: JSON.stringify(payload) }),
  leaderboard: () => request("/api/players"),
  lobby: () => request("/api/lobby"),
  season: () => request("/api/season"),

  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  googleSignIn: (credential) => request("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),

  claimDaily: (id) => request(`/api/players/${id}/daily-claim`, { method: "POST" }),
  getInbox: (id) => request(`/api/players/${id}/inbox`),
  claimInbox: (id, msgId) => request(`/api/players/${id}/inbox/${msgId}/claim`, { method: "POST" }),
  getSeasonProgress: (id) => request(`/api/players/${id}/season`),
  claimSeasonReward: (id, letter) => request(`/api/players/${id}/season/claim/${letter}`, { method: "POST" }),
  getTiers: (id) => request(`/api/players/${id}/tiers`),

  adminGrant: (auth, payload) => request("/api/admin/grant", { method: "POST", headers: adminHeaders(auth), body: JSON.stringify(payload) }),
  adminMessage: (auth, payload) =>
    request("/api/admin/message", { method: "POST", headers: adminHeaders(auth), body: JSON.stringify(payload) }),
  adminPlayers: (auth) => request("/api/admin/players", { headers: adminHeaders(auth) }),
  authConfig: () => request("/api/auth/config"),
  clerkSync: (token) => request("/api/auth/clerk-sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
};

// `auth` is either { playerId } for isAdmin-flagged accounts, or { adminKey }
// for the shared-secret fallback.
function adminHeaders(auth = {}) {
  if (auth.playerId) return { "x-player-id": auth.playerId };
  return { "x-admin-key": auth.adminKey };
}

export const API_BASE_URL = BASE_URL;
