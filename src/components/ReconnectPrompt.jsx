import { useEffect, useState } from "react";
import { usePlayerStore } from "../store/playerStore.js";
import "./ReconnectPrompt.css";

export default function ReconnectPrompt() {
  const offline = usePlayerStore((s) => s.offline);
  const goToLogin = usePlayerStore((s) => s.goToLogin);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!offline) return;
    const onOnline = () => setShow(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [offline]);

  if (!offline || !show || dismissed) return null;

  return (
    <div className="reconnect-prompt">
      <span className="reconnect-prompt__icon">🌐</span>
      <span className="reconnect-prompt__text">You're back online! Log in to save your progress and play online.</span>
      <button className="reconnect-prompt__btn" onClick={goToLogin}>
        Log In
      </button>
      <button className="reconnect-prompt__dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
