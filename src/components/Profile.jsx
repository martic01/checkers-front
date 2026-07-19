import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Avatar from "./Avatar.jsx";
import AvatarCarousel from "./AvatarCarousel.jsx";
import TrophyCarousel from "./TrophyCarousel.jsx";
import { RankBadge } from "./RankBadge.jsx";
import { formatCoins } from "../game/rank.js";
import { toastError } from "../store/uiStore.js";
import "./Profile.css";

export default function Profile({ target, viewerId, onAvatarChange, onEquipTitle, onUpdateBio, onClose }) {
  const [data, setData] = useState(typeof target === "object" ? target : null);
  const [error, setError] = useState(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");

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
                {(data.country || data.createdAt) && (
                  <div className="profile-meta">
                    {data.country && <span>{data.country}</span>}
                    {data.createdAt && <span>Joined {formatJoinDate(data.createdAt)}</span>}
                  </div>
                )}
              </div>
            </div>

            {editingAvatar && (
              <button className="profile-avatar-done" onClick={() => setEditingAvatar(false)}>
                Done
              </button>
            )}

            {isOwnProfile ? (
              editingBio ? (
                <div className="profile-bio-edit">
                  <input
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 100))}
                    placeholder="Say something about yourself…"
                    maxLength={100}
                    autoFocus
                  />
                  <div className="profile-bio-edit__actions">
                    <button
                      className="profile-bio-edit__save"
                      onClick={() => {
                        onUpdateBio?.(bioDraft.trim());
                        setData((d) => ({ ...d, bio: bioDraft.trim() }));
                        setEditingBio(false);
                      }}
                    >
                      Save
                    </button>
                    <button className="profile-bio-edit__cancel" onClick={() => setEditingBio(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="profile-bio profile-bio--editable"
                  onClick={() => {
                    setBioDraft(data.bio || "");
                    setEditingBio(true);
                  }}
                >
                  {data.bio ? `"${data.bio}"` : "+ Add a short bio"}
                </button>
              )
            ) : (
              data.bio && <p className="profile-bio">"{data.bio}"</p>
            )}

            <div className="profile-stats-grid">
              <Stat label="Wins" value={data.stats?.wins ?? 0} />
              <Stat label="Losses" value={data.stats?.losses ?? 0} />
              <Stat label="Draws" value={data.stats?.draws ?? 0} />
              <Stat label="Games" value={data.stats?.gamesPlayed ?? 0} />
              <Stat label="Win Rate" value={formatWinRate(data.stats)} />
              <Stat label="Trophies" value={(data.trophies || []).length} />
              <Stat label="Best Streak" value={data.stats?.bestWinStreak ?? 0} />
              <Stat label="Lifetime Earnings" value={`${formatCoins(data.totalEarnings || 0)} 🪙`} />
            </div>

            {data.favoriteTheme && (
              <p className="profile-favorite-theme">Favorite board: {formatThemeName(data.favoriteTheme)}</p>
            )}

            <TrophyCarousel
              trophies={data.trophies || []}
              equippedTitle={data.equippedTitle}
              isOwnProfile={isOwnProfile}
              onEquip={async (trophyId) => {
                setData((d) => ({ ...d, equippedTitle: trophyId }));
                if (onEquipTitle) {
                  await onEquipTitle(trophyId);
                } else {
                  try {
                    const updated = await api.equipTitle(data.id, trophyId);
                    setData((d) => ({ ...d, equippedTitle: updated.equippedTitle }));
                  } catch (err) {
                    toastError(err.message || "Could not equip that title");
                  }
                }
              }}
            />
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

function formatWinRate(stats) {
  const games = stats?.gamesPlayed ?? 0;
  if (!games) return "—";
  return `${Math.round(((stats.wins ?? 0) / games) * 100)}%`;
}

function formatJoinDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function formatThemeName(key) {
  return key
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" & ");
}
