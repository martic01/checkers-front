import "./Home.css";

const MENU = [
  { key: "online", label: "Play Online", primary: true },
  { key: "local", label: "Local Multiplayer" },
  { key: "ai", label: "Play vs AI" },
  { key: "levels", label: "Levels" },
  { key: "rules", label: "Rules" },
  { key: "settings", label: "Settings" },
  { key: "stats", label: "Statistics" },
  { key: "about", label: "About" },
];

const MODE_CARDS = [
  {
    key: "online",
    icon: "🌐",
    title: "Online",
    desc: "Challenge players anywhere with peer-synced live matches.",
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
    desc: "Five difficulty levels, from Beginner to Expert.",
  },
];

export default function Home({ onNavigate, playerName }) {
  return (
    <div className="home">
      <div className="home-hero">
        <span className="home-eyebrow">International Draughts</span>
        <h1 className="home-title">Wooden Draughts</h1>
        <p className="home-tagline">Welcome back, {playerName}.</p>
      </div>

      <div className="mode-cards">
        {MODE_CARDS.map((card) => (
          <button key={card.key} className="mode-card" onClick={() => onNavigate(card.key)}>
            <span className="mode-icon">{card.icon}</span>
            <span className="mode-title">{card.title}</span>
            <span className="mode-desc">{card.desc}</span>
          </button>
        ))}
      </div>

      <nav className="home-menu">
        {MENU.map((item) => (
          <button
            key={item.key}
            className={`home-menu-item ${item.primary ? "home-menu-item--primary" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
