import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toastError, toastSuccess, confirmDialog } from "../store/uiStore.js";
import { getSocket } from "../api/socket.js";
import Avatar from "./Avatar.jsx";
import { RankBadge } from "./RankBadge.jsx";
import Button from "./Button.jsx";
import { BET_TIERS, isTierUnlocked, formatCoins } from "../game/rank.js";
import "./Friends.css";

export default function Friends({ player, onBack, onChallengeSent }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [onlineMap, setOnlineMap] = useState({});
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [betAmount, setBetAmount] = useState(100);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState([]);

  const load = () => {
    api
      .getFriends(player.id)
      .then(({ friends, requests }) => {
        setFriends(friends);
        setRequests(requests);
        const socket = getSocket();
        socket.emit("presence:check", friends.map((f) => f.id), (map) => setOnlineMap(map || {}));
      })
      .catch(() => toastError("Could not load friends"));
  };

  useEffect(load, [player.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search-as-you-type by name or exact player id.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .searchPlayers(query.trim(), player.id)
        .then(setResults)
        .catch(() => toastError("Search failed"))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query, player.id]);

  const friendIds = new Set(friends.map((f) => f.id));

  const sendRequest = async (target) => {
    try {
      await api.addFriend(player.id, target.id);
      setSentTo((s) => [...s, target.id]);
      toastSuccess(`Friend request sent to ${target.name}`);
    } catch (err) {
      toastError(err.message || "Could not send request");
    }
  };

  const accept = async (requesterId) => {
    await api.acceptFriend(player.id, requesterId).catch(() => toastError("Could not accept request"));
    toastSuccess("Friend added!");
    load();
  };
  const reject = async (requesterId) => {
    await api.rejectFriend(player.id, requesterId).catch(() => {});
    load();
  };
  const remove = async (friendId, name) => {
    const ok = await confirmDialog({ title: `Remove ${name}?`, message: "You can add them again later.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    await api.removeFriend(player.id, friendId).catch(() => toastError("Could not remove friend"));
    load();
  };

  const sendChallenge = () => {
    const socket = getSocket();
    socket.emit(
      "challenge:send",
      { fromId: player.id, fromName: player.name, fromAvatar: player.avatar, toId: challengeTarget.id, betAmount },
      (res) => {
        if (!res?.ok) {
          toastError(res?.error || "Could not send challenge");
          return;
        }
        toastSuccess(`Challenge sent to ${challengeTarget.name}!`);
        onChallengeSent?.({ challengeId: res.challengeId, to: challengeTarget, betAmount });
        setChallengeTarget(null);
      }
    );
  };

  return (
    <div className="panel friends-panel">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>
      <h2 className="screen-title">👥 Friends</h2>

      <div className="friends-section">
        <h3>Find Players</h3>
        <input
          className="auth-input"
          placeholder="Search by name or player ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <p className="friends-empty">Searching…</p>}
        {!searching && query && results.length === 0 && <p className="friends-empty">No players found.</p>}
        {results.map((r) => {
          const already = friendIds.has(r.id);
          const sent = sentTo.includes(r.id);
          return (
            <div key={r.id} className="friend-row">
              <Avatar avatar={r.avatar} size={38} />
              <div className="friend-row__info">
                <span className="friend-row__name">{r.name}</span>
                <RankBadge rank={r.rank} size="sm" />
              </div>
              <div className="friend-row__actions">
                {already ? (
                  <span className="friends-tag">Friends</span>
                ) : sent ? (
                  <span className="friends-tag">Request Sent</span>
                ) : (
                  <Button variant="gold" size="sm" onClick={() => sendRequest(r)}>
                    ➕ Add
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {requests.length > 0 && (
        <div className="friends-section">
          <h3>Requests</h3>
          {requests.map((r) => (
            <div key={r.id} className="friend-row">
              <Avatar avatar={r.avatar} size={38} />
              <span className="friend-row__name">{r.name}</span>
              <div className="friend-row__actions">
                <Button variant="gold" size="sm" onClick={() => accept(r.from)}>
                  Accept
                </Button>
                <Button variant="ghost" size="sm" onClick={() => reject(r.from)}>
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="friends-section">
        <h3>Your Friends ({friends.length})</h3>
        {friends.length === 0 && <p className="friends-empty">No friends yet — search above to add some!</p>}
        {friends.map((f) => (
          <div key={f.id} className="friend-row">
            <span className={`friend-row__presence ${onlineMap[f.id] ? "friend-row__presence--online" : ""}`} />
            <Avatar avatar={f.avatar} size={38} />
            <div className="friend-row__info">
              <span className="friend-row__name">{f.name}</span>
              <RankBadge rank={f.rank} size="sm" />
            </div>
            <div className="friend-row__actions">
              <Button variant="gold" size="sm" disabled={!onlineMap[f.id]} onClick={() => setChallengeTarget(f)}>
                {onlineMap[f.id] ? "Challenge" : "Offline"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(f.id, f.name)}>
                🗑️
              </Button>
            </div>
          </div>
        ))}
      </div>

      {challengeTarget && (
        <div className="modal-overlay" onClick={() => setChallengeTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Challenge {challengeTarget.name}</h3>
            <p>
              Your balance: {formatCoins(player.coins)} 🪙 · Their balance:{" "}
              {challengeTarget.coins != null ? formatCoins(challengeTarget.coins) : "?"} 🪙
            </p>
            <div className="friends-bet-grid">
              {BET_TIERS.slice(0, 8).map((tier) => {
                const theyCanAfford = challengeTarget.coins == null || challengeTarget.coins >= tier;
                const iCanAfford = player.coins >= tier;
                const locked = !isTierUnlocked(tier, player.totalEarnings) || !theyCanAfford || !iCanAfford;
                return (
                  <button
                    key={tier}
                    className={`bet-chip ${betAmount === tier ? "bet-chip--selected" : ""} ${locked ? "bet-chip--locked" : ""}`}
                    disabled={locked}
                    title={!theyCanAfford ? `${challengeTarget.name} can't afford this bet` : ""}
                    onClick={() => setBetAmount(tier)}
                  >
                    {formatCoins(tier)}
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <Button variant="ghost" full onClick={() => setChallengeTarget(null)}>
                Cancel
              </Button>
              <Button variant="gold" full onClick={sendChallenge}>
                Send Challenge
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
