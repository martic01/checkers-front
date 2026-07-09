import "./Settings.css";
import { usePlayerStore } from "../store/playerStore.js";
import { toastInfo, confirmDialog } from "../store/uiStore.js";

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

export default function Settings({ settings, onChange, onBack, onContactUs, onRate }) {
  const logout = usePlayerStore((s) => s.logout);
  const set = (key) => (value) => onChange({ [key]: value });

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
          <input
            className="settings-music-input"
            placeholder="Paste a background music URL (mp3)…"
            defaultValue={settings.musicUrl}
            onBlur={(e) => set("musicUrl")(e.target.value)}
          />
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
