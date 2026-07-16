import { useEffect, useState } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { usePlayerStore } from "../store/playerStore.js";
import GameLoader from "./GameLoader.jsx";
import "./Auth.css";

const appearance = {
  variables: {
    colorPrimary: "#c9a227",
    colorBackground: "transparent",
    colorText: "#f5efe6",
    colorTextSecondary: "rgba(245, 239, 230, 0.6)",
    colorInputBackground: "rgba(0, 0, 0, 0.3)",
    colorInputText: "#f5efe6",
    borderRadius: "10px",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    card: { boxShadow: "none", background: "transparent", width: "100%", padding: 0 },
    header: { display: "none" },
    footer: { background: "transparent" },
    footerActionLink: { color: "#c9a227" },
    socialButtonsBlockButton: { borderColor: "rgba(201, 162, 39, 0.25)" },
    formButtonPrimary: { background: "linear-gradient(135deg, #e8c25c, #c9a227)", color: "#140f0c", boxShadow: "none" },
    dividerLine: { background: "rgba(245, 239, 230, 0.15)" },
    dividerText: { color: "rgba(245, 239, 230, 0.5)" },
  },
};

export default function ClerkAuthScreen() {
  const { isSignedIn, getToken, signOut } = useAuth();
  const clerkSync = usePlayerStore((s) => s.clerkSync);
  const continueAsGuest = usePlayerStore((s) => s.continueAsGuest);
  const [mode, setMode] = useState("register");
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isSignedIn || syncing || syncFailed) return;
    let cancelled = false;
    setSyncing(true);
    getToken()
      .then((token) => clerkSync(token))
      .then((ok) => {
        if (cancelled) return;
        setSyncing(false);
        if (!ok) setSyncFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, attempt]);

  if (isSignedIn && syncFailed) {
    return (
      <div className="auth-screen">
        <div className="panel auth-panel">
          <h1 className="screen-title">Couldn't Finish Signing In</h1>
          <p className="screen-subtitle">Your Clerk login worked, but the game server couldn't sync your account.</p>
          <p className="auth-error" style={{ textAlign: "center", marginBottom: 20 }}>
            This usually means the server's Clerk keys aren't set up yet (check CLERK_SECRET_KEY in the
            backend's .env — see SETUP.md).
          </p>
          <div className="btn-row">
            <button
              className="btn btn--gold"
              onClick={() => {
                setSyncFailed(false);
                setAttempt((a) => a + 1);
              }}
            >
              Retry
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                signOut();
                setSyncFailed(false);
              }}
            >
              Use a Different Sign-In
            </button>
          </div>
          <button className="auth-guest" onClick={continueAsGuest}>
            🎮 Play Offline (Local &amp; vs AI only — no login needed)
          </button>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return <GameLoader label="Setting up your table" />;
  }

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

        <div className="clerk-auth-slot">
          {mode === "register" ? (
            <SignUp routing="virtual" appearance={appearance} />
          ) : (
            <SignIn routing="virtual" appearance={appearance} />
          )}
        </div>

        <button className="auth-guest" onClick={continueAsGuest}>
          🎮 Play Offline (Local &amp; vs AI only — no login needed)
        </button>
      </div>
    </div>
  );
}
