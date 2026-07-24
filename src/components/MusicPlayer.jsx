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

  const handleEnded = () => {
    if (playlist.length <= 1) {
      // With only one song, trackIndex wraps back to the same value and
      // `track` is the exact same object reference — the play-effect above
      // never re-runs because its dependency didn't change. Restart
      // playback directly here instead, or the "loop" silently stops.
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    setTrackIndex((i) => (i + 1) % playlist.length);
  };

  return <audio ref={audioRef} onEnded={handleEnded} hidden />;
}
