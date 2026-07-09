import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { playSound } from "../utils/sound.js";
import { toastError, toastSuccess } from "../store/uiStore.js";
import "./Season.css";

function timeLeft(endsAt) {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "Ending soon";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  return `${days}d ${hours}h left`;
}

export default function Season({ playerId, onBack }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    api
      .getSeasonProgress(playerId)
      .then(setData)
      .catch(() => toastError("Could not load season data (are you offline?)"));
  }, [playerId]);

  // Auto-scroll the carousel to the player's current tier on load.
  useEffect(() => {
    if (!data || !trackRef.current) return;
    const idx = Math.max(0, data.tier);
    const card = trackRef.current.children[idx];
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [data?.season?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaim = async (reward) => {
    setClaiming(reward.letter);
    try {
      const res = await api.claimSeasonReward(playerId, reward.letter);
      playSound("win", true);
      toastSuccess(`Claimed: ${reward.label}!`);
      setData((prev) => ({
        ...prev,
        progress: { ...prev.progress, claimed: [...prev.progress.claimed, res.reward.id] },
      }));
    } catch {
      toastError("Couldn't claim that reward yet.");
    } finally {
      setClaiming(null);
    }
  };

  if (!data) {
    return (
      <div className="panel season-panel season-panel--loading">
        <button className="back-link" onClick={onBack}>
          ← Back
        </button>
        <p className="season-loading">Loading season…</p>
      </div>
    );
  }

  const track = data.season.rewardTrack;
  const maxMojo = track[track.length - 1].mojoRequired;
  const overallPct = Math.min(100, (data.progress.mojo / maxMojo) * 100);

  return (
    <div className="season-oven">
      <button className="back-link back-link--light" onClick={onBack}>
        ← Back
      </button>

      <div className="season-hero">
        <span className="season-hero__kicker">Season Event</span>
        <h1 className="season-hero__title">🔥 {data.season.name} 🔥</h1>
        <p className="season-hero__sub">Earn mojo by playing &amp; winning to unlock rewards A–Z</p>
        <div className="season-hero__meta">
          <span>⚽ Mojo: {data.progress.mojo}</span>
          <span>⏱ {timeLeft(data.season.endsAt)}</span>
        </div>
      </div>

      <div className="season-carousel" ref={trackRef}>
        {track.map((reward, i) => {
          const unlocked = data.progress.mojo >= reward.mojoRequired;
          const claimed = data.progress.claimed.includes(reward.id);
          const prevReq = i === 0 ? 0 : track[i - 1].mojoRequired;
          const stepPct = unlocked
            ? 100
            : Math.max(0, Math.min(100, ((data.progress.mojo - prevReq) / (reward.mojoRequired - prevReq)) * 100));

          return (
            <div key={reward.id} className={`season-slide ${unlocked ? "season-slide--unlocked" : ""} ${claimed ? "season-slide--claimed" : ""}`}>
              <div className="season-slide__badge">{reward.letter}</div>
              <div className="season-slide__icon">{reward.icon}</div>
              <div className="season-slide__label">{reward.label}</div>
              <div className="season-slide__req">{reward.mojoRequired} mojo</div>

              <div className="season-slide__bar">
                <div className="season-slide__bar-fill" style={{ width: `${stepPct}%` }} />
              </div>

              {unlocked && !claimed && reward.coinValue > 0 && (
                <button className="season-slide__claim" onClick={() => handleClaim(reward)} disabled={claiming === reward.letter}>
                  {claiming === reward.letter ? "…" : "Claim"}
                </button>
              )}
              {claimed && <div className="season-slide__done">✓ Claimed</div>}
            </div>
          );
        })}
      </div>

      <div className="season-overall">
        <div className="season-overall__bar">
          <div className="season-overall__fill" style={{ width: `${overallPct}%` }} />
        </div>
        <div className="season-overall__label">
          {data.progress.mojo} / {maxMojo} mojo · Tier {Math.max(0, data.tier) + 1} of {track.length}
        </div>
      </div>
    </div>
  );
}
