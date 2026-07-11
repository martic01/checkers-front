import { useEffect, useState } from "react";
import { getSocket } from "../api/socket.js";
import { playSound } from "../utils/sound.js";
import "./ChallengePopup.css";

export default function ChallengePopup({ player, soundsOn, onAccepted }) {
  const [challenge, setChallenge] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    const onIncoming = (data) => {
      setChallenge(data);
      setSecondsLeft(Math.round((data.expiresInMs || 120000) / 1000));
      playSound("notify", soundsOn);
    };
    const onExpired = ({ challengeId }) => setChallenge((c) => (c?.challengeId === challengeId ? null : c));
    socket.on("challenge:incoming", onIncoming);
    socket.on("challenge:expired", onExpired);
    return () => {
      socket.off("challenge:incoming", onIncoming);
      socket.off("challenge:expired", onExpired);
    };
  }, [soundsOn]);

  useEffect(() => {
    if (!challenge) return;
    if (secondsLeft <= 0) {
      setChallenge(null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [challenge, secondsLeft]);

  if (!challenge) return null;

  const accept = () => {
    const socket = getSocket();
    socket.emit("challenge:accept", { challengeId: challenge.challengeId, name: player.name, avatar: player.avatar }, (res) => {
      if (res?.ok) onAccepted?.();
    });
    setChallenge(null);
  };

  const reject = () => {
    getSocket().emit("challenge:reject", { challengeId: challenge.challengeId });
    setChallenge(null);
  };

  return (
    <div className="challenge-popup">
      <span className="challenge-popup__text">
        <strong>{challenge.fromName}</strong> challenges you for <strong>{challenge.betAmount} 🪙</strong>
      </span>
      <span className="challenge-popup__timer">{secondsLeft}s</span>
      <button className="challenge-popup__btn challenge-popup__btn--reject" onClick={reject}>
        ✕
      </button>
      <button className="challenge-popup__btn challenge-popup__btn--accept" onClick={accept}>
        ✓
      </button>
    </div>
  );
}
