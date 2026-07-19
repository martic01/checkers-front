import { useEffect, useState } from "react";
import { playSound } from "../utils/sound.js";
import "./Inbox.css";

export default function Inbox({ messages, onClaim, onMarkRead, onClose }) {
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);

  useEffect(() => {
    const unread = messages.filter((m) => !m.readAt).map((m) => m.id);
    if (unread.length) onMarkRead?.(unread);
    // Only run once when the inbox is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaim = async (msg) => {
    setClaimingId(msg.id);
    const reward = await onClaim(msg.id);
    playSound("win", true);
    setJustClaimed({ id: msg.id, reward });
    setClaimingId(null);
    setTimeout(() => setJustClaimed(null), 1400);
  };

  return (
    <div className="inbox-overlay" onClick={onClose}>
      <div className="panel inbox-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="screen-title">Inbox</h2>
        <p className="screen-subtitle">Messages &amp; rewards</p>

        {messages.length === 0 && <p className="inbox-empty">Nothing here yet.</p>}

        <div className="inbox-list">
          {messages
            .slice()
            .reverse()
            .map((msg) => (
              <div key={msg.id} className={`inbox-item ${msg.from === "admin" ? "inbox-item--admin" : ""}`}>
                <div className="inbox-item__from">{msg.from === "admin" ? "🛡 MarticamC" : "📣 System"}</div>
                <div className="inbox-item__msg">{msg.message}</div>
                {msg.reward && (
                  <div className="inbox-item__reward-row">
                    {!msg.claimed ? (
                      <button className="btn btn--gold inbox-claim" onClick={() => handleClaim(msg)} disabled={claimingId === msg.id}>
                        {claimingId === msg.id ? "Claiming…" : `Claim ${msg.reward.coins} 🪙`}
                      </button>
                    ) : (
                      <span className="inbox-claimed">✓ Claimed</span>
                    )}
                    {justClaimed?.id === msg.id && (
                      <span className="reward-burst">+{justClaimed.reward?.coins ?? msg.reward.coins} 🪙</span>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>

        <button className="btn btn--ghost" onClick={onClose} style={{ marginTop: 16, width: "100%" }}>
          Close
        </button>
      </div>
    </div>
  );
}
