import { useEffect, useState } from "react";

// Tracks browser connectivity (navigator.onLine + the window online/offline
// events). Shared by anything that needs to gate an action on having a
// network connection — starting online matchmaking, pausing an active
// match, etc. Note this only reflects the *local* network interface, not
// whether the game server itself is reachable — GameScreen additionally
// listens to the socket's own connect/disconnect for that.
export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return isOnline;
}
