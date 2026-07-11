import { useEffect, useRef } from "react";

// `localFileUrl` (an object URL from an uploaded file) takes priority over
// a pasted `settings.musicUrl` when present — it only lasts this session
// since blob URLs can't be persisted across reloads.
export default function MusicPlayer({ settings, localFileUrl }) {
  const audioRef = useRef(null);
  const activeSrc = localFileUrl || settings.musicUrl;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (settings.music !== "OFF" && activeSrc) {
      if (audio.src !== activeSrc) audio.src = activeSrc;
      audio.volume = 0.35;
      audio.play().catch(() => {
        /* browsers block autoplay until the user interacts once; that's fine */
      });
    } else {
      audio.pause();
    }
  }, [settings.music, activeSrc]);

  return <audio ref={audioRef} loop hidden />;
}
