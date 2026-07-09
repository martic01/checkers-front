import { useEffect, useRef } from "react";

export default function MusicPlayer({ settings }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (settings.music !== "OFF" && settings.musicUrl) {
      if (audio.src !== settings.musicUrl) audio.src = settings.musicUrl;
      audio.volume = 0.35;
      audio.play().catch(() => {
        /* browsers block autoplay until the user interacts once; that's fine */
      });
    } else {
      audio.pause();
    }
  }, [settings.music, settings.musicUrl]);

  return <audio ref={audioRef} loop hidden />;
}
