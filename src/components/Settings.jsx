import { useRef, useState } from "react";
import "./Settings.css";
import { usePlayerStore } from "../store/playerStore.js";
import { toastInfo, toastError, toastSuccess, confirmDialog } from "../store/uiStore.js";
import { validateAndLoadMusicFile } from "../utils/musicValidation.js";

const THEMES = [
  { key: "classic-maple", label: "Maple & Walnut" },
  { key: "ebony-ivory", label: "Ebony & Ivory" },
  { key: "rosewood-birch", label: "Rosewood & Birch" },
  { key: "slate-cherry", label: "Slate & Cherry" },
];

function OptionRow({ label, options, value, onChange }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <div className="settings-options">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`settings-option ${value === opt.value ? "settings-option--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Settings({ settings, onChange, onBack, onContactUs, onRate, playlist = [], onPlaylistChange }) {
  const logout = usePlayerStore((s) => s.logout);
  const set = (key) => (value) => onChange({ [key]: value });
  const fileInputRef = useRef(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const handleMusicFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (playlist.length >= 5) {
      toastError("Your playlist is full — remove a song first (max 5).");
      return;
    }
    setUploadBusy(true);
    try {
      const url = await validateAndLoadMusicFile(file);
      const track = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, url };
      onPlaylistChange?.([...playlist, track]);
      set("music")("ON");
      toastSuccess(`Added "${file.name}" to your playlist`);
    } catch (err) {
      toastError(err.message);
    } finally {
      setUploadBusy(false);
    }
  };

  const removeTrack = (id) => {
    onPlaylistChange?.(playlist.filter((t) => t.id !== id));
  };

  return (
    <div className="settings-screen">
      <div className="settings-panel">
        <h2 className="settings-title">Settings</h2>

        <Section title="View">
          <OptionRow
            options={[{ value: "HORIZ", label: "Horiz." }, { value: "VERT", label: "Vert." }]}
            value={settings.view}
            onChange={set("view")}
          />
        </Section>

        <Section title="Board Theme">
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`theme-swatch ${settings.theme === t.key ? "theme-swatch--active" : ""}`}
                data-board-theme={t.key}
                onClick={() => set("theme")(t.key)}
              >
                <span className="swatch-preview">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Sounds">
          <OptionRow
            options={[{ value: "ON", label: "On" }, { value: "OFF", label: "Off" }]}
            value={settings.sounds}
            onChange={set("sounds")}
          />
        </Section>

        <Section title="Music">
          <OptionRow
            options={[{ value: "ON", label: "On" }, { value: "OFF", label: "Off" }]}
            value={settings.music}
            onChange={set("music")}
          />

          {playlist.length > 0 && (
            <ul className="playlist-list">
              {playlist.map((track, i) => (
                <li key={track.id} className="playlist-item">
                  <span className="playlist-item__num">{i + 1}</span>
                  <span className="playlist-item__name">{track.name}</span>
                  <button className="playlist-item__remove" onClick={() => removeTrack(track.id)} aria-label="Remove song">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="settings-music-upload">
            <button
              type="button"
              className="settings-linklike"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy || playlist.length >= 5}
            >
              {uploadBusy ? "Checking file…" : playlist.length >= 5 ? "Playlist full (5/5)" : `📁 Add a song (${playlist.length}/5)`}
            </button>
            <span className="settings-music-hint">
              MP3, WAV, OGG, M4A, AAC or FLAC · up to 5 songs · plays in order · this session only
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              hidden
              onChange={handleMusicFile}
            />
          </div>
        </Section>

        <Section title="First Move">
          <OptionRow
            options={[{ value: "WHITE", label: "White" }, { value: "BLACK", label: "Black" }]}
            value={settings.firstMove}
            onChange={set("firstMove")}
          />
        </Section>

        <Section title="Play As">
          <OptionRow
            options={[
              { value: "WHITE", label: "White" },
              { value: "BLACK", label: "Black" },
              { value: "ALTERNATELY", label: "Alt." },
            ]}
            value={settings.playAs}
            onChange={set("playAs")}
          />
        </Section>

        <Section title="Helper">
          <OptionRow
            options={[{ value: "ON", label: "On" }, { value: "OFF", label: "Off" }]}
            value={settings.helper}
            onChange={set("helper")}
          />
        </Section>

        <Section title="Mandatory Jumps">
          <OptionRow
            options={[{ value: "ON", label: "On" }, { value: "OFF", label: "Off" }]}
            value={settings.mandatoryJumps}
            onChange={set("mandatoryJumps")}
          />
        </Section>

        <Section title="Premium">
          <button className="settings-linklike" onClick={() => toastInfo("Premium isn't available in this build yet.")}>
            Remove Ads
          </button>
        </Section>

        <Section title="Support">
          <button className="settings-linklike" onClick={onContactUs}>
            Contact Us
          </button>
        </Section>

        <Section title="Account">
          <button
            className="settings-linklike settings-linklike--danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Log out?",
                message: "You can always sign back in with the same account.",
                confirmLabel: "Log Out",
                tone: "danger",
              });
              if (ok) logout();
            }}
          >
            Log Out
          </button>
        </Section>

        <div className="settings-footer">
          <button className="settings-btn" onClick={onBack}>
            Back
          </button>
          <button className="settings-btn settings-btn--gold" onClick={onRate}>
            Rate
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  );
}
