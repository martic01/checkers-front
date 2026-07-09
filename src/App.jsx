import { useCallback, useEffect, useRef, useState } from "react";
import "./styles/theme.css";
import "./App.css";

import { usePlayerStore } from "./store/playerStore.js";
import { toastError, toastSuccess } from "./store/uiStore.js";
import { connectSocket, disconnectSocket, getSocket } from "./api/socket.js";
import { playSound, isSoundEnabled } from "./utils/sound.js";

import Auth from "./components/Auth.jsx";
import Home from "./components/Home.jsx";
import Settings from "./components/Settings.jsx";
import Levels from "./components/Levels.jsx";
import Rules from "./components/Rules.jsx";
import About from "./components/About.jsx";
import Statistics from "./components/Statistics.jsx";
import Season from "./components/Season.jsx";
import Admin from "./components/Admin.jsx";
import Inbox from "./components/Inbox.jsx";
import OnlineLobby from "./components/OnlineLobby.jsx";
import GameScreen from "./components/GameScreen.jsx";
import MusicPlayer from "./components/MusicPlayer.jsx";
import UIOverlay from "./components/UIOverlay.jsx";

const IDLE_ONLINE_STATE = { phase: "idle", betAmount: 0, roomCode: null, opponent: null, playerColor: "white" };

export default function App() {
  const player = usePlayerStore((s) => s.player);
  const init = usePlayerStore((s) => s.init);
  const soundsOn = isSoundEnabled(player?.settings);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div
      data-board-theme={player?.settings?.theme || "classic-maple"}
      className="app-shell"
      onClickCapture={(e) => {
        const btn = e.target.closest("button");
        if (btn) playSound("click", soundsOn);
      }}
    >
      <UIOverlay />
      <AppRouter />
    </div>
  );
}

function AppRouter() {
  const player = usePlayerStore((s) => s.player);
  const loading = usePlayerStore((s) => s.loading);
  const offline = usePlayerStore((s) => s.offline);
  const needsAuth = usePlayerStore((s) => s.needsAuth);
  const authError = usePlayerStore((s) => s.authError);
  const register = usePlayerStore((s) => s.register);
  const login = usePlayerStore((s) => s.login);
  const googleSignIn = usePlayerStore((s) => s.googleSignIn);
  const continueAsGuest = usePlayerStore((s) => s.continueAsGuest);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const reportResult = usePlayerStore((s) => s.reportResult);
  const claimDaily = usePlayerStore((s) => s.claimDaily);
  const claimInboxReward = usePlayerStore((s) => s.claimInboxReward);
  const refreshPlayer = usePlayerStore((s) => s.refreshPlayer);

  const [screen, setScreen] = useState("home");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiLevel, setAiLevel] = useState(null);
  const [online, setOnline] = useState(IDLE_ONLINE_STATE);
  const [showInbox, setShowInbox] = useState(false);
  const dailyClaimedRef = useRef(false);

  const settings = player?.settings;
  const soundsOn = isSoundEnabled(settings);

  // Claim the daily login bonus once per session, right after we know who's logged in.
  useEffect(() => {
    if (!player || offline || dailyClaimedRef.current) return;
    dailyClaimedRef.current = true;
    claimDaily().then((amount) => {
      if (amount) {
        playSound("notify", soundsOn);
        toastSuccess(`🎁 Daily bonus: +${amount} coins!`);
      }
    });
  }, [player, offline, claimDaily, soundsOn]);

  const navigate = useCallback((next) => setScreen(next), []);

  const handleModeSelect = (mode) => {
    if (mode === "ai") setScreen("levels");
    else if (mode === "local") setScreen("local-game");
    else if (mode === "online") setScreen("online-lobby");
    else setScreen(mode);
  };

  const handleGameExit = async (result) => {
    if (result === "win" || result === "loss" || result === "draw") {
      if (screen !== "online-game") {
        await reportResult({ result, mode: screen.replace("-game", ""), level: aiLevel });
      }
    }
    if (screen === "online-game") {
      disconnectSocket();
      setOnline(IDLE_ONLINE_STATE);
    }
    setScreen("home");
  };

  const handleSettled = (payload) => {
    refreshPlayer();
    const sign = payload.coinsDelta >= 0 ? "+" : "";
    toastSuccess(`${sign}${payload.coinsDelta} 🪙 · +${payload.expGain} EXP${payload.newlyEarned?.length ? " · New trophy!" : ""}`);
  };

  // --- Online lobby handlers ---
  const handleQuickMatch = (betAmount) => {
    setOnline({ ...IDLE_ONLINE_STATE, phase: "searching", betAmount });
    const socket = connectSocket();

    const onFound = ({ code, color, opponent, betAmount: bet }) => {
      setOnline({ phase: "matched", betAmount: bet, roomCode: code, opponent, playerColor: color.toLowerCase() });
      setScreen("online-game");
    };
    socket.off("match:found", onFound);
    socket.on("match:found", onFound);

    socket.emit("quickmatch:join", { playerId: player.id, betAmount, name: player.name, avatar: player.avatar }, (res) => {
      if (!res?.ok) {
        toastError(res?.error || "Could not start matchmaking");
        setOnline(IDLE_ONLINE_STATE);
      }
    });
  };

  const handleCancelSearch = (betAmount) => {
    const socket = getSocket();
    socket.emit("quickmatch:cancel", { betAmount });
    socket.emit("room:leave");
    setOnline(IDLE_ONLINE_STATE);
  };

  const handleCreateRoom = (betAmount) => {
    setOnline({ ...IDLE_ONLINE_STATE, phase: "waiting-code", betAmount });
    const socket = connectSocket();

    socket.emit("room:create", { playerId: player.id, name: player.name, avatar: player.avatar, betAmount }, (res) => {
      if (!res?.ok) {
        toastError(res?.error || "Could not create room");
        setOnline(IDLE_ONLINE_STATE);
        return;
      }
      setOnline({ phase: "waiting-code", betAmount, roomCode: res.code, opponent: null, playerColor: "white" });

      socket.once("room:ready", (room) => {
        const opp = room.players.find((p) => p.playerId !== player.id);
        setOnline({
          phase: "matched",
          betAmount: room.betAmount,
          roomCode: res.code,
          opponent: { id: opp?.playerId, name: opp?.name, avatar: opp?.avatar },
          playerColor: "white",
        });
        setScreen("online-game");
      });
    });
  };

  const handleJoinRoom = (code) => {
    setOnline({ ...IDLE_ONLINE_STATE, phase: "waiting-code", roomCode: code });
    const socket = connectSocket();

    socket.emit("room:join", { code, playerId: player.id, name: player.name, avatar: player.avatar }, (res) => {
      if (!res?.ok) {
        toastError(res?.error || "Could not join room");
        setOnline(IDLE_ONLINE_STATE);
        return;
      }
      socket.once("room:ready", (room) => {
        const opp = room.players.find((p) => p.playerId !== player.id);
        setOnline({
          phase: "matched",
          betAmount: room.betAmount,
          roomCode: code,
          opponent: { id: opp?.playerId, name: opp?.name, avatar: opp?.avatar },
          playerColor: "black",
        });
        setScreen("online-game");
      });
    });
  };

  if (loading || !player) {
    if (needsAuth) {
      return <Auth onRegister={register} onLogin={login} onGoogle={googleSignIn} onGuest={continueAsGuest} error={authError} />;
    }
    return <div className="app-loading">Loading the board…</div>;
  }

  return (
    <>
      {settings && <MusicPlayer settings={settings} />}

      {showInbox && <Inbox messages={player.inbox} onClaim={claimInboxReward} onClose={() => setShowInbox(false)} />}

      {renderScreen()}
    </>
  );

  function renderScreen() {
    switch (screen) {
      case "settings":
        return (
          <Settings
            settings={settings}
            onChange={updateSettings}
            onBack={() => navigate("home")}
            onContactUs={() => toastSuccess("Reach us at support@woodendraughts.example")}
            onRate={() => toastSuccess("Thanks for playing! Rating is only available on the app store build.")}
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
      case "season":
        return <Season playerId={player.id} onBack={() => navigate("home")} />;
      case "admin":
        return <Admin onBack={() => navigate("home")} />;
      case "online-lobby":
        return (
          <OnlineLobby
            player={player}
            state={online}
            onQuickMatch={handleQuickMatch}
            onCancelSearch={handleCancelSearch}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onBack={() => navigate("home")}
          />
        );
      case "local-game":
        return <GameScreen mode="local" settings={settings} playerName="White" opponentName="Black" onExit={handleGameExit} />;
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
            opponentName={online.opponent?.name || "Opponent"}
            playerColor={online.playerColor}
            playerId={player.id}
            opponentId={online.opponent?.id}
            betAmount={online.betAmount}
            socket={getSocket()}
            roomCode={online.roomCode}
            onSettled={handleSettled}
            onExit={handleGameExit}
          />
        );
      case "home":
      default:
        return (
          <Home
            onNavigate={handleModeSelect}
            player={player}
            inboxCount={player.inbox?.filter((m) => !m.claimed).length || 0}
            onOpenInbox={() => setShowInbox(true)}
            onOpenAdmin={() => navigate("admin")}
          />
        );
    }
  }
}
