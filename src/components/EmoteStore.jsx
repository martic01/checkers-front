import { useState } from "react";
import { usePlayerStore } from "../store/playerStore.js";
import { formatCoinsFull } from "../game/rank.js";
import { EMOTE_CATEGORIES, EMOTE_CATALOG, EMOTE_RANK_REQUIREMENTS, getRankEmote } from "../game/emoteCatalog.js";
import EntryEmoteOverlay from "./EntryEmoteOverlay.jsx";
import Carousel from "./Carousel.jsx";
import "./EmoteStore.css";

export default function EmoteStore({ player, onBack }) {
  const purchaseEmote = usePlayerStore((s) => s.purchaseEmote);
  const equipEmote = usePlayerStore((s) => s.equipEmote);
  const [busy, setBusy] = useState(null);
  const [previewQueue, setPreviewQueue] = useState(null);

  const owned = player.ownedEmotes || [];
  const equipped = player.equippedEmoteId || null;
  const rankEmote = getRankEmote(player.rank);

  const previewInfo = {
    name: player.name,
    avatar: player.avatar,
    rank: player.rank,
    wins: player.stats?.wins,
    streak: player.stats?.bestWinStreak,
    quote: player.bio,
  };

  const handlePreview = (emoteDef) => {
    setPreviewQueue([{ emote: emoteDef, info: previewInfo }]);
  };

  const handleBuy = async (emoteId) => {
    setBusy(emoteId);
    await purchaseEmote(emoteId);
    setBusy(null);
  };

  const handleEquip = (emoteId) => {
    equipEmote(emoteId);
  };

  const ownedEmotes = EMOTE_CATALOG.filter((e) => owned.includes(e.id));

  const slides = [
    {
      key: "owned",
      label: "Owned",
      content: (
        <div className="emote-store-section">
          <h3>Your Emotes</h3>
          <p className="emote-store-hint">Emotes you own. Equip one to play it when a match starts.</p>
          <div className="emote-store-grid">
            {rankEmote && (
              <EmoteCard
                name={`Rank #${player.rank} Emote`}
                glow={rankEmote.glow}
                fire={rankEmote.fire}
                owned
                equipped={!equipped}
                onEquip={() => handleEquip(null)}
                onPreview={() => handlePreview({ ...rankEmote, name: null })}
              />
            )}
            {ownedEmotes.map((emote) => {
              const cat = EMOTE_CATEGORIES.find((c) => c.id === emote.category);
              const isEquipped = equipped === emote.id;
              return (
                <EmoteCard
                  key={emote.id}
                  name={emote.name}
                  price={emote.price}
                  glow={cat?.glow}
                  owned
                  equipped={isEquipped}
                  onEquip={() => handleEquip(emote.id)}
                  onPreview={() => handlePreview({ ...cat, id: emote.id, category: cat?.id, effect: emote.effect, intensity: cat?.intensity })}
                />
              );
            })}
          </div>
          {!rankEmote && ownedEmotes.length === 0 && (
            <p className="emote-store-hint">You don't own any emotes yet — browse the categories to buy one.</p>
          )}
        </div>
      ),
    },
    ...EMOTE_CATEGORIES.map((cat) => {
      const rankNeeded = EMOTE_RANK_REQUIREMENTS[cat.id];
      const rankLocked = !!rankNeeded && (!player.rank || player.rank > rankNeeded);
      return {
        key: cat.id,
        label: cat.label,
        content: (
          <div className="emote-store-section">
            <h3>
              {cat.label}{" "}
              <span className="emote-store-price-range">
                {formatCoinsFull(cat.minPrice)}–{cat.maxPrice === Infinity ? "∞" : formatCoinsFull(cat.maxPrice)} 🪙
              </span>
            </h3>
            {rankNeeded && (
              <p className={`emote-store-hint ${rankLocked ? "emote-store-hint--locked" : ""}`}>
                {rankLocked
                  ? `🔒 Only the top ${rankNeeded} players can buy from this tier — you're rank #${player.rank ?? "—"}.`
                  : `Unlocked for top ${rankNeeded} players — you qualify at rank #${player.rank}.`}
              </p>
            )}
            <div className="emote-store-grid">
              {EMOTE_CATALOG.filter((e) => e.category === cat.id).map((emote) => {
                const isOwned = owned.includes(emote.id);
                const isEquipped = equipped === emote.id;
                const canAfford = (player.coins || 0) >= emote.price;
                return (
                  <EmoteCard
                    key={emote.id}
                    name={emote.name}
                    price={emote.price}
                    glow={cat.glow}
                    owned={isOwned}
                    equipped={isEquipped}
                    canAfford={canAfford}
                    locked={!isOwned && rankLocked}
                    lockReason={rankNeeded ? `Top ${rankNeeded} only` : null}
                    busy={busy === emote.id}
                    onBuy={() => handleBuy(emote.id)}
                    onEquip={() => handleEquip(emote.id)}
                    onPreview={() => handlePreview({ ...cat, id: emote.id, category: cat.id, effect: emote.effect, intensity: cat.intensity })}
                  />
                );
              })}
            </div>
          </div>
        ),
      };
    }),
  ];

  return (
    <div className="emote-store-screen">
      <div className="emote-store-panel">
        <button className="back-link" onClick={onBack}>
          ← Back
        </button>
        <h2 className="emote-store-title">Entry Emote Store</h2>
        <p className="emote-store-balance">Your balance: {formatCoinsFull(player.coins || 0)} 🪙</p>

        <Carousel slides={slides} />
      </div>

      {previewQueue && <EntryEmoteOverlay queue={previewQueue} onDone={() => setPreviewQueue(null)} />}
    </div>
  );
}

function EmoteCard({ name, price, glow, owned, equipped, canAfford, busy, locked, lockReason, onBuy, onEquip, onPreview, fire }) {
  return (
    <div className={`emote-card ${fire ? "emote-card--fire" : ""} ${locked ? "emote-card--locked" : ""}`} style={{ "--emote-glow": glow }}>
      <div className="emote-card__swatch" />
      <div className="emote-card__name">{name}</div>
      {price != null && <div className="emote-card__price">{formatCoinsFull(price)} 🪙</div>}
      <div className="emote-card__actions">
        <button className="emote-card__preview" onClick={onPreview}>
          Preview
        </button>
        {owned ? (
          <button className={`emote-card__equip ${equipped ? "emote-card__equip--active" : ""}`} onClick={onEquip} disabled={equipped}>
            {equipped ? "Equipped" : "Equip"}
          </button>
        ) : locked ? (
          <button className="emote-card__buy emote-card__buy--locked" disabled>
            🔒 {lockReason}
          </button>
        ) : (
          <button className="emote-card__buy" onClick={onBuy} disabled={!canAfford || busy}>
            {busy ? "…" : !canAfford ? "Can't afford" : "Buy"}
          </button>
        )}
      </div>
    </div>
  );
}
