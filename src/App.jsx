import { useCallback, useEffect, useRef, useState } from "react";
import "./styles/theme.css";
import "./App.css";

import { usePlayerStore } from "./store/playerStore.js";
import { toastError, toastSuccess } from "./store/uiStore.js";
import { connectSocket, getSocket } from "./api/socket.js";
import { playSound, isSoundEnabled } from "./utils/sound.js";
import { formatCoinsFull } from "./game/rank.js";

import Auth from "./components/Auth.jsx";
import ClerkAuthScreen from "./components/ClerkAuthScreen.jsx";
import GameLoader from "./components/GameLoader.jsx";
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
import PostGameScreen from "./components/PostGameScreen.jsx";
import OnboardingModal from "./components/OnboardingModal.jsx";
import EmoteStore from "./components/EmoteStore.jsx";
import GameScreen from "./components/GameScreen.jsx";
import MusicPlayer from "./components/MusicPlayer.jsx";
import UIOverlay from "./components/UIOverlay.jsx";
import NetworkStatus from "./components/NetworkStatus.jsx";
import ReconnectPrompt from "./components/ReconnectPrompt.jsx";
import RotateHint from "./components/RotateHint.jsx";
import Friends from "./components/Friends.jsx";
import ChallengePopup from "./components/ChallengePopup.jsx";

const IDLE_ONLINE_STATE = { phase: "idle", betAmount: 0, roomCode: null, opponent: null, playerColor: "white" };
const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
      <NetworkStatus />
      <ReconnectPrompt />
      <AppRouter />
    </div>
  );
}

function AppRouter() {
  const player = usePlayerStore((s) => s.player);
  const loading = usePlayerStore((s) => s.loading);
  const offline = usePlayerStore((s) => s.offline);
  const needsAuth = usePlayerStore((s) => s.needsAuth);
  const backendClerkEnabled = usePlayerStore((s) => s.backendClerkEnabled);
  const authError = usePlayerStore((s) => s.authError);
  const register = usePlayerStore((s) => s.register);
  const login = usePlayerStore((s) => s.login);
  const googleSignIn = usePlayerStore((s) => s.googleSignIn);
  const continueAsGuest = usePlayerStore((s) => s.continueAsGuest);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const reportResult = usePlayerStore((s) => s.reportResult);
  const claimDaily = usePlayerStore((s) => s.claimDaily);
  const claimInboxReward = usePlayerStore((s) => s.claimInboxReward);
  const markInboxRead = usePlayerStore((s) => s.markInboxRead);
  const refreshPlayer = usePlayerStore((s) => s.refreshPlayer);
  const completeOnboarding = usePlayerStore((s) => s.completeOnboarding);

  const [screen, setScreen] = useState("home");
  const [aiDifficulty, setAiDifficulty] = useState(() => localStorage.getItem("checkers.aiDifficulty") || "medium");
  const [aiLevel, setAiLevel] = useState(() => {
    const saved = localStorage.getItem("checkers.aiLevel");
    return saved ? Number(saved) : null;
  });
  const [online, setOnline] = useState(IDLE_ONLINE_STATE);
  const [matchResult, setMatchResult] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [playlist, setPlaylist] = useState([]);
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
        toastSuccess(`🎁 Daily bonus: +${formatCoinsFull(amount)} coins!`);
      }
    });
  }, [player, offline, claimDaily, soundsOn]);

  // Cross-device sync: the store only ever refetches the player record
  // right after *this* device's own actions, so if the same account plays
  // a match on another device, this tab keeps showing stale wins/losses/
  // coins/rank/cosmetics until something here happens to trigger a refetch.
  // Re-sync from the server whenever this tab regains focus/visibility, and
  // periodically while idle in menus, so both devices converge on the same
  // server-truth data instead of one lagging behind. We always take the
  // server's response as-is (never write local state back over it), so this
  // can only pull in newer data, never overwrite it with something older.
  // Paused during an active match so it can't interrupt gameplay.
  const inActiveMatch = screen === "ai-game" || screen === "local-game" || screen === "online-game";
  useEffect(() => {
    if (!player || offline) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !inActiveMatch) refreshPlayer();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(() => {
      if (!inActiveMatch) refreshPlayer();
    }, 60000);
    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(interval);
    };
  }, [player, offline, inActiveMatch, refreshPlayer]);

  // Stay connected in the background (not just inside the online lobby) so
  // friends can see this player's online status and send challenges from
  // anywhere in the app.
  useEffect(() => {
    if (!player || offline) return;
    const socket = connectSocket();
    socket.emit("presence:hello", { playerId: player.id });

    const onFound = ({ code, color, opponent, betAmount: bet, vsBot, aiDifficulty }) => {
      setOnline({ phase: "matched", betAmount: bet, roomCode: code, opponent, playerColor: color.toLowerCase(), vsBot: !!vsBot, aiDifficulty });
      // Give the pairing-reveal screen (opponent avatar + equipped trophy)
      // a few seconds to show before actually dropping into the match.
      setTimeout(() => setScreen("online-game"), 5000);
    };
    socket.on("match:found", onFound);
    return () => socket.off("match:found", onFound);
  }, [player, offline]);

  const navigate = useCallback((next) => setScreen(next), []);

  const handleModeSelect = (mode) => {
    if (mode === "ai") setScreen("levels");
    else if (mode === "local") setScreen("local-game");
    else if (mode === "online") {
      if (offline) {
        toastError("Online play needs an internet connection and an account — log in to play online.");
        return;
      }
      setScreen("online-lobby");
    } else setScreen(mode);
  };

  useEffect(() => {
    if (screen === "post-game" && !matchResult) setScreen("online-lobby");
  }, [screen, matchResult]);

  const handleGameExit = async (result, _winner, destination = "home") => {
    if (result === "win" || result === "loss" || result === "draw") {
      if (screen !== "online-game") {
        await reportResult({ result, mode: screen.replace("-game", ""), level: aiLevel });
      }
    }
    setOnline(IDLE_ONLINE_STATE);
    setScreen(destination === "lobby" ? "online-lobby" : "home");
  };

  // Online match ended (win/loss/draw/forfeit) — hand off to the post-game
  // page instead of dumping the player back to the lobby/home directly.
  const handleMatchEnd = (payload) => {
    setMatchResult(payload);
    setScreen("post-game");
  };

  const handlePostGameQuit = () => {
    setMatchResult(null);
    setOnline(IDLE_ONLINE_STATE);
    setScreen("online-lobby");
  };

  const handleRematchStart = ({ betAmount }) => {
    setOnline((o) => ({ ...o, betAmount }));
    setMatchResult(null);
    setScreen("online-game");
  };

  const handleSettled = (payload) => {
    refreshPlayer();
    const sign = payload.coinsDelta >= 0 ? "+" : "";
    toastSuccess(`${sign}${payload.coinsDelta} 🪙 · +${payload.expGain} EXP${payload.newlyEarned?.length ? " · New trophy!" : ""}`);
  };

  // --- Online lobby handlers ---
  const handleQuickMatch = (betAmount) => {
    if (!navigator.onLine) {
      toastError("You're offline — connect to the internet to play online.");
      return;
    }
    setOnline({ ...IDLE_ONLINE_STATE, phase: "searching", betAmount });
    const socket = connectSocket();

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
    if (!navigator.onLine) {
      toastError("You're offline — connect to the internet to play online.");
      return;
    }
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
          opponent: { id: opp?.playerId, name: opp?.name, avatar: opp?.avatar, rank: opp?.rank, equippedTitle: opp?.equippedTitle, equippedEmoteId: opp?.equippedEmoteId },
          playerColor: "white",
        });
        setTimeout(() => setScreen("online-game"), 5000);
      });
    });
  };

  const handleJoinRoom = (code) => {
    if (!navigator.onLine) {
      toastError("You're offline — connect to the internet to play online.");
      return;
    }
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
          opponent: { id: opp?.playerId, name: opp?.name, avatar: opp?.avatar, rank: opp?.rank, equippedTitle: opp?.equippedTitle, equippedEmoteId: opp?.equippedEmoteId },
          playerColor: "black",
        });
        setTimeout(() => setScreen("online-game"), 5000);
      });
    });
  };

  if (loading || !player) {
    if (needsAuth) {
      // Wait for backend confirmation before committing to the Clerk flow —
      // showing it when only the frontend key is set (but not the backend's
      // CLERK_SECRET_KEY) led straight into a dead-end 501 after signing in.
      if (CLERK_ENABLED && backendClerkEnabled === null) {
        return <GameLoader label="Checking sign-in options" />;
      }
      if (CLERK_ENABLED && backendClerkEnabled) return <ClerkAuthScreen />;
      return <Auth onRegister={register} onLogin={login} onGoogle={googleSignIn} onGuest={continueAsGuest} error={authError} />;
    }
    return <GameLoader label="Setting up the table" />;
  }

  return (
    <>
      {!player.agreedToTermsAt && <OnboardingModal onComplete={completeOnboarding} />}
      {settings && <MusicPlayer settings={settings} playlist={playlist} />}
      {!offline && <ChallengePopup player={player} soundsOn={soundsOn} onAccepted={() => {}} />}

      {showInbox && (
        <Inbox messages={player.inbox} onClaim={claimInboxReward} onMarkRead={markInboxRead} onClose={() => setShowInbox(false)} />
      )}
      {screen.endsWith("-game") && <RotateHint />}

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
            playlist={playlist}
            onPlaylistChange={setPlaylist}
          />
        );
      case "levels":
        return (
          <Levels
            unlockedLevels={player.unlockedLevels}
            onSelect={(level) => {
              setAiLevel(level);
              setAiDifficulty(["beginner", "easy", "medium", "hard", "expert"][level - 1]);
              localStorage.setItem("checkers.aiLevel", level);
              localStorage.setItem("checkers.aiDifficulty", ["beginner", "easy", "medium", "hard", "expert"][level - 1]);
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
        return <Admin player={player} onBack={() => navigate("home")} />;
      case "friends":
        return <Friends player={player} onBack={() => navigate("home")} />;
      case "emotes":
        return <EmoteStore player={player} onBack={() => navigate("home")} />;
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
            playerAvatar={player.avatar}
            opponentName="Opponent"
            playerColor={settings.playAs === "BLACK" ? "black" : "white"}
            playerEquippedTitle={player.equippedTitle}
            onExit={handleGameExit}
          />
        );
      case "online-game":
        return (
          <GameScreen
            mode="online"
            settings={settings}
            playerName={player.name}
            playerAvatar={player.avatar}
            opponentName={online.opponent?.name || "Opponent"}
            opponentAvatar={online.opponent?.avatar}
            playerColor={online.playerColor}
            playerId={player.id}
            opponentId={online.opponent?.id}
            opponentProfile={online.vsBot ? online.opponent : null}
            opponentEmoteInfo={online.opponent}
            player={player}
            aiDifficulty={online.aiDifficulty}
            playerEquippedTitle={player.equippedTitle}
            opponentEquippedTitle={online.opponent?.equippedTitle}
            betAmount={online.betAmount}
            totalEarnings={player.totalEarnings}
            playerCoins={player.coins}
            vsBot={online.vsBot}
            socket={getSocket()}
            roomCode={online.roomCode}
            onSettled={handleSettled}
            onExit={handleGameExit}
            onMatchEnd={handleMatchEnd}
          />
        );
      case "post-game":
        if (!matchResult) return null;
        return (
          <PostGameScreen
            player={player}
            opponent={online.opponent}
            playerEquippedTitle={player.equippedTitle}
            playerColor={online.playerColor}
            vsBot={online.vsBot}
            roomCode={online.roomCode}
            socket={getSocket()}
            matchResult={matchResult}
            totalEarnings={player.totalEarnings}
            playerCoins={player.coins}
            onQuit={handlePostGameQuit}
            onRematchStart={handleRematchStart}
          />
        );
      case "home":
      default:
        return (
          <Home
            onNavigate={handleModeSelect}
            player={player}
            inboxCount={player.inbox?.filter((m) => !m.readAt).length || 0}
            onOpenInbox={() => setShowInbox(true)}
            onOpenAdmin={() => navigate("admin")}
          />
        );
    }
  }
}
