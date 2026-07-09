import { create } from "zustand";
import { api } from "../api/client.js";
import { toastError, toastSuccess } from "./uiStore.js";

const STORAGE_KEY = "checkers.playerId";

const DEFAULT_SETTINGS = {
  view: "HORIZ",
  sounds: "ON",
  music: "ON",
  musicUrl: "",
  firstMove: "WHITE",
  playAs: "WHITE",
  helper: "ON",
  mandatoryJumps: "ON",
  theme: "classic-maple",
};

// Only used if the backend is completely unreachable (true offline mode).
// Guests normally get a *real* server-side player record instead (see
// continueAsGuest below), which is what fixed online play for guests.
const LOCAL_ONLY_PLAYER = {
  id: "local-only",
  name: "Guest",
  avatar: { type: "default", value: "avatar-1" },
  coins: 1000,
  totalEarnings: 0,
  exp: 0,
  rank: 1000,
  stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, winStreak: 0, bestWinStreak: 0 },
  settings: DEFAULT_SETTINGS,
  trophies: [],
  unlockedLevels: [1],
  inbox: [],
  history: [],
  seasonProgress: { seasonId: null, mojo: 0, claimed: [] },
};

export const usePlayerStore = create((set, get) => ({
  player: null,
  loading: true,
  offline: false, // true only when the backend itself is unreachable
  needsAuth: false,
  authError: null,

  init: async () => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    try {
      if (savedId) {
        const profile = await api.getPlayer(savedId);
        set({ player: profile, offline: false, loading: false });
      } else {
        set({ needsAuth: true, loading: false });
      }
    } catch {
      // Saved id no longer exists server-side, or the backend is down.
      localStorage.removeItem(STORAGE_KEY);
      set({ needsAuth: true, loading: false });
    }
  },

  register: async ({ username, password, name, avatar }) => {
    set({ authError: null });
    try {
      const profile = await api.register({ username, password, name, avatar });
      localStorage.setItem(STORAGE_KEY, profile.id);
      set({ player: profile, offline: false, needsAuth: false });
      return true;
    } catch (err) {
      set({ authError: err.message });
      return false;
    }
  },

  login: async ({ username, password }) => {
    set({ authError: null });
    try {
      const profile = await api.login({ username, password });
      localStorage.setItem(STORAGE_KEY, profile.id);
      set({ player: profile, offline: false, needsAuth: false });
      return true;
    } catch (err) {
      set({ authError: err.message });
      return false;
    }
  },

  // Guests still get a real backend-registered id (no username/password)
  // so online play, coins, and betting all work normally. Falls back to a
  // fully local stub only if the backend can't be reached at all.
  continueAsGuest: async () => {
    try {
      const profile = await api.createPlayer("Guest");
      localStorage.setItem(STORAGE_KEY, profile.id);
      set({ player: profile, offline: false, needsAuth: false });
    } catch {
      set({ player: LOCAL_ONLY_PLAYER, offline: true, needsAuth: false });
      toastError("Backend unreachable — playing fully offline. Online matches are disabled.");
    }
  },

  googleSignIn: async (credential) => {
    set({ authError: null });
    try {
      const profile = await api.googleSignIn(credential);
      localStorage.setItem(STORAGE_KEY, profile.id);
      set({ player: profile, offline: false, needsAuth: false });
      return true;
    } catch (err) {
      set({ authError: err.message });
      return false;
    }
  },

  clerkSync: async (token) => {
    try {
      const profile = await api.clerkSync(token);
      localStorage.setItem(STORAGE_KEY, profile.id);
      set({ player: profile, offline: false, needsAuth: false });
      return true;
    } catch {
      toastError("Could not finish signing you in — please try again.");
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    window.Clerk?.signOut?.();
    set({ player: null, needsAuth: true });
  },

  updateSettings: async (patch) => {
    const { player, offline } = get();
    set({ player: { ...player, settings: { ...player.settings, ...patch } } });
    if (offline) return;
    try {
      await api.updateSettings(player.id, patch);
    } catch {
      toastError("Couldn't save that setting — check your connection.");
    }
  },

  updateName: async (name) => {
    const { player, offline } = get();
    set({ player: { ...player, name } });
    if (offline) return;
    try {
      await api.updateName(player.id, name);
      toastSuccess("Name updated");
    } catch {
      toastError("Couldn't update your name.");
    }
  },

  updateAvatar: async (avatar) => {
    const { player, offline } = get();
    set({ player: { ...player, avatar } });
    if (offline) return;
    try {
      await api.updateAvatar(player.id, avatar);
    } catch {
      toastError("Couldn't update your avatar.");
    }
  },

  claimDaily: async () => {
    const { player, offline } = get();
    if (offline) return null;
    try {
      const { player: updated, amount } = await api.claimDaily(player.id);
      set({ player: updated });
      return amount;
    } catch {
      return null;
    }
  },

  claimInboxReward: async (msgId) => {
    const { player, offline } = get();
    if (offline) return null;
    try {
      const { player: updated, reward } = await api.claimInbox(player.id, msgId);
      set({ player: updated });
      return reward;
    } catch {
      toastError("Couldn't claim that reward — try again.");
      return null;
    }
  },

  reportResult: async (payload) => {
    const { player, offline } = get();
    if (offline) {
      set((s) => {
        const stats = { ...s.player.stats };
        stats.gamesPlayed += 1;
        if (payload.result === "win") {
          stats.wins += 1;
          stats.winStreak += 1;
          stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.winStreak);
        } else if (payload.result === "loss") {
          stats.losses += 1;
          stats.winStreak = 0;
        } else {
          stats.draws += 1;
          stats.winStreak = 0;
        }
        return { player: { ...s.player, stats } };
      });
      return { newlyEarned: [] };
    }
    try {
      const res = await api.reportResult(player.id, payload);
      set({ player: res.player });
      return res;
    } catch {
      toastError("Couldn't save that game's result.");
      return { newlyEarned: [] };
    }
  },

  refreshPlayer: async () => {
    const { player, offline } = get();
    if (offline || !player?.id) return;
    try {
      const fresh = await api.getPlayer(player.id);
      set({ player: fresh });
    } catch {
      /* transient — next successful call will resync */
    }
  },
}));

export function usePlayer() {
  return usePlayerStore();
}
