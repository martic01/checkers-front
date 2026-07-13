import { useState } from "react";
import { useUIStore } from "../store/uiStore.js";
import { usePlayerStore } from "../store/playerStore.js";
import Profile from "./Profile.jsx";
import "./UIOverlay.css";

export default function UIOverlay() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);
  const confirmState = useUIStore((s) => s.confirmState);
  const resolveConfirm = useUIStore((s) => s.resolveConfirm);
  const promptState = useUIStore((s) => s.promptState);
  const resolvePrompt = useUIStore((s) => s.resolvePrompt);
  const profileTarget = useUIStore((s) => s.profileTarget);
  const closeProfile = useUIStore((s) => s.closeProfile);
  const viewerId = usePlayerStore((s) => s.player?.id);
  const updateAvatar = usePlayerStore((s) => s.updateAvatar);
  const equipTitle = usePlayerStore((s) => s.equipTitle);

  return (
    <>
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-item--${t.type}`} onClick={() => dismissToast(t.id)}>
            <span className="toast-item__icon">{iconFor(t.type)}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-overlay">
          <div className={`modal-card ${confirmState.tone === "danger" ? "modal-card--danger" : ""}`}>
            <h3>{confirmState.title}</h3>
            {confirmState.message && <p>{confirmState.message}</p>}
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button className="btn btn--gold" onClick={() => resolveConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptState && <PromptModal state={promptState} onResolve={resolvePrompt} />}

      {profileTarget && (
        <Profile
          target={profileTarget}
          viewerId={viewerId}
          onAvatarChange={updateAvatar}
          onEquipTitle={equipTitle}
          onClose={closeProfile}
        />
      )}
    </>
  );
}

function PromptModal({ state, onResolve }) {
  const [value, setValue] = useState(state.defaultValue || "");
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{state.title}</h3>
        {state.message && <p>{state.message}</p>}
        <input
          className="auth-input"
          autoFocus
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onResolve(value)}
        />
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={() => onResolve(null)}>
            Cancel
          </button>
          <button className="btn btn--gold" onClick={() => onResolve(value)}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function iconFor(type) {
  if (type === "error") return "⚠️";
  if (type === "success") return "✅";
  return "ℹ️";
}
