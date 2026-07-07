import { useCallback, useEffect, useState } from "react";
import "./styles/theme.css";
import "./App.css";

import { PlayerProvider, usePlayer } from "./context/PlayerContext.jsx";
import { connectSocket, disconnectSocket, getSocket } from "./api/socket.js";

import Home from "./components/Home.jsx";
import Settings from "./components/Settings.jsx";
import Levels from "./components/Levels.jsx";
import Rules from "./components/Rules.jsx";
import About from "./components/About.jsx";
import Statistics from "./components/Statistics.jsx";
import AiSetup from "./components/AiSetup.jsx";
import OnlineLobby from "./components/OnlineLobby.jsx";
import GameScreen from "./components/GameScreen.jsx";

export default function App() {
  return (
    <PlayerProvider>
      <div data-board-theme="classic-maple" className="app-shell">
        <AppRouter />
      </div>
    </PlayerProvider>
  );
}

function AppRouter() {
  const { player, loading, updateSettings, reportResult } = usePlayer();
  const [screen, setScreen] = useState("home");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiLevel, setAiLevel] = useState(null);
  const [online, setOnline] = useState({ roomCode: null, playerColor: "white", connecting: false, opponentName: "Opponent" });

  const settings = player.settings;

  // Keep the board theme in sync on the root element so every screen
  // (including the settings preview) reflects the chosen wood theme.
  useEffect(() => {
    document.querySelector(".app-shell")?.setAttribute("data-board-theme", settings.theme);
  }, [settings.theme]);

  const navigate = useCallback((next) => setScreen(next), []);

  const handleModeSelect = (mode) => {
    if (mode === "ai") setScreen("ai-setup");
    else if (mode === "local") setScreen("local-game");
    else if (mode === "online") setScreen("online-lobby");
    else navigate(mode);
  };

  const handleGameExit = async (result) => {
    if (result === "win" || result === "loss" || result === "draw") {
      await reportResult({ result, mode: screen.replace("-game", ""), level: aiLevel });
    }
    if (screen === "online-game") {
      disconnectSocket();
      setOnline((o) => ({ ...o, roomCode: null }));
    }
    setScreen("home");
  };

  // --- Online lobby handlers ---
  const handleCreateRoom = () => {
    setOnline((o) => ({ ...o, connecting: true }));
    const socket = connectSocket();
    socket.emit("room:create", { name: player.name }, (res) => {
      if (res?.ok) {
        setOnline({ roomCode: res.code, playerColor: "white", connecting: true, opponentName: "Waiting…" });
        socket.once("room:ready", () => {
          setOnline((o) => ({ ...o, connecting: false, opponentName: "Opponent" }));
          setScreen("online-game");
        });
      }
    });
  };

  const handleJoinRoom = (code) => {
    setOnline((o) => ({ ...o, connecting: true }));
    const socket = connectSocket();
    socket.emit("room:join", { code, name: player.name }, (res) => {
      if (res?.ok) {
        setOnline({ roomCode: code, playerColor: "black", connecting: false, opponentName: "Opponent" });
        setScreen("online-game");
      } else {
        setOnline((o) => ({ ...o, connecting: false }));
        alert(res?.error || "Could not join room");
      }
    });
  };

  if (loading) {
    return <div className="app-loading">Loading the board…</div>;
  }

  switch (screen) {
    case "settings":
      return (
        <Settings
          settings={settings}
          onChange={updateSettings}
          onBack={() => navigate("home")}
          onContactUs={() => alert("Reach us at support@woodendraughts.example")}
          onRate={() => alert("Thanks for playing! Rating is only available on the app store build.")}
        />
      );
    case "levels":
      return (
        <Levels
          unlockedLevels={player.unlockedLevels}
          onSelect={(level) => {
            setAiLevel(level);
            setAiDifficulty(["beginner", "easy", "medium", "hard", "expert"][level - 1]);
            setScreen("ai-game");
          }}
          onBack={() => navigate("home")}
        />
      );
    case "rules":
      return <Rules onBack={() => navigate("home")} />;
    case "about":
      return <About onBack={() => navigate("home")} />;
    case "stats":
      return <Statistics player={player} onBack={() => navigate("home")} />;
    case "ai-setup":
      return (
        <AiSetup
          onSelect={(difficulty) => {
            setAiDifficulty(difficulty);
            setAiLevel(null);
            setScreen("ai-game");
          }}
          onBack={() => navigate("home")}
        />
      );
    case "online-lobby":
      return (
        <OnlineLobby
          connecting={online.connecting}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onQuickMatch={handleCreateRoom}
          onBack={() => navigate("home")}
        />
      );
    case "local-game":
      return (
        <GameScreen
          mode="local"
          settings={settings}
          playerName="White"
          opponentName="Black"
          onExit={handleGameExit}
        />
      );
    case "ai-game":
      return (
        <GameScreen
          mode="ai"
          difficulty={aiDifficulty}
          level={aiLevel}
          settings={settings}
          playerName={player.name}
          opponentName={`AI (${aiDifficulty})`}
          playerColor={settings.playAs === "BLACK" ? "black" : "white"}
          onExit={handleGameExit}
        />
      );
    case "online-game":
      return (
        <GameScreen
          mode="online"
          settings={settings}
          playerName={player.name}
          opponentName={online.opponentName}
          playerColor={online.playerColor}
          socket={getSocket()}
          roomCode={online.roomCode}
          onExit={handleGameExit}
        />
      );
    case "home":
    default:
      return <Home onNavigate={handleModeSelect} playerName={player.name} />;
  }
}
