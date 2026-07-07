import { useEffect, useState } from "react";
import "./OnlineLobby.css";
import { api } from "../api/client.js";

export default function OnlineLobby({ onCreateRoom, onJoinRoom, onQuickMatch, onBack, connecting }) {
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState({ playersOnline: 0, activeMatches: 0 });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.lobby();
        if (!cancelled) setLobby(data);
      } catch {
        /* backend offline: keep last known values */
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="lobby-screen">
      <div className="lobby-panel">
        <h2 className="lobby-title">Online Match</h2>

        <button className="lobby-quick" onClick={onQuickMatch} disabled={connecting}>
          {connecting ? "Searching…" : "Quick Match"}
        </button>

        <div className="lobby-divider">OR</div>

        <div className="lobby-section">
          <h3>Create Room</h3>
          <button className="lobby-btn" onClick={onCreateRoom} disabled={connecting}>
            Generate Room Code
          </button>
        </div>

        <div className="lobby-section">
          <h3>Join Room</h3>
          <div className="lobby-join-row">
            <input
              className="lobby-input"
              placeholder="ENTER CODE"
              maxLength={5}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button className="lobby-btn lobby-btn--gold" onClick={() => onJoinRoom(joinCode)} disabled={!joinCode || connecting}>
              Join
            </button>
          </div>
        </div>

        <div className="lobby-status">
          <span>Players Online: {lobby.playersOnline}</span>
          <span>Active Matches: {lobby.activeMatches}</span>
        </div>

        <button className="lobby-back" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
