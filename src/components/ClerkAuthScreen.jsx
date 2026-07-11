import { useEffect, useState } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { usePlayerStore } from "../store/playerStore.js";
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
    card: { boxShadow: "none", background: "transparent", width: "100%", padding: "0 20px" },
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
  const { isSignedIn, getToken } = useAuth();
  const clerkSync = usePlayerStore((s) => s.clerkSync);
  const [mode, setMode] = useState("register");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isSignedIn || syncing) return;
    setSyncing(true);
    getToken().then((token) => clerkSync(token));
  }, [isSignedIn, syncing, getToken, clerkSync]);

  if (isSignedIn) {
    return <div className="app-loading">Setting up your table…</div>;
  }

  return (
    <div className="auth-screen">
      <div className="panel auth-panel">
        <h1 className="screen-title">Wooden Draughts</h1>
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
      </div>
    </div>
  );
}
