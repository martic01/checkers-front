const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
  updateName: (id, name) => request(`/api/players/${id}/name`, { method: "PATCH", body: JSON.stringify({ name }) }),
  updateSettings: (id, settings) => request(`/api/players/${id}/settings`, { method: "PATCH", body: JSON.stringify(settings) }),
  reportResult: (id, payload) => request(`/api/players/${id}/result`, { method: "POST", body: JSON.stringify(payload) }),
  leaderboard: () => request("/api/players"),
  lobby: () => request("/api/lobby"),
};

export const API_BASE_URL = BASE_URL;
