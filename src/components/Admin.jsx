import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toastError, toastSuccess } from "../store/uiStore.js";
import "./Admin.css";

export default function Admin({ player, onBack }) {
  const isSelfAdmin = !!player?.isAdmin;
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("checkers.adminKey") || "");
  const [unlocked, setUnlocked] = useState(isSelfAdmin);
  const [players, setPlayers] = useState([]);
  const [targetId, setTargetId] = useState("all");
  const [coins, setCoins] = useState(0);
  const [rankSet, setRankSet] = useState("");
  const [message, setMessage] = useState("");

  const auth = isSelfAdmin ? { playerId: player.id } : { adminKey };

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
        await api.adminMessage(auth, { playerId: "all", message: message || "You received a reward!", rewardCoins: coins || undefined });
      } else {
        await api.adminGrant(auth, { playerId: targetId, coins: coins || 0, rankSet: rankSet ? Number(rankSet) : undefined, message });
      }
      toastSuccess("Sent!");
      setCoins(0);
      setMessage("");
    } catch (err) {
      toastError(err.message);
    }
  };

  const sendMessageOnly = async () => {
    try {
      await api.adminMessage(auth, { playerId: targetId, message });
      toastSuccess("Message sent!");
      setMessage("");
    } catch (err) {
      toastError(err.message);
    }
  };

  if (!unlocked) {
    return (
      <div className="panel admin-panel">
        <button className="back-link" onClick={onBack}>
          ← Back
        </button>
        <h2 className="screen-title">Admin Access</h2>
        <input
          className="auth-input"
          type="password"
          placeholder="Admin key"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
        />
        <button className="btn btn--gold" style={{ marginTop: 12, width: "100%" }} onClick={tryUnlock}>
          Unlock
        </button>
      </div>
    );
  }

  return (
    <div className="panel admin-panel">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h2 className="screen-title">Admin Panel</h2>
      {isSelfAdmin && <p className="admin-you">Signed in as the account admin ({player.name}).</p>}

      <label className="auth-label">Target Player</label>
      <select className="auth-input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        <option value="all">Everyone</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} (@{p.username || "guest"}) — {p.coins} 🪙, rank #{p.rank}
          </option>
        ))}
      </select>

      <label className="auth-label">Grant Coins</label>
      <input className="auth-input" type="number" value={coins} onChange={(e) => setCoins(Number(e.target.value))} />

      {targetId !== "all" && (
        <>
          <label className="auth-label">Set Rank (1-1000)</label>
          <input className="auth-input" type="number" min={1} max={1000} value={rankSet} onChange={(e) => setRankSet(e.target.value)} />
        </>
      )}

      <label className="auth-label">Message</label>
      <textarea className="auth-input admin-textarea" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />

      <div className="btn-row">
        <button className="btn btn--gold" onClick={grant}>
          Grant Reward
        </button>
        <button className="btn" onClick={sendMessageOnly}>
          Send Message Only
        </button>
      </div>
    </div>
  );
}
