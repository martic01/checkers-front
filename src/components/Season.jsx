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
  const mins = Math.floor((ms / (1000 * 60)) % 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function Season({ playerId, onBack }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    api
      .getSeasonProgress(playerId)
      .then(setData)
      .catch(() => toastError("Could not load season data"));
  }, [playerId]);

  // Scroll to current tier on load
  useEffect(() => {
    if (!data || !trackRef.current) return;
    const idx = Math.max(0, data.tier || 0);
    const cards = trackRef.current.children;
    if (cards[idx]) {
      cards[idx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [data]);

  const handleClaim = async (reward) => {
    setClaiming(reward.letter);
    try {
      const res = await api.claimSeasonReward(playerId, reward.letter);
      playSound("win", true);
      toastSuccess(`🎉 Claimed: ${reward.label}!`);
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
      <div className="season-wrapper">
        <div className="season-oven season-panel--loading">
          <button className="back-link back-link--light" onClick={onBack}>
            ← Back
          </button>
          <p className="season-loading">✨ Loading season rewards...</p>
        </div>
      </div>
    );
  }

  const track = data.season.rewardTrack;
  const maxMojo = track[track.length - 1].mojoRequired;
  const overallPct = Math.min(100, (data.progress.mojo / maxMojo) * 100);
  const claimedCount = data.progress.claimed.length;
  const totalRewards = track.length;

  return (
    <div className="season-wrapper">
      <div className="season-oven">
        <button className="back-link back-link--light" onClick={onBack}>
          ← Back
        </button>

        <div className="season-hero">
          <span className="season-hero__kicker">🏆 Season {data.season.id}</span>
          <h1 className="season-hero__title">{data.season.name}</h1>
          <p className="season-hero__sub">Earn mojo by playing &amp; winning matches</p>
          <div className="season-hero__meta">
            <span>⚡ {data.progress.mojo} mojo</span>
            <span>⏱ {timeLeft(data.season.endsAt)}</span>
            <span>🎯 {claimedCount}/{totalRewards}</span>
          </div>
        </div>

        <div className="season-track-wrapper">
          <div className="season-track" ref={trackRef}>
            {track.map((reward, i) => {
              const unlocked = data.progress.mojo >= reward.mojoRequired;
              const claimed = data.progress.claimed.includes(reward.id);
              const prevReq = i === 0 ? 0 : track[i - 1].mojoRequired;
              const stepPct = unlocked
                ? 100
                : Math.max(0, Math.min(100, ((data.progress.mojo - prevReq) / (reward.mojoRequired - prevReq)) * 100));

              return (
                <div
                  key={reward.id}
                  className={`season-reward ${unlocked ? "season-reward--unlocked" : ""} ${claimed ? "season-reward--claimed" : ""}`}
                >
                  <div className="season-reward__letter">{reward.letter}</div>
                  <div className="season-reward__icon">{reward.icon}</div>
                  <div className="season-reward__label">{reward.label}</div>
                  <div className="season-reward__mojo">{reward.mojoRequired} mojo</div>
                  
                  <div className="season-reward__bar">
                    <div className="season-reward__bar-fill" style={{ width: `${stepPct}%` }} />
                  </div>
                  <div className="season-reward__pct">{Math.round(stepPct)}%</div>

                  <div className="season-reward__action">
                    {unlocked && !claimed && reward.coinValue > 0 && (
                      <button
                        className="season-reward__claim"
                        onClick={() => handleClaim(reward)}
                        disabled={claiming === reward.letter}
                      >
                        {claiming === reward.letter ? "⏳" : "Claim"}
                      </button>
                    )}
                    {claimed && <span className="season-reward__done">Claimed</span>}
                    {!unlocked && <span className="season-reward__locked-icon">🔒</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="season-overall">
          <div className="season-overall__bar">
            <div className="season-overall__fill" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="season-overall__label">
            <span>⚡ <span className="highlight">{data.progress.mojo}</span> / {maxMojo}</span>
            <span>🎯 <span className="highlight">{claimedCount}</span> / {totalRewards}</span>
            <span>📊 <span className="highlight">{Math.round(overallPct)}%</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}