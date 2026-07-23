import { useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";
import { RankBadge } from "./RankBadge.jsx";
import { playSound, speakQuote, cancelSpeech } from "../utils/sound.js";
import "./EntryEmoteOverlay.css";

// `queue`: array of { emote, info: { name, avatar, rank, wins, streak, quote } }
// `soundsOn`: whether sound effects are enabled (defaults on so store previews still play).
//
// If both players have an emote queued, they play together side by side —
// a "clash" — instead of one after another. Epic-tier quotes are still
// read aloud one at a time (staggered) so the two voices never overlap.
export default function EntryEmoteOverlay({ queue, onDone, soundsOn = true }) {
  const isClash = queue.length === 2;
  const [index, setIndex] = useState(0);
  const current = !isClash ? queue[index] : null;

  // Sequential mode (0 or 1 emote queued): advance/finish on a timer.
  useEffect(() => {
    if (isClash) return;
    if (!current) {
      onDone?.();
      return;
    }
    const ms = current.emote.maxDurationS * 1000;
    const t = setTimeout(() => setIndex((i) => i + 1), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isClash]);

  // Clash mode: both play together for as long as the longer of the two needs.
  useEffect(() => {
    if (!isClash) return;
    const ms = Math.max(...queue.map((q) => q.emote.maxDurationS)) * 1000;
    const t = setTimeout(() => onDone?.(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClash]);

  // Sound + speech — sequential mode.
  useEffect(() => {
    if (isClash || !current) return;
    if (current.emote.category === "epic") {
      playSound("epicEmote", soundsOn);
      speakQuote(current.info?.quote, { enabled: soundsOn });
    }
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isClash]);

  // Sound + staggered speech — clash mode. Every Epic side gets its bang
  // sound at once (that's the clash), but quotes are read one at a time.
  useEffect(() => {
    if (!isClash) return;
    const epics = queue.filter((q) => q.emote.category === "epic");
    epics.forEach(() => playSound("epicEmote", soundsOn));
    epics
      .filter((q) => q.info?.quote)
      .forEach((q, i) => speakQuote(q.info.quote, { enabled: soundsOn, delayMs: i * 3800 }));
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClash]);

  if (queue.length === 0) return null;
  if (!isClash && !current) return null;

  const handleSkip = () => {
    cancelSpeech();
    if (isClash) onDone?.();
    else setIndex(queue.length);
  };

  if (isClash) {
    return (
      <div className="entry-emote-overlay entry-emote-overlay--clash">
        <div className="entry-emote-clash">
          {queue.map((item, i) => (
            <EmoteVisual key={i} item={item} compact />
          ))}
          <div className="entry-emote-clash__spark" />
        </div>
        <button className="entry-emote-skip entry-emote-skip--clash" onClick={handleSkip} aria-label="Skip emotes">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="entry-emote-overlay">
      <EmoteVisual item={current} onSkip={handleSkip} />
    </div>
  );
}

function EmoteVisual({ item, compact, onSkip }) {
  const { emote, info } = item;
  const content = emote.content || [];
  const effect = emote.effect || "spark";
  const intensity = emote.intensity || 1;

  return (
    <div className={`entry-emote-stage ${compact ? "entry-emote-stage--compact" : ""}`} style={{ "--fx-intensity": intensity }}>
      <div className={`entry-emote-bang entry-emote-bang--${effect}`} style={{ "--emote-glow": emote.glow || "#d9b34d" }} />

      <div
        className={`entry-emote-card ${emote.fire ? "entry-emote-card--fire" : `entry-emote-card--${effect}`}`}
        style={{ "--emote-glow": emote.glow || "#d9b34d", animationDuration: `${emote.maxDurationS}s` }}
      >
        {content.includes("pic") && (
          <div className="entry-emote-card__avatar">
            <Avatar avatar={info.avatar} size={compact ? 54 : 72} />
          </div>
        )}
        {content.includes("name") && <div className="entry-emote-card__name">{info.name}</div>}
        {content.includes("rank") && typeof info.rank === "number" && (
          <RankBadge rank={info.rank} size="sm" />
        )}
        {content.includes("quote") && info.quote && <div className="entry-emote-card__quote">"{info.quote}"</div>}
        {(content.includes("wins") || content.includes("streak")) && (
          <div className="entry-emote-card__stats">
            {content.includes("wins") && <span>🏆 {info.wins ?? 0} wins</span>}
            {content.includes("streak") && <span>🔥 {info.streak ?? 0} streak</span>}
          </div>
        )}
        {content.length === 0 && <div className="entry-emote-card__spark" />}
      </div>

      {onSkip && (
        <button className="entry-emote-skip" onClick={onSkip} aria-label="Skip emote">
          ✕
        </button>
      )}
    </div>
  );
}
