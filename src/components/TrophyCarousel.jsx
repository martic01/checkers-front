import { useState } from "react";
import { TROPHY_CATALOG, STRENGTH_META } from "../game/trophyCatalog.js";
import "./TrophyCarousel.css";

export default function TrophyCarousel({ trophies = [], equippedTitle, isOwnProfile, onEquip }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const owned = TROPHY_CATALOG.filter((t) => trophies.includes(t.id));
  const list = expanded ? TROPHY_CATALOG : owned;
  const pageCount = Math.max(1, Math.ceil(list.length / 2));
  const pageItems = list.slice(page * 2, page * 2 + 2);

  const goPage = (dir) => setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir)));

  return (
    <div className="trophy-carousel">
      <div className="trophy-carousel__header">
        <h3 className="profile-section-title">Trophy Case ({owned.length}/{TROPHY_CATALOG.length})</h3>
        <button className="trophy-carousel__toggle" onClick={() => { setExpanded((e) => !e); setPage(0); }}>
          {expanded ? "Show earned only" : "View all"}
        </button>
      </div>

      {list.length === 0 && <p className="friends-empty">No trophies earned yet — go win some games!</p>}

      {list.length > 0 && (
        <div className="trophy-carousel__stage">
          <button className="trophy-carousel__arrow" onClick={() => goPage(-1)} disabled={page === 0}>
            ‹
          </button>

          <div className="trophy-carousel__pair">
            {pageItems.map((t) => {
              const earned = trophies.includes(t.id);
              const meta = STRENGTH_META[t.strength] || STRENGTH_META.bronze;
              const equipped = equippedTitle === t.id;
              return (
                <div
                  key={t.id}
                  className={`trophy-card ${earned ? "trophy-card--earned" : "trophy-card--locked"}`}
                  style={{ "--tier-color": meta.color, "--tier-glow": meta.glow }}
                  title={t.desc}
                >
                  <div className="trophy-card__badge">{earned ? "🏆" : "🔒"}</div>
                  <div className="trophy-card__tier">{meta.label}</div>
                  <div className="trophy-card__label">{t.label}</div>
                  <div className="trophy-card__desc">{t.desc}</div>
                  {earned && t.coinReward && <div className="trophy-card__reward">+{t.coinReward} 🪙 earned</div>}
                  {earned && isOwnProfile && onEquip && (
                    <button
                      className={`trophy-card__equip ${equipped ? "trophy-card__equip--active" : ""}`}
                      onClick={() => onEquip(equipped ? null : t.id)}
                    >
                      {equipped ? "✓ Equipped" : "Equip Title"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button className="trophy-carousel__arrow" onClick={() => goPage(1)} disabled={page >= pageCount - 1}>
            ›
          </button>
        </div>
      )}

      {list.length > 0 && (
        <div className="trophy-carousel__dots">
          {Array.from({ length: pageCount }).map((_, i) => (
            <span key={i} className={`trophy-carousel__dot ${i === page ? "trophy-carousel__dot--active" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
