import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";

const PlayerContext = createContext(null);
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

const OFFLINE_PLAYER = {
  id: "offline",
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

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const savedId = localStorage.getItem(STORAGE_KEY);
      try {
        if (savedId) {
          const profile = await api.getPlayer(savedId);
          if (!cancelled) {
            setPlayer(profile);
            setOffline(false);
          }
        } else if (!cancelled) {
          setNeedsAuth(true);
        }
      } catch {
        if (!cancelled) {
          // Could be "backend unreachable" or "saved id no longer exists".
          // Either way, fall through to a fully-offline guest experience.
          setOffline(true);
          setPlayer(OFFLINE_PLAYER);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async ({ username, password, name, avatar }) => {
    setAuthError(null);
    try {
      const profile = await api.register({ username, password, name, avatar });
      localStorage.setItem(STORAGE_KEY, profile.id);
      setPlayer(profile);
      setOffline(false);
      setNeedsAuth(false);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  }, []);

  const login = useCallback(async ({ username, password }) => {
    setAuthError(null);
    try {
      const profile = await api.login({ username, password });
      localStorage.setItem(STORAGE_KEY, profile.id);
      setPlayer(profile);
      setOffline(false);
      setNeedsAuth(false);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setPlayer(OFFLINE_PLAYER);
    setOffline(true);
    setNeedsAuth(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
    setNeedsAuth(true);
  }, []);

  const updateSettings = useCallback(
    async (patch) => {
      setPlayer((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
      if (offline) return;
      try {
        await api.updateSettings(player.id, patch);
      } catch {
        /* keep local state even if sync fails */
      }
    },
    [offline, player?.id]
  );

  const updateName = useCallback(
    async (name) => {
      setPlayer((prev) => ({ ...prev, name }));
      if (offline) return;
      try {
        await api.updateName(player.id, name);
      } catch {
        /* ignore */
      }
    },
    [offline, player?.id]
  );

  const updateAvatar = useCallback(
    async (avatar) => {
      setPlayer((prev) => ({ ...prev, avatar }));
      if (offline) return;
      try {
        await api.updateAvatar(player.id, avatar);
      } catch {
        /* ignore */
      }
    },
    [offline, player?.id]
  );

  const claimDaily = useCallback(async () => {
    if (offline) return null;
    try {
      const { player: updated, amount } = await api.claimDaily(player.id);
      setPlayer(updated);
      return amount;
    } catch {
      return null;
    }
  }, [offline, player?.id]);

  const claimInboxReward = useCallback(
    async (msgId) => {
      if (offline) return null;
      try {
        const { player: updated, reward } = await api.claimInbox(player.id, msgId);
        setPlayer(updated);
        return reward;
      } catch {
        return null;
      }
    },
    [offline, player?.id]
  );

  const reportResult = useCallback(
    async (payload) => {
      if (offline) {
        setPlayer((prev) => {
          const s = { ...prev.stats };
          s.gamesPlayed += 1;
          if (payload.result === "win") {
            s.wins += 1;
            s.winStreak += 1;
            s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak);
          } else if (payload.result === "loss") {
            s.losses += 1;
            s.winStreak = 0;
          } else {
            s.draws += 1;
            s.winStreak = 0;
          }
          return { ...prev, stats: s };
        });
        return { newlyEarned: [] };
      }
      try {
        const res = await api.reportResult(player.id, payload);
        setPlayer(res.player);
        return res;
      } catch {
        return { newlyEarned: [] };
      }
    },
    [offline, player?.id]
  );

  const refreshPlayer = useCallback(async () => {
    if (offline || !player?.id) return;
    try {
      const fresh = await api.getPlayer(player.id);
      setPlayer(fresh);
    } catch {
      /* ignore */
    }
  }, [offline, player?.id]);

  const value = {
    player,
    loading,
    offline,
    needsAuth,
    authError,
    register,
    login,
    logout,
    continueAsGuest,
    updateSettings,
    updateName,
    updateAvatar,
    claimDaily,
    claimInboxReward,
    reportResult,
    refreshPlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
