import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";

const PlayerContext = createContext(null);
const STORAGE_KEY = "checkers.playerId";

const DEFAULT_SETTINGS = {
  view: "HORIZ",
  sounds: "ON",
  firstMove: "WHITE",
  playAs: "WHITE",
  helper: "ON",
  mandatoryJumps: "ON",
  theme: "classic-maple",
};

const OFFLINE_PLAYER = {
  id: "offline",
  name: "Guest",
  stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0, winStreak: 0, bestWinStreak: 0 },
  settings: DEFAULT_SETTINGS,
  trophies: [],
  unlockedLevels: [1],
  history: [],
};

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(OFFLINE_PLAYER);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const savedId = localStorage.getItem(STORAGE_KEY);
      try {
        let profile;
        if (savedId) {
          profile = await api.getPlayer(savedId);
        } else {
          profile = await api.createPlayer("Player");
          localStorage.setItem(STORAGE_KEY, profile.id);
        }
        if (!cancelled) {
          setPlayer(profile);
          setOffline(false);
        }
      } catch (err) {
        // Backend unreachable: fall back to a local guest profile so the
        // game remains fully playable offline.
        if (!cancelled) {
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
    [offline, player.id]
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
    [offline, player.id]
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
        const { player: updated, newlyEarned } = await api.reportResult(player.id, payload);
        setPlayer(updated);
        return { newlyEarned };
      } catch {
        return { newlyEarned: [] };
      }
    },
    [offline, player.id]
  );

  const value = { player, loading, offline, updateSettings, updateName, reportResult };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
