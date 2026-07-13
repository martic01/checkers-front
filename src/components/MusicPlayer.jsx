import { useEffect, useRef, useState } from "react";

// Plays a locally-uploaded playlist (up to 5 songs) in order, looping back
// to the start. Playlist entries only last this browser session since blob
// URLs can't be persisted across reloads — that's expected/documented in
// Settings.
export default function MusicPlayer({ settings, playlist = [] }) {
  const audioRef = useRef(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const hasPlaylist = playlist.length > 0;
  const track = hasPlaylist ? playlist[trackIndex % playlist.length] : null;

  useEffect(() => {
    if (!hasPlaylist) setTrackIndex(0);
  }, [hasPlaylist]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (settings.music !== "OFF" && track?.url) {
      if (audio.src !== track.url) audio.src = track.url;
      audio.volume = 0.35;
      audio.play().catch(() => {
        /* browsers block autoplay until the user interacts once; that's fine */
      });
    } else {
      audio.pause();
    }
  }, [settings.music, track]);

  const handleEnded = () => setTrackIndex((i) => (i + 1) % Math.max(playlist.length, 1));

  return <audio ref={audioRef} onEnded={handleEnded} hidden />;
}
