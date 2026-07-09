import { useRef, useState } from "react";
import { DEFAULT_AVATARS } from "../game/avatars.js";
import { fileToAvatarDataUrl } from "../utils/image.js";
import { toastError } from "../store/uiStore.js";
import "./AvatarCarousel.css";

export default function AvatarCarousel({ avatar, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // The carousel index only matters for browsing presets; if a custom photo
  // is the active avatar, we show that photo regardless of index.
  const presetIndex = avatar?.type === "default" ? DEFAULT_AVATARS.findIndex((a) => a.id === avatar.value) : 0;
  const [index, setIndex] = useState(Math.max(0, presetIndex));

  const isCustom = avatar?.type === "custom" && !!avatar.value;
  const current = DEFAULT_AVATARS[index];

  const step = (dir) => {
    const next = (index + dir + DEFAULT_AVATARS.length) % DEFAULT_AVATARS.length;
    setIndex(next);
    onChange({ type: "default", value: DEFAULT_AVATARS[next].id });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onChange({ type: "custom", value: dataUrl });
    } catch (err) {
      toastError(err.message || "Could not process that photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="avatar-carousel">
      <div className="avatar-carousel__stage">
        <button type="button" className="avatar-carousel__arrow" onClick={() => step(-1)} disabled={isCustom} aria-label="Previous avatar">
          ‹
        </button>

        <div className="avatar-carousel__preview" style={{ background: isCustom ? "#000" : current.bg }}>
          {isCustom ? <img src={avatar.value} alt="Your avatar" /> : <span>{current.emoji}</span>}
          {busy && <div className="avatar-carousel__loading">Processing…</div>}
        </div>

        <button type="button" className="avatar-carousel__arrow" onClick={() => step(1)} disabled={isCustom} aria-label="Next avatar">
          ›
        </button>
      </div>

      <div className="avatar-carousel__dots">
        {DEFAULT_AVATARS.map((a, i) => (
          <span key={a.id} className={`avatar-carousel__dot ${!isCustom && i === index ? "avatar-carousel__dot--active" : ""}`} />
        ))}
      </div>

      <div className="avatar-carousel__actions">
        <button type="button" className="btn btn--ghost avatar-carousel__upload-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          📷 Upload your own photo
        </button>
        {isCustom && (
          <button
            type="button"
            className="avatar-carousel__clear"
            onClick={() => onChange({ type: "default", value: current.id })}
          >
            Use preset instead
          </button>
        )}
        <input type="file" accept="image/*" ref={fileRef} hidden onChange={handleUpload} />
      </div>
    </div>
  );
}
