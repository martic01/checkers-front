import { useEffect, useRef, useState } from "react";
import "./Home.css";
import Avatar from "./Avatar.jsx";
import { RankBadge, CoinPill } from "./RankBadge.jsx";
import { openProfile } from "../store/uiStore.js";
import { api } from "../api/client.js";
import TitleMarquee from "./TitleMarquee.jsx";
import { TROPHY_CATALOG } from "../game/trophyCatalog.js";

const CHECKERS_MODE_CARDS = [
  {
    key: "online",
    icon: "🌐",
    title: "Online",
    desc: "Bet coins and challenge players anywhere with live matches.",
  },
  {
    key: "local",
    icon: "🪑",
    title: "Local Multiplayer",
    desc: "Two players, one board, no internet required.",
  },
  {
    key: "ai",
    icon: "♟",
    title: "Play vs AI",
    desc: "Five levels, from Beginner to Expert.",
  },
];

const CHESS_MODE_CARDS = [
  {
    key: "chess-online",
    icon: "🌐",
    title: "Online",
    desc: "Bet coins and challenge players anywhere with live matches.",
  },
  {
    key: "chess-local",
    icon: "🪑",
    title: "Local Multiplayer",
    desc: "Two players, one board, no internet required.",
  },
  {
    key: "chess-ai",
    icon: "♞",
    title: "Play vs AI",
    desc: "Five levels, from Beginner to Expert.",
  },
];

const ICON_NAV = [
  { key: "friends", icon: "👥", label: "Friends" },
  { key: "season", icon: "🏆", label: "Season" },
  { key: "emotes", icon: "✨", label: "Emotes" },
  { key: "rules", icon: "📖", label: "Rules" },
  { key: "settings", icon: "⚙️", label: "Settings" },
  { key: "stats", icon: "📊", label: "Stats" },
  { key: "about", icon: "ℹ️", label: "About" },
];
export default function Home({ onNavigate, player, inboxCount = 0, onOpenInbox, onOpenAdmin }) {
  const tapCount = useRef(0);
  const tapTimer = useRef(null);
  const [playersOnline, setPlayersOnline] = useState(null);
  const [activeGame, setActiveGame] = useState("checkers"); // "checkers" | "chess"

  useEffect(() => {
    let cancelled = false;
    const poll = () => api.lobby().then((d) => !cancelled && setPlayersOnline(d.playersOnline)).catch(() => {});
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Secret admin access: tap the eyebrow text 5 times quickly.
  const handleSecretTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => (tapCount.current = 0), 1200);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      onOpenAdmin();
    }
  };

  return (
    <div className="home">
      <RankBadge rank={player.rank} size="sm" />
      <div className="home-topbar">
        <button className="home-player" onClick={() => openProfile(player)}>
          <Avatar avatar={player.avatar} size={36} />
          <span className="home-player__name">{player.name}</span>
          {player.equippedTitle && (
            <TitleMarquee title={TROPHY_CATALOG.find((t) => t.id === player.equippedTitle)?.label} />
          )}
        </button>
        <div className="home-topbar__right">
          <CoinPill coins={player.coins} />
          
          <button className="home-inbox-btn" onClick={onOpenInbox} aria-label="Inbox">
            📥{inboxCount > 0 && <span className="home-inbox-badge">{inboxCount}</span>}
          </button>
        </div>
      </div>

      <div className="home-hero">
        <span className="home-eyebrow" onClick={handleSecretTap}>
          International Draughts
        </span>
        <h1 className="home-title">MarCheckers</h1>
      </div>

      <div className="game-tabs" role="tablist" aria-label="Game">
        <button
          type="button"
          role="tab"
          aria-selected={activeGame === "checkers"}
          className={`game-tabs__btn ${activeGame === "checkers" ? "game-tabs__btn--active" : ""}`}
          onClick={() => setActiveGame("checkers")}
        >
          Checkers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeGame === "chess"}
          className={`game-tabs__btn ${activeGame === "chess" ? "game-tabs__btn--active" : ""}`}
          onClick={() => setActiveGame("chess")}
        >
          Chess
        </button>
        <span className={`game-tabs__indicator ${activeGame === "chess" ? "game-tabs__indicator--right" : ""}`} />
      </div>

      <div className="mode-cards-viewport">
        <div className={`mode-cards-slider ${activeGame === "chess" ? "mode-cards-slider--chess" : ""}`}>
          <div className="mode-cards">
            {CHECKERS_MODE_CARDS.map((card) => (
              <button key={card.key} className="mode-card" onClick={() => onNavigate(card.key)}>
                <span className="mode-icon">{card.icon}</span>
                <span className="mode-title">{card.title}</span>
                <span className="mode-desc">{card.desc}</span>
                {card.key === "online" && playersOnline !== null && (
                  <span className="mode-card__online-badge">
                    <span className="mode-card__online-dot" />
                    {playersOnline} online
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mode-cards">
            {CHESS_MODE_CARDS.map((card) => (
              <button key={card.key} className="mode-card" onClick={() => onNavigate(card.key)}>
                <span className="mode-icon">{card.icon}</span>
                <span className="mode-title">{card.title}</span>
                <span className="mode-desc">{card.desc}</span>
                {card.key === "chess-online" && playersOnline !== null && (
                  <span className="mode-card__online-badge">
                    <span className="mode-card__online-dot" />
                    {playersOnline} online
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="icon-nav">
        {ICON_NAV.map((item) => (
          <button key={item.key} className="icon-nav-item" onClick={() => onNavigate(item.key)}>
            <span className="icon-nav-item__icon">{item.icon}</span>
            <span className="icon-nav-item__label">{item.label}</span>
          </button>
        ))}
        {player.isAdmin && (
          <button className="icon-nav-item icon-nav-item--admin" onClick={() => onNavigate("admin")}>
            <span className="icon-nav-item__icon">🛡️</span>
            <span className="icon-nav-item__label">Admin</span>
          </button>
        )}
      </nav>
    </div>
  );
}
