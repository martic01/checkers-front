import { useState } from "react";
import { playSound } from "../utils/sound.js";
import GoogleSignInButton from "./GoogleSignInButton.jsx";
import AvatarCarousel from "./AvatarCarousel.jsx";
import "./Auth.css";

export default function Auth({ onRegister, onLogin, onGoogle, onGuest, error }) {
  const [mode, setMode] = useState("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState({ type: "default", value: "avatar-1" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    playSound("click", true);
    if (mode === "register") {
      await onRegister({ username, password, name: name || username, avatar });
    } else {
      await onLogin({ username, password });
    }
    setBusy(false);
  };

  return (
    <div className="auth-screen">
      <div className="panel auth-panel">
        <h1 className="screen-title">MarCheckers</h1>
        <p className="screen-subtitle">{mode === "register" ? "Create your account" : "Welcome back"}</p>

        <div className="auth-tabs">
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Sign Up
          </button>
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Log In
          </button>
        </div>

        <GoogleSignInButton onCredential={onGoogle} />
        <div className="auth-or-divider">or use a username</div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <label className="auth-label">Display Name</label>
              <input
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shown to opponents"
                maxLength={20}
              />

              <label className="auth-label">Choose an avatar</label>
              <AvatarCarousel avatar={avatar} onChange={setAvatar} />
            </>
          )}

          <label className="auth-label">Username</label>
          <input
            className="auth-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. maple_king"
            autoCapitalize="none"
            required
          />

          <label className="auth-label">Password</label>
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 4 characters"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn--gold auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "register" ? "Create Account" : "Log In"}
          </button>
        </form>

        <button className="auth-guest" onClick={onGuest}>
          🎮 Play Offline (Local &amp; vs AI only — no login needed)
        </button>
      </div>
    </div>
  );
}
