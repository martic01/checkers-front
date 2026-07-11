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
        {friends.length === 0 && <p className="friends-empty">No friends yet — add some from their profile!</p>}
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
            <p>Choose a bet amount</p>
            <div className="friends-bet-grid">
              {BET_TIERS.slice(0, 8).map((tier) => (
                <button
                  key={tier}
                  className={`bet-chip ${betAmount === tier ? "bet-chip--selected" : ""} ${!isTierUnlocked(tier, player.totalEarnings) ? "bet-chip--locked" : ""}`}
                  disabled={!isTierUnlocked(tier, player.totalEarnings)}
                  onClick={() => setBetAmount(tier)}
                >
                  {formatCoins(tier)}
                </button>
              ))}
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
