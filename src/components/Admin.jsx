import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
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
  const [coins, setCoins] = useState("");
  const [rankSet, setRankSet] = useState("");
  const [message, setMessage] = useState("");
  const [deleteMode, setDeleteMode] = useState("7d-any");
  const [search, setSearch] = useState("");
  const [wealthFilter, setWealthFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deductAmount, setDeductAmount] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);

  const auth = isSelfAdmin ? { playerId: player.id } : { adminKey };
  const target = players.find((p) => p.id === targetId);
  // Bulk actions act on the multi-select if anything's checked, otherwise
  // fall back to whichever single player is currently targeted.
  const actingOnIds = selectedIds.length > 0 ? selectedIds : targetId !== "all" ? [targetId] : [];

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reloadPlayers = () => api.adminPlayers(auth).then(setPlayers).catch(() => toastError("Could not refresh player list"));

  const handleDeduct = async () => {
    const amount = Number(deductAmount);
    if (!amount || amount <= 0) return toastError("Enter a coin amount to deduct");
    if (actingOnIds.length === 0) return toastError("Select at least one player");
    try {
      const res = await api.adminDeduct(auth, { playerIds: actingOnIds, coins: amount });
      toastSuccess(`💸 Deducted ${amount} coins from ${res.affected} player(s)`);
      setDeductAmount("");
      reloadPlayers();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleBan = async (banned) => {
    if (actingOnIds.length === 0) return toastError("Select at least one player");
    try {
      const res = await api.adminBan(auth, { playerIds: actingOnIds, banned });
      toastSuccess(banned ? `🚫 Banned ${res.affected} player(s)` : `✅ Unbanned ${res.affected} player(s)`);
      reloadPlayers();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleResetRank = async () => {
    if (actingOnIds.length === 0) return toastError("Select at least one player");
    try {
      const res = await api.adminResetRank(auth, { playerIds: actingOnIds });
      toastSuccess(`📉 Reset rank for ${res.affected} player(s)`);
      reloadPlayers();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleDeleteAccounts = async () => {
    if (actingOnIds.length === 0) return toastError("Select at least one player");
    if (!window.confirm(`Permanently delete ${actingOnIds.length} account(s)? This cannot be undone.`)) return;
    try {
      const res = await api.adminDeletePlayers(auth, { playerIds: actingOnIds });
      toastSuccess(`🗑️ Deleted ${res.affected} account(s)`);
      setSelectedIds([]);
      setTargetId("all");
      reloadPlayers();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleForceFriend = async () => {
    if (targetId === "all") return toastError("Select a single player first");
    try {
      await api.adminForceFriend(auth, { playerIdA: player.id, playerIdB: targetId });
      toastSuccess(`🤝 You're now friends with ${target?.name || "that player"}`);
    } catch (err) {
      toastError(err.message);
    }
  };

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

  // Statistics
  const totalCoins = players.reduce((sum, p) => sum + p.coins, 0);
  const avgRank = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.rank, 0) / players.length) : 0;
  const richestPlayer = players.length > 0 ? players.reduce((a, b) => a.coins > b.coins ? a : b) : null;

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
          rewardCoins: coins ? Number(coins) : undefined,
          deleteMode,
        });
      } else {
        await api.adminGrant(auth, {
          playerId: targetId,
          coins: coins ? Number(coins) : 0,
          rankSet: rankSet ? Number(rankSet) : undefined,
          message,
          deleteMode,
        });
      }
      toastSuccess("✅ Action completed successfully!");
      setCoins("");
      setRankSet("");
      setMessage("");
    } catch (err) {
      toastError(err.message);
    }
  };

  const sendMessageOnly = async () => {
    if (!message.trim()) return toastError("Write a message first");
    try {
      await api.adminMessage(auth, { playerId: targetId, message, deleteMode });
      toastSuccess("📨 Message sent successfully!");
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
          <p className="admin-lock-sub">Enter the admin key to manage the game</p>
          <input
            className="auth-input"
            type="password"
            placeholder="Enter admin key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          />
          <Button variant="gold" full onClick={tryUnlock} className="admin-lock-btn">
            Unlock Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header__top">
          <button className="back-link back-link--light" onClick={onBack}>
            ← Back to Game
          </button>
          <button className="admin-analytics-toggle" onClick={() => setShowAnalytics((v) => !v)}>
            📊 {showAnalytics ? "Hide" : "Show"} Analytics
          </button>
        </div>

        {showAnalytics && (
          <div className="admin-analytics-panel">
            <p>
              Vercel Web Analytics is {showAnalytics ? "active" : "inactive"} on this page. It's an invisible tracking beacon —
              it doesn't display charts here. If this app is deployed on Vercel, traffic data shows up at{" "}
              <a href="https://vercel.com/analytics" target="_blank" rel="noreferrer noopener">
                vercel.com/analytics
              </a>{" "}
              under this project.
            </p>
            <Analytics />
          </div>
        )}

        <div className="admin-header__title">
          <span className="admin-header__icon">🛡️</span>
          <div className="admin-header__title-content">
            <h1>Admin Control Room</h1>
            <p>{isSelfAdmin ? `👑 ${player.name} • Account Admin` : "🔑 Administrative Access"}</p>
          </div>
        </div>

        <div className="admin-stats-bar">
          <div className="admin-stat-item">
            <div className="admin-stat-item__value">{players.length}</div>
            <div className="admin-stat-item__label">Total Players</div>
          </div>
          <div className="admin-stat-item">
            <div className="admin-stat-item__value">{player.coins.toLocaleString()}</div>
            <div className="admin-stat-item__label">Total Coins</div>
          </div>
          <div className="admin-stat-item">
            <div className="admin-stat-item__value">{avgRank}</div>
            <div className="admin-stat-item__label">Avg Rank</div>
          </div>
          <div className="admin-stat-item">
            <div className="admin-stat-item__value">{richestPlayer?.name || "-"}</div>
            <div className="admin-stat-item__label">Richest Player</div>
          </div>
        </div>
      </div>

      <div className="admin-grid">
        {/* Player List */}
        <div className="admin-card">
          <div className="admin-card__header">
            <h3>
              👥 Players
              <span className="admin-card__badge">{filteredPlayers.length} / {players.length}</span>
            </h3>
          </div>

          <div className="admin-search-section">
            <input
              className="auth-input admin-search-input"
              placeholder="🔍 Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="admin-filter-row">
              <select value={wealthFilter} onChange={(e) => setWealthFilter(e.target.value)}>
                {WEALTH_TIERS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
              <select value={rankFilter} onChange={(e) => setRankFilter(e.target.value)}>
                {RANK_TIER_FILTERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="admin-select-all">
              <input
                type="checkbox"
                checked={filteredPlayers.length > 0 && filteredPlayers.every((p) => selectedIds.includes(p.id))}
                onChange={(e) => setSelectedIds(e.target.checked ? filteredPlayers.map((p) => p.id) : [])}
              />
              Select all filtered ({selectedIds.length} selected)
            </label>
          </div>

          <div className="admin-player-list">
            <button
              className={`admin-player-row ${targetId === "all" ? "admin-player-row--selected" : ""}`}
              onClick={() => setTargetId("all")}
            >
              <span className="admin-player-row__avatar admin-player-row__avatar--all">🌐</span>
              <div className="admin-player-row__info">
                <span className="admin-player-row__name">Send to Everyone</span>
                <span className="admin-player-row__meta">
                  <span style={{ fontSize: "0.6rem", color: "var(--cream-dim)" }}>
                    Broadcast message to all players
                  </span>
                </span>
              </div>
            </button>

            {filteredPlayers.map((p) => (
              <button
                key={p.id}
                className={`admin-player-row ${targetId === p.id ? "admin-player-row--selected" : ""}`}
                onClick={() => setTargetId(p.id)}
              >
                <input
                  type="checkbox"
                  className="admin-player-row__checkbox"
                  checked={selectedIds.includes(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelected(p.id)}
                />
                <span className="admin-player-row__avatar">{p.name?.[0]?.toUpperCase() || "?"}</span>
                <div className="admin-player-row__info">
                  <span className="admin-player-row__name">
                    {p.name}
                    {p.banned && <span className="admin-player-row__banned-badge">🚫 Banned</span>}
                    {p.isAdmin && <span className="admin-player-row__admin-badge">🛡️ Admin</span>}
                  </span>
                  <span className="admin-player-row__meta">
                    <CoinPill coins={p.coins} />
                    <RankBadge rank={p.rank} size="sm" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Panel */}
        <div className="admin-card">
          <div className="admin-card__header">
            <h3>🎮 Action Center</h3>
          </div>

          <div className="admin-form">
            <div className="admin-form__target">
              <span className="admin-form__target-label">Target:</span>
              <span className="admin-form__target-name">
                {targetId === "all" ? "🌐 Everyone" : target?.name || "Select a player"}
              </span>
            </div>

            <div className="admin-form__field-group">
              <div className="admin-field">
                <label>Grant Coins</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={coins}
                  onChange={(e) => setCoins(e.target.value)}
                />
              </div>
              {targetId !== "all" && (
                <div className="admin-field">
                  <label>Set Rank (1-1000)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="Rank"
                    value={rankSet}
                    onChange={(e) => setRankSet(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="admin-field admin-field--full">
              <label>Message Content</label>
              <textarea
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows="3"
              />
            </div>

            <div className="admin-field admin-field--full">
              <label>Auto-delete After</label>
              <select value={deleteMode} onChange={(e) => setDeleteMode(e.target.value)}>
                {DELETE_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message Preview */}
            {(message || coins || rankSet) && (
              <div className="admin-message-preview">
                <div className="admin-message-preview__label">📋 Preview</div>
                <div className="admin-message-preview__content">
                  {message || (
                    <span className="admin-message-preview__empty">
                      {coins ? `💰 +${coins} coins` : ""}
                      {rankSet ? ` 📈 Set rank to ${rankSet}` : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="admin-actions">
              <Button variant="gold" onClick={grant}>
                🎁 Grant & Send
              </Button>
              <Button variant="ghost" onClick={sendMessageOnly}>
                ✉️ Message Only
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Actions / Danger Zone */}
        <div className="admin-card admin-card--danger">
          <div className="admin-card__header">
            <h3>⚠️ Bulk Actions</h3>
          </div>

          <div className="admin-form">
            <div className="admin-form__target">
              <span className="admin-form__target-label">Acting on:</span>
              <span className="admin-form__target-name">
                {actingOnIds.length === 0
                  ? "Select player(s) or check boxes above"
                  : actingOnIds.length === 1
                  ? players.find((p) => p.id === actingOnIds[0])?.name || actingOnIds[0]
                  : `${actingOnIds.length} players selected`}
              </span>
            </div>

            <div className="admin-form__field-group">
              <div className="admin-field">
                <label>Deduct Coins</label>
                <input type="number" min="0" placeholder="Amount" value={deductAmount} onChange={(e) => setDeductAmount(e.target.value)} />
              </div>
            </div>

            <div className="admin-actions admin-actions--wrap">
              <Button variant="ghost" onClick={handleDeduct}>
                💸 Deduct Coins
              </Button>
              <Button variant="ghost" onClick={() => handleBan(true)}>
                🚫 Ban
              </Button>
              <Button variant="ghost" onClick={() => handleBan(false)}>
                ✅ Unban
              </Button>
              <Button variant="ghost" onClick={handleResetRank}>
                📉 Reset Rank
              </Button>
              <Button variant="ghost" onClick={handleForceFriend} disabled={targetId === "all"}>
                🤝 Add as My Friend
              </Button>
              <Button variant="danger" onClick={handleDeleteAccounts}>
                🗑️ Delete Account(s)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}