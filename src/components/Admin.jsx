import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toastError, toastSuccess } from "../store/uiStore.js";
import { RankBadge, CoinPill } from "./RankBadge.jsx";
import Button from "./Button.jsx";
import "./Admin.css";

const DELETE_MODES = [
  { id: "instant", label: "Instantly after read" },
  { id: "24h", label: "24 hours after read" },
  { id: "3d", label: "3 days after read" },
  { id: "7d-any", label: "7 days (read or not)" },
  { id: "30d-any", label: "30 days (read or not)" },
];

const WEALTH_TIERS = [
  { id: "all", label: "All Balances" },
  { id: "low", label: "Low (< 1K)", test: (c) => c < 1000 },
  { id: "average", label: "Average (1K–10K)", test: (c) => c >= 1000 && c < 10000 },
  { id: "rich", label: "Rich (10K–100K)", test: (c) => c >= 10000 && c < 100000 },
  { id: "wealthy", label: "Wealthy (100K–1M)", test: (c) => c >= 100000 && c < 1000000 },
  { id: "kings", label: "Kings (1M+)", test: (c) => c >= 1000000 },
];

const RANK_TIER_FILTERS = [
  { id: "all", label: "All Ranks" },
  { id: "legend", label: "Legend (1–49)", test: (r) => r <= 49 },
  { id: "master", label: "Master (50–149)", test: (r) => r >= 50 && r <= 149 },
  { id: "diamond", label: "Diamond (150–299)", test: (r) => r >= 150 && r <= 299 },
  { id: "gold", label: "Gold–Bronze (300+)", test: (r) => r >= 300 },
];

export default function Admin({ player, onBack }) {
  const isSelfAdmin = !!player?.isAdmin;
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("checkers.adminKey") || "");
  const [unlocked, setUnlocked] = useState(isSelfAdmin);
  const [players, setPlayers] = useState([]);
  const [targetId, setTargetId] = useState("all");
  const [coins, setCoins] = useState(0);
  const [rankSet, setRankSet] = useState("");
  const [message, setMessage] = useState("");
  const [deleteMode, setDeleteMode] = useState("7d-any");
  const [search, setSearch] = useState("");
  const [wealthFilter, setWealthFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");

  const auth = isSelfAdmin ? { playerId: player.id } : { adminKey };
  const target = players.find((p) => p.id === targetId);

  const filteredPlayers = players.filter((p) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.username?.toLowerCase().includes(q) && p.id !== q) return false;
    }
    const wealthTest = WEALTH_TIERS.find((w) => w.id === wealthFilter)?.test;
    if (wealthTest && !wealthTest(p.coins)) return false;
    const rankTest = RANK_TIER_FILTERS.find((r) => r.id === rankFilter)?.test;
    if (rankTest && !rankTest(p.rank)) return false;
    return true;
  });

  useEffect(() => {
    if (!unlocked) return;
    api
      .adminPlayers(auth)
      .then(setPlayers)
      .catch(() => toastError("Could not load players"));
  }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryUnlock = async () => {
    try {
      const list = await api.adminPlayers({ adminKey });
      setPlayers(list);
      setUnlocked(true);
      sessionStorage.setItem("checkers.adminKey", adminKey);
    } catch {
      toastError("Invalid admin key");
    }
  };

  const grant = async () => {
    try {
      if (targetId === "all") {
        await api.adminMessage(auth, {
          playerId: "all",
          message: message || "You received a reward!",
          rewardCoins: coins || undefined,
          deleteMode,
        });
      } else {
        await api.adminGrant(auth, {
          playerId: targetId,
          coins: coins || 0,
          rankSet: rankSet ? Number(rankSet) : undefined,
          message,
          deleteMode,
        });
      }
      toastSuccess("Sent!");
      setCoins(0);
      setMessage("");
    } catch (err) {
      toastError(err.message);
    }
  };

  const sendMessageOnly = async () => {
    if (!message.trim()) return toastError("Write a message first");
    try {
      await api.adminMessage(auth, { playerId: targetId, message, deleteMode });
      toastSuccess("Message sent!");
      setMessage("");
    } catch (err) {
      toastError(err.message);
    }
  };

  if (!unlocked) {
    return (
      <div className="admin-lock-screen">
        <div className="admin-lock-card">
          <button className="back-link back-link--light" onClick={onBack}>
            ← Back
          </button>
          <div className="admin-lock-icon">🛡️</div>
          <h2 className="admin-lock-title">Admin Access</h2>
          <p className="admin-lock-sub">Enter the admin key to continue</p>
          <input
            className="auth-input"
            type="password"
            placeholder="Admin key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          />
          <Button variant="gold" full onClick={tryUnlock} className="admin-lock-btn">
            Unlock
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <button className="back-link back-link--light" onClick={onBack}>
          ← Back
        </button>
        <div className="admin-header__title">
          <span className="admin-header__icon">🛡️</span>
          <div>
            <h1>Admin Dashboard</h1>
            {isSelfAdmin && <p>Signed in as account admin — {player.name}</p>}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-card admin-card--players">
          <h3>Players ({filteredPlayers.length} of {players.length})</h3>

          <input
            className="auth-input admin-search-input"
            placeholder="Search by name, username, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="admin-filter-row">
            <select className="auth-input" value={wealthFilter} onChange={(e) => setWealthFilter(e.target.value)}>
              {WEALTH_TIERS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
            <select className="auth-input" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)}>
              {RANK_TIER_FILTERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-player-list">
            <button
              className={`admin-player-row ${targetId === "all" ? "admin-player-row--selected" : ""}`}
              onClick={() => setTargetId("all")}
            >
              <span className="admin-player-row__avatar admin-player-row__avatar--all">🌐</span>
              <span className="admin-player-row__name">Everyone</span>
            </button>
            {filteredPlayers.map((p) => (
              <button
                key={p.id}
                className={`admin-player-row ${targetId === p.id ? "admin-player-row--selected" : ""}`}
                onClick={() => setTargetId(p.id)}
              >
                <span className="admin-player-row__avatar">{p.name?.[0]?.toUpperCase() || "?"}</span>
                <span className="admin-player-row__info">
                  <span className="admin-player-row__name">{p.name}</span>
                  <span className="admin-player-row__meta">
                    <CoinPill coins={p.coins} />
                    <RankBadge rank={p.rank} size="sm" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-card admin-card--form">
          <h3>{targetId === "all" ? "Message Everyone" : `Manage ${target?.name || "Player"}`}</h3>

          <div className="admin-field-row">
            <div className="admin-field">
              <label className="auth-label">Grant Coins</label>
              <input className="auth-input" type="number" value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
            </div>
            {targetId !== "all" && (
              <div className="admin-field">
                <label className="auth-label">Set Rank (1-1000)</label>
                <input
                  className="auth-input"
                  type="number"
                  min={1}
                  max={1000}
                  value={rankSet}
                  onChange={(e) => setRankSet(e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="auth-label">Message</label>
          <textarea className="auth-input admin-textarea" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />

          <label className="auth-label">Auto-delete this message</label>
          <select className="auth-input" value={deleteMode} onChange={(e) => setDeleteMode(e.target.value)}>
            {DELETE_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="admin-actions">
            <Button variant="gold" onClick={grant}>
              🎁 Grant Reward
            </Button>
            <Button variant="ghost" onClick={sendMessageOnly}>
              ✉️ Message Only
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
