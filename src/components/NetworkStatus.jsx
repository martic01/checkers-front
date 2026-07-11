import { useEffect, useState } from "react";
import "./NetworkStatus.css";

export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setJustChanged(true);
      setTimeout(() => setJustChanged(false), 2500);
    };
    const goOffline = () => {
      setOnline(false);
      setJustChanged(true);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Only draw attention to itself when offline, or briefly after reconnecting.
  if (online && !justChanged) return <span className="network-status network-status--dot-only" title="Connected" />;

  return (
    <div className={`network-status ${online ? "network-status--online" : "network-status--offline"}`}>
      <span className="network-status__dot" />
      {online ? "Back online" : "No connection"}
    </div>
  );
}
