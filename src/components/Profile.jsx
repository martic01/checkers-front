import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Avatar from "./Avatar.jsx";
import AvatarCarousel from "./AvatarCarousel.jsx";
import { RankBadge } from "./RankBadge.jsx";
import { formatCoins } from "../game/rank.js";
import { TROPHY_CATALOG } from "../game/trophyCatalog.js";
import "./Profile.css";

export default function Profile({ target, viewerId, onAvatarChange, onClose }) {
  const [data, setData] = useState(typeof target === "object" ? target : null);
  const [error, setError] = useState(null);
  const [editingAvatar, setEditingAvatar] = useState(false);

  const targetId = typeof target === "object" ? target.id : target;
  const isOwnProfile = !!viewerId && viewerId === targetId;

  useEffect(() => {
    if (typeof target === "object") {
      setData(target);
      return;
    }
    api
      .getPublicProfile(target)
      .then(setData)
      .catch(() => setError("Could not load this profile."));
  }, [target]);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {error && <p className="profile-error">{error}</p>}
        {!data && !error && <p className="profile-loading">Loading profile…</p>}

        {data && (
          <>
            <div className="profile-header">
              {editingAvatar ? (
                <AvatarCarousel
                  avatar={data.avatar}
                  onChange={(avatar) => {
                    setData((d) => ({ ...d, avatar }));
                    onAvatarChange?.(avatar);
                  }}
                />
              ) : (
                <button
                  className={`profile-avatar-btn ${isOwnProfile ? "profile-avatar-btn--editable" : ""}`}
                  onClick={() => isOwnProfile && setEditingAvatar(true)}
                >
                  <Avatar avatar={data.avatar} size={72} />
                  {isOwnProfile && <span className="profile-avatar-btn__edit">Edit</span>}
                </button>
              )}
              <div className="profile-header__info">
                <h2>{data.name}</h2>
                <RankBadge rank={data.rank} />
              </div>
            </div>

            {editingAvatar && (
              <button className="profile-avatar-done" onClick={() => setEditingAvatar(false)}>
                Done
              </button>
            )}

            <div className="profile-stats-grid">
              <Stat label="Wins" value={data.stats?.wins ?? 0} />
              <Stat label="Losses" value={data.stats?.losses ?? 0} />
              <Stat label="Draws" value={data.stats?.draws ?? 0} />
              <Stat label="Games" value={data.stats?.gamesPlayed ?? 0} />
              <Stat label="Best Streak" value={data.stats?.bestWinStreak ?? 0} />
              <Stat label="Lifetime Earnings" value={`${formatCoins(data.totalEarnings || 0)} 🪙`} />
            </div>

            <h3 className="profile-section-title">Trophy Case</h3>
            <div className="profile-trophies">
              {TROPHY_CATALOG.map((t) => {
                const earned = data.trophies?.includes(t.id);
                return (
                  <div key={t.id} className={`profile-trophy ${earned ? "profile-trophy--earned" : ""}`} title={t.desc}>
                    <span className="profile-trophy__icon">{earned ? "🏆" : "🔒"}</span>
                    <span className="profile-trophy__label">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="profile-stat">
      <div className="profile-stat__value">{value}</div>
      <div className="profile-stat__label">{label}</div>
    </div>
  );
}
