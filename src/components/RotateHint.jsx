import { useEffect, useState } from "react";
import "./RotateHint.css";

// iOS Safari doesn't support the Orientation Lock API at all (Android
// Chrome/PWA does, when installed/fullscreen) — so this is best-effort: we
// try to lock, and regardless we show a dismissible hint on small portrait
// screens since we can't force iOS to rotate.
export default function RotateHint() {
  const [dismissed, setDismissed] = useState(false);
  const [isSmallPortrait, setIsSmallPortrait] = useState(false);

  useEffect(() => {
    screen.orientation?.lock?.("landscape").catch(() => {
      /* not supported on this browser/device — that's fine, the hint below covers it */
    });

    const check = () => {
      setIsSmallPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 600);
    };
    check();
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      screen.orientation?.unlock?.();
    };
  }, []);

  if (!isSmallPortrait || dismissed) return null;

  return (
    <div className="rotate-hint" onClick={() => setDismissed(true)}>
      <span className="rotate-hint__icon">📱↻</span>
      <span>Rotate your device to landscape for the best experience</span>
      <button className="rotate-hint__dismiss" onClick={() => setDismissed(true)}>
        ✕
      </button>
    </div>
  );
}
