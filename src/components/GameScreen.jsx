import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board.jsx";
import GameHUD from "./GameHUD.jsx";
import ChatPanel from "./ChatPanel.jsx";
import CoinBurst from "./CoinBurst.jsx";
import {
  createInitialBoard,
  boardToPieces,
  getAllMoves,
  applyMove,
  getWinner,
  createFmjdTracker,
  updateFmjdTracker,
  fmjdReasonMessage,
  BOARD_SIZE,
  WHITE,
  BLACK,
} from "../game/checkersLogic.js";
import { getAiMove, aiRandomDecision } from "../game/ai.js";
import { detectChatSituations, maybeGetBotLine, BOT_CHAT_COOLDOWN_MOVES } from "../game/botChat.js";
import { resolveEquippedEmote } from "../game/emoteCatalog.js";
import { api } from "../api/client.js";
import { usePlayerStore } from "../store/playerStore.js";
import EntryEmoteOverlay from "./EntryEmoteOverlay.jsx";
import { playSound, isSoundEnabled } from "../utils/sound.js";
import { confirmDialog, toastError, toastInfo } from "../store/uiStore.js";
import { formatCoinsFull } from "../game/rank.js";
import Button from "./Button.jsx";
import "./GameScreen.css";

// How long the slide animation takes before the turn actually advances.
const MOVE_ANIMATION_MS = 620;
// Captures get their own (longer) duration — the fall/shrink animation
// deserves room to breathe so players can actually watch it land, without
// slowing down ordinary non-capturing slides.
const CAPTURE_ANIMATION_MS = 950;

function formatNetworkCountdown(deadline) {
  const remaining = Math.max(0, deadline - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function GameScreen({
  mode, // 'ai' | 'local' | 'online'
  difficulty = "medium",
  level = null,
  settings,
  playerName,
  playerAvatar,
  opponentName,
  opponentAvatar,
  playerColor: fixedPlayerColor,
  playerId,
  opponentId,
  opponentProfile,
  opponentEmoteInfo,
  player,
  playerEquippedTitle,
  opponentEquippedTitle,
  betAmount: initialBetAmount = 0,
  totalEarnings = 0,
  playerCoins = 0,
  socket,
  roomCode,
  vsBot = false,
  aiDifficulty: onlineAiDifficulty,
  onSettled, // ({ result, coinsDelta, newlyEarned, ... }) => void
  onExit, // (result, winner, destination) => void
  onMatchEnd, // (payload) => void — online only, fired once when gameOver is set
}) {
  const [board, setBoard] = useState(createInitialBoard);
  const [pieces, setPieces] = useState(() => boardToPieces(createInitialBoard()));
  const [turn, setTurn] = useState(settings.firstMove === "BLACK" ? BLACK : WHITE);
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showCoinBurst, setShowCoinBurst] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [reviewingBoard, setReviewingBoard] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [connStatus, setConnStatus] = useState({ player: "connected", opponent: "connecting" });
  // Network-loss handling: networkPaused = MY OWN socket dropped;
  // opponentNetworkLost = the other side's did. Either pauses the match —
  // moves aren't safe to make (or receive) mid-drop — until it's restored
  // or the server's grace period times out and voids the match.
  const [networkPaused, setNetworkPaused] = useState(false);
  const [opponentNetworkLost, setOpponentNetworkLost] = useState(false);
  const [networkDeadline, setNetworkDeadline] = useState(null);
  const [, setNetworkTick] = useState(0);
  useEffect(() => {
    if (!networkPaused && !opponentNetworkLost) return;
    const id = setInterval(() => setNetworkTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [networkPaused, opponentNetworkLost]);

  const [betAmount, setBetAmount] = useState(initialBetAmount);
  const [scores, setScores] = useState({});

  // Mid-game draw proposal — mutual-agreement offers (online only), separate
  // from the automatic FMJD rules tracked below. { from: 'me' | 'them' } | null
  const [drawOffer, setDrawOffer] = useState(null);

  // Automatic FMJD draw rules get a second chance before ending the match:
  // the first time a rule condition is hit, show a warning with a choice
  // instead of ending immediately. If the same condition fires again after
  // "Continue" was picked, it's final — drawGraceGiven tracks which reasons
  // have already used up their one warning.
  const [drawWarning, setDrawWarning] = useState(null); // reason string | null
  const drawGraceGiven = useRef(new Set());

  // Entry emotes — built once when the match starts, played over the board.
  // Fetches the opponent's full public profile first (real opponents only —
  // bot profiles already come with everything) so milestone emotes based on
  // lifetime earnings, and the wins/streak/quote fields, have real data.
  //
  // emoteQueueReady guards against a real bug: emoteQueue starts as [], and
  // EntryEmoteOverlay treats an empty queue as "nothing to play" and calls
  // onDone immediately. Without this flag, the overlay would dismiss itself
  // before the async fetch below ever populated the real queue — so no
  // emote ever appeared to play, for either side.
  const [emoteQueue, setEmoteQueue] = useState([]);
  const [emoteQueueReady, setEmoteQueueReady] = useState(false);
  const [emotesShowing, setEmotesShowing] = useState(mode === "online");
  useEffect(() => {
    if (mode !== "online") return;
    let cancelled = false;
    (async () => {
      const items = [];
      if (player) {
        const mine = resolveEquippedEmote({
          equippedEmoteId: player.equippedEmoteId,
          rank: player.rank,
          totalEarnings: player.totalEarnings ?? totalEarnings,
        });
        if (mine) {
          items.push({
            emote: mine,
            info: {
              name: playerName,
              avatar: player.avatar,
              rank: player.rank,
              wins: player.stats?.wins,
              streak: player.stats?.bestWinStreak,
              quote: player.bio,
            },
          });
        }
      }
      if (opponentEmoteInfo) {
        let oppInfo = opponentEmoteInfo;
        if (!vsBot && opponentEmoteInfo.id) {
          try {
            const full = await api.getPublicProfile(opponentEmoteInfo.id);
            oppInfo = { ...opponentEmoteInfo, ...full };
          } catch {
            // Offline or profile fetch failed — fall back to the thin info
            // we already have from the match-found payload.
          }
        }
        const theirs = resolveEquippedEmote({
          equippedEmoteId: oppInfo.equippedEmoteId,
          rank: oppInfo.rank,
          totalEarnings: oppInfo.totalEarnings ?? 0,
        });
        if (theirs) {
          items.push({
            emote: theirs,
            info: {
              name: oppInfo.name || opponentName,
              avatar: oppInfo.avatar,
              rank: oppInfo.rank,
              wins: oppInfo.stats?.wins,
              streak: oppInfo.stats?.bestWinStreak,
              quote: oppInfo.bio,
            },
          });
        }
      }
      if (!cancelled) {
        setEmoteQueue(items);
        setEmoteQueueReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soundsOn = isSoundEnabled(settings);
  const animTimer = useRef(null);
  const fmjdTracker = useRef(createFmjdTracker());
  useEffect(() => () => clearTimeout(animTimer.current), []);

  // ---------- AI chat (#3) ----------
  // The bot has no real socket connection, so it "speaks" by having this
  // client (the human's own) emit chat:message on its behalf — the server
  // relays chat to the whole room including the sender, so it shows up in
  // the same chat UI exactly like a real opponent's message would.
  const botPersonality = opponentProfile?.personality || "friendly";
  const botWasBehindRef = useRef(false);
  const botMoveCountRef = useRef(0);
  const botLastSpokeMoveRef = useRef(-BOT_CHAT_COOLDOWN_MOVES);
  const botRecentLinesRef = useRef([]);

  const maybeBotChat = useCallback(
    (situations) => {
      if (mode !== "online" || !vsBot || !socket || situations.length === 0) return;
      botMoveCountRef.current += 1;
      if (botMoveCountRef.current - botLastSpokeMoveRef.current < BOT_CHAT_COOLDOWN_MOVES) return;
      const situation = situations[Math.floor(Math.random() * situations.length)];
      const recent = new Set(botRecentLinesRef.current);
      const line = maybeGetBotLine(situation, botPersonality, recent);
      if (!line) return;
      botLastSpokeMoveRef.current = botMoveCountRef.current;
      botRecentLinesRef.current = [...botRecentLinesRef.current, line].slice(-4);
      setTimeout(() => {
        socket.emit("chat:message", { code: roomCode, text: line, from: opponentName });
      }, 500 + Math.random() * 1500);
    },
    [mode, vsBot, socket, roomCode, opponentName, botPersonality]
  );

  useEffect(() => {
    if (mode !== "online" || !vsBot || !socket) return;
    const t = setTimeout(() => {
      const line = maybeGetBotLine("start", botPersonality);
      if (line) socket.emit("chat:message", { code: roomCode, text: line, from: opponentName });
    }, 1500 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [mode, vsBot, socket, roomCode, opponentName, botPersonality]);

  // Refreshing or closing the tab mid-match would strand the opponent and
  // forfeit the bet, so warn loudly (browsers only allow the native prompt,
  // not a custom message, but this still blocks accidental refreshes).
  useEffect(() => {
    if (mode !== "online") return;
    const handler = (e) => {
      if (gameOver) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, gameOver]);

  const mandatoryJumps = settings.mandatoryJumps !== "OFF";
  const playerColor = mode === "online" ? fixedPlayerColor : mode === "local" ? turn : fixedPlayerColor || WHITE;
  const aiColor = playerColor === WHITE ? BLACK : WHITE;

  const legalMoves = useMemo(() => getAllMoves(board, turn, mandatoryJumps), [board, turn, mandatoryJumps]);

  // Restrict interactive moves to the color the local human may currently play.
  const interactiveMoves = useMemo(
    () => (mode === "local" ? legalMoves : turn === playerColor ? legalMoves : []),
    [mode, legalMoves, turn, playerColor]
  );

  const networkTrouble = mode === "online" && (networkPaused || opponentNetworkLost);
  const isDisabled = isAnimating || gameOver !== null || interactiveMoves.length === 0 || networkTrouble || !!drawWarning;

  function finishGame(winner) {
    let result;
    if (mode === "ai" || mode === "online") {
      result = winner === playerColor ? "win" : "loss";
    } else {
      result = `${winner} wins`;
    }
    setGameOver({ winner, result, forfeit: false });
    playSound(mode !== "local" && winner !== playerColor ? "gameEndLose" : "gameEndWin", soundsOn);

    if (mode === "online" && winner === playerColor && betAmount > 0) {
      setShowCoinBurst(true);
      setTimeout(() => setShowCoinBurst(false), 1300);
    }

    if (mode === "online" && socket) {
      const winnerId = winner === playerColor ? playerId : opponentId;
      socket.emit("game:result", { code: roomCode, winnerId });
    }
  }

  function finishDraw(reason = "agreement") {
    setGameOver({ winner: null, result: "draw", forfeit: false, reason });
    setDrawOffer(null);
    setDrawWarning(null);
    playSound("gameEndDraw", soundsOn);

    // Server settles both sides' stats/coins for online draws; it's safe for
    // both clients to emit since the server no-ops once a room is settled.
    if (mode === "online" && socket) {
      socket.emit("game:result", { code: roomCode, winnerId: null });
    }
  }

  // Mutual-agreement draw offer — online matches only, available at any
  // point in the match (not gated by board state). Separate from the
  // automatic FMJD rules, which end the match on their own with no
  // confirmation needed from either side.
  function proposeDraw() {
    if (!socket) return;
    socket.emit("draw:offer", { code: roomCode });
    setDrawOffer({ from: "me" });
    if (vsBot) {
      const delay = 1200 + Math.random() * 1800;
      setTimeout(() => {
        if (aiRandomDecision()) {
          socket.emit("draw:accept", { code: roomCode });
        } else {
          socket.emit("draw:decline", { code: roomCode });
          setDrawOffer(null);
          toastInfo("Opponent declined the draw.");
        }
      }, delay);
    }
  }
  const acceptDraw = () => socket?.emit("draw:accept", { code: roomCode });
  const declineDraw = () => {
    socket?.emit("draw:decline", { code: roomCode });
    setDrawOffer(null);
  };

  // Dramatic game-end banner — a bold status card shown on the board the
  // instant the match ends. Online matches hand off to the rematch lobby
  // only after it's had its ~3s moment; local/ai just reveal the normal
  // game-over card once it clears.
  const GAME_END_BANNER_MS = 3000;
  const [showEndBanner, setShowEndBanner] = useState(false);
  useEffect(() => {
    if (!gameOver) return;
    setShowEndBanner(true);
    const t = setTimeout(() => setShowEndBanner(false), GAME_END_BANNER_MS);
    return () => clearTimeout(t);
  }, [gameOver]);

  useEffect(() => {
    if (mode === "online" && gameOver) {
      const t = setTimeout(() => {
        onMatchEnd?.({ ...gameOver, betAmount, scores });
      }, GAME_END_BANNER_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // Online: server-driven events (settlement, forfeit, draw handshake).
  useEffect(() => {
    if (mode !== "online" || !socket) return;

    const onSettledEvent = (payload) => {
      if (payload.scores) setScores(payload.scores);
      onSettled?.(payload);
    };

    // Opponent quit mid-match: we're auto-declared the winner and the pot
    // and coin animation land immediately. The post-game page (reached via
    // the hand-off effect above) shows this as a forfeit win with no
    // rematch offered, since there's no one left to rematch.
    const onForfeit = (payload) => {
      if (payload.scores) setScores(payload.scores);
      setGameOver({ winner: playerColor, result: "win", forfeit: true });
      playSound("win", soundsOn);
      setShowCoinBurst(true);
      setTimeout(() => setShowCoinBurst(false), 1300);
      onSettled?.(payload);
    };

    const onDrawOffered = () => {
      setDrawOffer({ from: "them" });
      playSound("notify", soundsOn);
    };
    const onDrawAgreed = () => finishDraw();
    const onDrawDeclined = () => {
      setDrawOffer(null);
      toastInfo("Opponent declined the draw.");
    };

    socket.on("game:settled", onSettledEvent);
    socket.on("opponent:forfeit", onForfeit);
    socket.on("draw:offered", onDrawOffered);
    socket.on("draw:agreed", onDrawAgreed);
    socket.on("draw:declined", onDrawDeclined);
    return () => {
      socket.off("game:settled", onSettledEvent);
      socket.off("opponent:forfeit", onForfeit);
      socket.off("draw:offered", onDrawOffered);
      socket.off("draw:agreed", onDrawAgreed);
      socket.off("draw:declined", onDrawDeclined);
    };
  }, [mode, socket, onSettled, playerColor, soundsOn, settings.firstMove, onExit, roomCode, opponentName]);

  const commitMove = useCallback(
    (move) => {
      playSound(move.captures.length > 0 ? "capture" : "move", soundsOn);

      // Snapshot current state for Undo before mutating anything.
      setHistory((h) => [...h, { board, turn, pieces }]);
      setLastMove(move);
      setIsAnimating(true);

      // Move the piece and flag any captured pieces so they can play their
      // fade/shrink animation before actually leaving the board.
      setPieces((prev) => {
        const movingIndex = prev.findIndex(
          (p) => !p.capturing && p.row === move.from.row && p.col === move.from.col
        );
        return prev.map((p, idx) => {
          if (idx === movingIndex) {
            const promoted =
              !p.king && (p.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1);
            return { ...p, row: move.to.row, col: move.to.col, king: p.king || promoted };
          }
          const wasCaptured = move.captures.some((c) => c.row === p.row && c.col === p.col);
          return wasCaptured ? { ...p, capturing: true } : p;
        });
      });

      const nextBoard = applyMove(board, move);
      const nextTurn = turn === WHITE ? BLACK : WHITE;
      const animMs = move.captures.length > 0 ? CAPTURE_ANIMATION_MS : MOVE_ANIMATION_MS;
      const kingedUp = pieces.some(
        (p) =>
          p.row === move.from.row &&
          p.col === move.from.col &&
          !p.king &&
          (p.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1)
      );
      if (kingedUp) {
        setTimeout(() => playSound("king", soundsOn), animMs * 0.5);
      }

      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => {
        setPieces((prev) => prev.filter((p) => !p.capturing));
        setBoard(nextBoard);
        setTurn(nextTurn);
        setIsAnimating(false);

        const winner = getWinner(nextBoard, nextTurn, mandatoryJumps);
        if (winner) {
          finishGame(winner);
          return;
        }

        const movedPiece = board[move.from.row][move.from.col];
        const { tracker, reason } = updateFmjdTracker(fmjdTracker.current, {
          hadCapture: move.captures.length > 0,
          pieceWasKing: !!movedPiece?.king,
          promoted: kingedUp,
          nextBoard,
          nextTurn,
        });
        fmjdTracker.current = tracker;
        if (reason) {
          if (drawGraceGiven.current.has(reason)) {
            // Already warned once for this exact rule — it happened again,
            // so it's final.
            finishDraw(reason);
          } else {
            // First time this rule condition is hit — give both the
            // explanation and a choice instead of ending immediately.
            drawGraceGiven.current.add(reason);
            setDrawWarning(reason);
          }
          return;
        }

        if (mode === "online" && vsBot) {
          const situations = detectChatSituations({
            move,
            boardAfter: nextBoard,
            moverColor: turn,
            botColor: aiColor,
            mandatoryJumps,
            wasBehindRef: botWasBehindRef,
            promoted: kingedUp,
          });
          maybeBotChat(situations);
        }
      }, animMs);
    },
    [board, turn, pieces, mandatoryJumps, soundsOn] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Player-initiated move (click on the board).
  const handlePlayerMove = useCallback(
    (move) => {
      if (isDisabled) return;
      commitMove(move);
      if (mode === "online" && socket) {
        socket.emit("game:move", { code: roomCode, move, turn });
      }
    },
    [commitMove, isDisabled, mode, roomCode, socket, turn]
  );

  // AI turn — either a real "vs AI" game, or an online quickmatch that
  // fell back to a bot because no real opponent was available in time.
  const botDifficultyRef = useRef(onlineAiDifficulty || "hard");
  useEffect(() => {
    if (onlineAiDifficulty) botDifficultyRef.current = onlineAiDifficulty;
  }, [onlineAiDifficulty]);
  useEffect(() => {
    const isBotTurn = mode === "ai" || (mode === "online" && vsBot);
    if (!isBotTurn || gameOver || isAnimating || networkTrouble) return;
    if (turn !== aiColor) return;
    const effectiveDifficulty = mode === "online" ? botDifficultyRef.current : difficulty;
    const timer = setTimeout(() => {
      const move = getAiMove(board, aiColor, effectiveDifficulty, mandatoryJumps);
      if (move) commitMove(move);
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, vsBot, turn, aiColor, board, difficulty, mandatoryJumps, gameOver, isAnimating, networkTrouble, commitMove]);

  // Online: listen for opponent moves, plus connection health for both sides.
  useEffect(() => {
    if (mode !== "online" || !socket) return;
    const NETWORK_GRACE_MS = 7 * 60 * 1000;

    const handler = ({ move }) => commitMove(move);

    const onOpponentLeft = () => setConnStatus((c) => ({ ...c, opponent: "reconnecting" }));

    // My own connection dropped (network loss, tab backgrounded, etc.).
    const onDisconnect = (reason) => {
      if (reason === "io client disconnect") return; // we disconnected on purpose (e.g. leaving)
      setNetworkPaused(true);
      setNetworkDeadline(Date.now() + NETWORK_GRACE_MS);
    };
    // Socket.io auto-reconnected — try to reclaim our seat in the room.
    const onConnect = () => {
      if (!roomCode || !playerId) return;
      socket.emit("room:rejoin", { code: roomCode, playerId }, (res) => {
        if (res?.ok) {
          setNetworkPaused(false);
          setNetworkDeadline(null);
          toastInfo("Back online — resuming your match.");
        } else {
          usePlayerStore.getState().refreshPlayer?.();
          toastError("This match ended while you were offline — your bet was refunded.");
          onExit?.(null, null, "home");
        }
      });
    };
    const onOpponentNetworkLost = () => {
      setOpponentNetworkLost(true);
      setNetworkDeadline((d) => d ?? Date.now() + NETWORK_GRACE_MS);
    };
    const onOpponentNetworkRestored = () => {
      setOpponentNetworkLost(false);
      setNetworkDeadline(null);
    };
    const onNetworkTimeout = () => {
      usePlayerStore.getState().refreshPlayer?.();
      toastError("Match ended — connection couldn't be restored in time. Bets were refunded.");
      onExit?.(null, null, "home");
    };

    socket.on("game:move", handler);
    socket.on("opponent:left", onOpponentLeft);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    socket.on("opponent:network-lost", onOpponentNetworkLost);
    socket.on("opponent:network-restored", onOpponentNetworkRestored);
    socket.on("match:network-timeout", onNetworkTimeout);
    setConnStatus({ player: "connected", opponent: "connected" });
    return () => {
      socket.off("game:move", handler);
      socket.off("opponent:left", onOpponentLeft);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.off("opponent:network-lost", onOpponentNetworkLost);
      socket.off("opponent:network-restored", onOpponentNetworkRestored);
      socket.off("match:network-timeout", onNetworkTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, socket, commitMove, roomCode, playerId]);

  const handleUndo = () => {
    if (mode !== "local" && mode !== "ai") return;
    if (history.length === 0 || isAnimating) return;
    const prev = history[history.length - 1];
    setBoard(prev.board);
    setTurn(prev.turn);
    setPieces(prev.pieces);
    setHistory((h) => h.slice(0, -1));
    setGameOver(null);
    setLastMove(null);
    playSound("click", soundsOn);
  };

  const handleRestart = () => {
    clearTimeout(animTimer.current);
    const fresh = createInitialBoard();
    setBoard(fresh);
    setPieces(boardToPieces(fresh));
    setTurn(settings.firstMove === "BLACK" ? BLACK : WHITE);
    setHistory([]);
    setLastMove(null);
    setGameOver(null);
    setIsAnimating(false);
    setDrawOffer(null);
    setDrawWarning(null);
    drawGraceGiven.current = new Set();
    fmjdTracker.current = createFmjdTracker();
    playSound("click", soundsOn);
  };

  const handleHint = () => {
    if (interactiveMoves.length === 0) return;
    const best = getAiMove(board, turn, "hard", mandatoryJumps);
    if (best) setLastMove(best);
    playSound("notify", soundsOn);
  };

  const handleInvalidClick = useCallback(() => playSound("invalid", soundsOn), [soundsOn]);

  const handleLeave = async () => {
    const message =
      mode === "online" && betAmount > 0
        ? `You'll forfeit this match and your ${formatCoinsFull(betAmount)} coin bet, plus a 100 coin penalty. Leave anyway?`
        : "Leave this game in progress?";
    const ok = await confirmDialog({ title: "Leave game?", message, confirmLabel: "Leave", tone: "danger" });
    if (!ok) return;
    if (mode === "online" && socket) socket.emit("room:leave");
    onExit(null, null, mode === "online" ? "lobby" : "home");
  };

  const myScore = scores[playerId] || 0;
  const oppScore = scores[opponentId] || 0;
  const showScoreRail = mode === "online" && (myScore > 0 || oppScore > 0 || gameOver);

  return (
    <div className="game-screen">
      <CoinBurst active={showCoinBurst} />

      <GameHUD
        playerName={playerName}
        playerAvatar={playerAvatar}
        opponentName={opponentName}
        opponentAvatar={opponentAvatar}
        playerColor={playerColor}
        playerId={mode === "online" ? playerId : null}
        opponentId={mode === "online" ? opponentId : null}
        opponentProfile={opponentProfile}
        playerEquippedTitle={playerEquippedTitle}
        opponentEquippedTitle={opponentEquippedTitle}
        turn={turn}
        connectionStatus={connStatus}
        mode={mode}
        vsBot={vsBot}
        potAmount={mode === "online" ? betAmount * 2 : 0}
        canUndo={history.length > 0 && mode !== "online"}
        onUndo={mode !== "online" ? handleUndo : undefined}
        onHint={settings.helper !== "OFF" ? handleHint : undefined}
        onRestart={mode !== "online" ? handleRestart : undefined}
        onProposeDraw={mode === "online" && !gameOver && !drawOffer ? proposeDraw : undefined}
        onToggleChat={mode === "online" ? () => setChatOpen((o) => !o) : undefined}
        chatOpen={chatOpen}
        onLeave={handleLeave}
        chatSlot={
          mode === "online" && socket ? (
            <ChatPanel
              socket={socket}
              roomCode={roomCode}
              playerName={playerName}
              playerColor={playerColor}
              open={chatOpen}
              onClose={() => setChatOpen(false)}
            />
          ) : null
        }
      >
        <div className="board-with-rail">
          {showScoreRail && (
            <div className="score-rail">
              <div className="score-rail__label">Score</div>
              <div className="score-rail__row">
                <span className="score-rail__you">{myScore}</span>
                <span className="score-rail__sep">—</span>
                <span className="score-rail__them">{oppScore}</span>
              </div>
            </div>
          )}
          <Board
            board={board}
            pieces={pieces}
            turn={turn}
            legalMoves={interactiveMoves}
            onMove={handlePlayerMove}
            onInvalid={handleInvalidClick}
            view={settings.view}
            playerColor={playerColor}
            forceOrientToPlayer={mode === "online"}
            helper={settings.helper !== "OFF"}
            disabled={isDisabled || emotesShowing}
            lastMove={lastMove}
          />
          {emotesShowing && emoteQueueReady && (
            <EntryEmoteOverlay queue={emoteQueue} onDone={() => setEmotesShowing(false)} soundsOn={soundsOn} />
          )}
          {networkTrouble && (
            <div className="network-lost-banner">
              <span className="network-lost-banner__icon">📶</span>
              <div className="network-lost-banner__text">
                <strong>{networkPaused ? "You're offline" : "Opponent lost connection"}</strong>
                <span>
                  {networkPaused ? "Reconnecting…" : "Waiting for them to reconnect…"}
                  {networkDeadline ? ` (${formatNetworkCountdown(networkDeadline)} left)` : ""}
                </span>
              </div>
            </div>
          )}
          {showEndBanner && gameOver && (
            <div
              className={`game-end-banner game-end-banner--${
                gameOver.result === "draw" ? "draw" : mode === "local" ? "win" : gameOver.winner === playerColor ? "win" : "lose"
              }`}
            >
              <div className="game-end-banner__text">
                {gameOver.result === "draw" ? "Draw" : mode === "local" ? `${gameOver.winner.toUpperCase()} Wins` : gameOver.winner === playerColor ? "Victory" : "Defeat"}
              </div>
            </div>
          )}
        </div>
      </GameHUD>

      {drawOffer && !gameOver && (
        <div className="draw-offer-bar">
          {drawOffer.from === "them" ? (
            <>
              <span>{opponentName} proposes a draw.</span>
              <div className="draw-offer-bar__actions">
                <Button variant="ghost" onClick={declineDraw}>
                  Decline
                </Button>
                <Button variant="gold" onClick={acceptDraw}>
                  Accept
                </Button>
              </div>
            </>
          ) : (
            <span>Waiting for {opponentName} to respond to your draw offer…</span>
          )}
        </div>
      )}

      {drawWarning && !gameOver && (
        <div className="draw-warning-overlay">
          <div className="draw-warning-card">
            <h3>⚖️ Draw Condition Reached</h3>
            <p>{fmjdReasonMessage(drawWarning)}</p>
            <p className="draw-warning-note">
              If this happens again, the game will automatically end in a draw.
            </p>
            <div className="draw-warning-actions">
              <Button variant="ghost" onClick={() => finishDraw(drawWarning)}>
                Agree to Draw
              </Button>
              <Button variant="gold" onClick={() => setDrawWarning(null)}>
                Continue Playing
              </Button>
            </div>
          </div>
        </div>
      )}

      {gameOver && reviewingBoard && (
        <div className="game-over-review-bar">
          <span>Reviewing the final board.</span>
          <Button variant="gold" onClick={() => setReviewingBoard(false)}>
            Done Reviewing
          </Button>
        </div>
      )}

      {gameOver && !showEndBanner && !reviewingBoard && mode !== "online" && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h3>{gameOver.result === "draw" ? "Draw" : gameOver.winner === playerColor || mode === "local" ? "Game Over" : "Defeat"}</h3>
            <p>
              {gameOver.result === "draw"
                ? fmjdReasonMessage(gameOver.reason)
                : mode === "local"
                ? `${gameOver.winner.toUpperCase()} wins!`
                : gameOver.winner === playerColor
                ? "You win! 🎉"
                : "You lose. Try again?"}
            </p>

            <Button variant="ghost" onClick={() => setReviewingBoard(true)}>
              Review Board
            </Button>

            <div className="game-over-actions">
              <Button variant="ghost" onClick={handleRestart}>
                Play Again
              </Button>
              <Button variant="gold" onClick={handleLeave}>
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
