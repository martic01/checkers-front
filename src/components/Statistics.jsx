import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TROPHY_CATALOG } from "../game/trophyCatalog.js";
import Carousel from "./Carousel.jsx";
import "./Statistics.css";

export default function Statistics({ player, onBack }) {
  const { stats, trophies, history } = player;

  const chartData = useMemo(() => {
    let cumulative = 0;
    const points = history.map((h, idx) => {
      if (h.result === "win") cumulative += 1;
      return { game: idx + 1, wins: cumulative };
    });
    return points.length ? points : [{ game: 0, wins: 0 }];
  }, [history]);

  const winRate = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  const slides = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <>
          <div className="stats-grid">
            <StatCard label="Wins" value={stats.wins} accent />
            <StatCard label="Losses" value={stats.losses} />
            <StatCard label="Draws" value={stats.draws} />
            <StatCard label="Win Rate" value={`${winRate}%`} />
            <StatCard label="Games Played" value={stats.gamesPlayed} />
            <StatCard label="Best Streak" value={stats.bestWinStreak} />
          </div>

          <h3 className="stats-subtitle">Progress</h3>
          <div className="stats-chart">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="game" tick={{ fill: "rgba(245,239,230,0.5)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "rgba(245,239,230,0.5)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1c130d", border: "1px solid rgba(201,162,39,0.3)", fontSize: 12 }}
                  labelFormatter={(l) => `Game ${l}`}
                />
                <Line type="monotone" dataKey="wins" stroke="#c9a227" strokeWidth={2} dot={false} name="Cumulative Wins" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ),
    },
    {
      key: "trophies",
      label: "Trophy Room",
      content: (
        <div className="trophy-grid">
          {TROPHY_CATALOG.map((t) => {
            const earned = trophies.includes(t.id);
            return (
              <div key={t.id} className={`trophy ${earned ? "trophy--earned" : "trophy--locked"}`}>
                <span className="trophy-icon">{earned ? "🏆" : "🔒"}</span>
                <span className="trophy-label">{t.label}</span>
                <span className="trophy-desc">{t.desc}</span>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="stats-screen">
      <div className="stats-panel">
        <button className="stats-back" onClick={onBack}>
          Back
        </button>
        <h2 className="stats-title">Statistics</h2>

        <Carousel slides={slides} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
