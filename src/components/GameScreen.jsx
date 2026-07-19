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
  canProposeDraw,
  BOARD_SIZE,
  WHITE,
  BLACK,
} from "../game/checkersLogic.js";
import { getAiMove, aiRandomDecision } from "../game/ai.js";
import { detectChatSituations, maybeGetBotLine } from "../game/botChat.js";
import { playSound, isSoundEnabled } from "../utils/sound.js";
import { confirmDialog, toastSuccess, toastError, toastInfo } from "../store/uiStore.js";
import { api } from "../api/client.js";
import { BET_TIERS, isTierUnlocked, formatCoins, formatCoinsFull } from "../game/rank.js";
import Button from "./Button.jsx";
import "./GameScreen.css";

// How long the slide animation takes before the turn actually advances.
const MOVE_ANIMATION_MS = 620;
// Captures get their own (longer) duration — the fall/shrink animation
// deserves room to breathe so players can actually watch it land, without
// slowing down ordinary non-capturing slides.
const CAPTURE_ANIMATION_MS = 950;

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
  playerEquippedTitle,
  opponentEquippedTitle,
  betAmount: initialBetAmount = 0,
  totalEarnings = 0,
  socket,
  roomCode,
  vsBot = false,
  aiDifficulty: onlineAiDifficulty,
  onSettled, // ({ result, coinsDelta, newlyEarned, ... }) => void
  onExit, // (result: 'win'|'loss'|'draw') => void
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

  const [betAmount, setBetAmount] = useState(initialBetAmount);
  const [scores, setScores] = useState({});
  const [rematchOffer, setRematchOffer] = useState(null); // { betAmount, from: 'me' | 'them' }
  const rematchOfferRef = useRef(null);
  rematchOfferRef.current = rematchOffer;
  const [rematchBetChoice, setRematchBetChoice] = useState(initialBetAmount);
  const [opponentQuit, setOpponentQuit] = useState(false);
  const [friendStatus, setFriendStatus] = useState("idle"); // idle | sent | friends

  // Mid-game draw proposal (only ever offered, never automatic — see
  // finishDraw/proposeDraw below). { from: 'me' | 'them' } | null
  const [drawOffer, setDrawOffer] = useState(null);

  const soundsOn = isSoundEnabled(settings);
  const animTimer = useRef(null);
  useEffect(() => () => clearTimeout(animTimer.current), []);

  // ---------- AI chat (#3) ----------
  // The bot has no real socket connection, so it "speaks" by having this
  // client (the human's own) emit chat:message on its behalf — the server
  // relays chat to the whole room including the sender, so it shows up in
  // the same chat UI exactly like a real opponent's message would.
  const botPersonality = opponentProfile?.personality || "friendly";
  const botWasBehindRef = useRef(false);

  const maybeBotChat = useCallback(
    (situations) => {
      if (mode !== "online" || !vsBot || !socket || situations.length === 0) return;
      const situation = situations[Math.floor(Math.random() * situations.length)];
      const line = maybeGetBotLine(situation, botPersonality);
      if (!line) return;
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

  const isDisabled = isAnimating || gameOver !== null || interactiveMoves.length === 0;

  function finishGame(winner) {
    let result;
    if (mode === "ai" || mode === "online") {
      result = winner === playerColor ? "win" : "loss";
    } else {
      result = `${winner} wins`;
    }
    setGameOver({ winner, result, forfeit: false });
    playSound(mode !== "local" && winner !== playerColor ? "lose" : "win", soundsOn);

    if (mode === "online" && winner === playerColor && betAmount > 0) {
      setShowCoinBurst(true);
      setTimeout(() => setShowCoinBurst(false), 1300);
    }

    if (mode === "online" && socket) {
      const winnerId = winner === playerColor ? playerId : opponentId;
      socket.emit("game:result", { code: roomCode, winnerId });
    }
  }

  function finishDraw() {
    setGameOver({ winner: null, result: "draw", forfeit: false });
    setDrawOffer(null);
    playSound("notify", soundsOn);

    // Server settles both sides' stats/coins for online draws; it's safe for
    // both clients to emit since the server no-ops once a room is settled.
    if (mode === "online" && socket) {
      socket.emit("game:result", { code: roomCode, winnerId: null });
    }
  }

  // Draws are opt-in: propose one, and either the other player or (vs. a
  // bot) a random decision has to agree before anything actually ends.
  // Declining just clears the offer and the match continues untouched.
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

  // Online: server-driven events (settlement, forfeit, rematch handshake).
  useEffect(() => {
    if (mode !== "online" || !socket) return;

    const onSettledEvent = (payload) => {
      if (payload.scores) setScores(payload.scores);
      onSettled?.(payload);
    };

    // Opponent quit mid-match: we're auto-declared the winner, the pot and
    // coin animation land immediately, no rematch is offered, and we head
    // back to the lobby shortly after.
    const onForfeit = (payload) => {
      if (payload.scores) setScores(payload.scores);
      setGameOver({ winner: playerColor, result: "win", forfeit: true });
      playSound("win", soundsOn);
      setShowCoinBurst(true);
      setTimeout(() => setShowCoinBurst(false), 1300);
      onSettled?.(payload);
      setTimeout(() => onExit("win", null, "lobby"), 3200);
    };

    const onRematchOffered = ({ betAmount: offered }) => {
      // Both sides clicked Rematch around the same time — accept right away
      // instead of leaving both stuck waiting on each other.
      if (rematchOfferRef.current?.from === "me") {
        socket.emit("rematch:accept", { code: roomCode }, () => {});
      }
      setRematchOffer({ betAmount: offered, from: "them" });
      playSound("notify", soundsOn);
    };
    const onRematchStarted = ({ betAmount: newBet, scores: newScores }) => {
      setRematchOffer(null);
      setOpponentQuit(false);
      setBetAmount(newBet);
      if (newScores) setScores(newScores);
      clearTimeout(animTimer.current);
      const fresh = createInitialBoard();
      setBoard(fresh);
      setPieces(boardToPieces(fresh));
      setTurn(settings.firstMove === "BLACK" ? BLACK : WHITE);
      setHistory([]);
      setLastMove(null);
      setGameOver(null);
      setIsAnimating(false);
      toastSuccess(`Rematch! Playing for ${newBet} coins.`);
    };
    const onRematchDeclined = () => {
      setRematchOffer(null);
      toastInfo("Your opponent declined the rematch.");
    };
    const onRematchCancelled = ({ reason }) => {
      setRematchOffer(null);
      toastError(reason || "Rematch could not start");
    };
    const onRematchQuit = ({ name }) => {
      setOpponentQuit(true);
      setRematchOffer(null);
      toastInfo(`${name || opponentName} quit.`);
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
    socket.on("rematch:offered", onRematchOffered);
    socket.on("rematch:started", onRematchStarted);
    socket.on("rematch:declined", onRematchDeclined);
    socket.on("rematch:cancelled", onRematchCancelled);
    socket.on("rematch:quit", onRematchQuit);
    socket.on("draw:offered", onDrawOffered);
    socket.on("draw:agreed", onDrawAgreed);
    socket.on("draw:declined", onDrawDeclined);
    return () => {
      socket.off("game:settled", onSettledEvent);
      socket.off("opponent:forfeit", onForfeit);
      socket.off("rematch:offered", onRematchOffered);
      socket.off("rematch:started", onRematchStarted);
      socket.off("rematch:declined", onRematchDeclined);
      socket.off("rematch:cancelled", onRematchCancelled);
      socket.off("rematch:quit", onRematchQuit);
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
    if (!isBotTurn || gameOver || isAnimating) return;
    if (turn !== aiColor) return;
    const effectiveDifficulty = mode === "online" ? botDifficultyRef.current : difficulty;
    const timer = setTimeout(() => {
      const move = getAiMove(board, aiColor, effectiveDifficulty, mandatoryJumps);
      if (move) commitMove(move);
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, vsBot, turn, aiColor, board, difficulty, mandatoryJumps, gameOver, isAnimating, commitMove]);

  // Online: listen for opponent moves.
  useEffect(() => {
    if (mode !== "online" || !socket) return;
    const handler = ({ move }) => commitMove(move);
    socket.on("game:move", handler);
    socket.on("opponent:left", () => setConnStatus((c) => ({ ...c, opponent: "reconnecting" })));
    setConnStatus({ player: "connected", opponent: "connected" });
    return () => {
      socket.off("game:move", handler);
      socket.off("opponent:left");
    };
  }, [mode, socket, commitMove]);

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
    setOpponentQuit(false);
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
    if (!gameOver) {
      const message =
        mode === "online" && betAmount > 0
          ? `You'll forfeit this match and your ${formatCoinsFull(betAmount)} coin bet, plus a 100 coin penalty. Leave anyway?`
          : "Leave this game in progress?";
      const ok = await confirmDialog({ title: "Leave game?", message, confirmLabel: "Leave", tone: "danger" });
      if (!ok) return;
      if (mode === "online" && socket) socket.emit("room:leave");
      onExit(gameOver?.result);
      return;
    }
    // Leaving from the post-game screen: the match is already settled, so no
    // confirmation needed — just let the other side know and head back to
    // the online lobby (not the home screen) to find another match.
    if (mode === "online" && socket && !vsBot) {
      socket.emit("rematch:quit", { code: roomCode });
    }
    onExit(gameOver.result, gameOver.winner, mode === "online" ? "lobby" : "home");
  };

  const offerRematch = (amount) => {
    socket.emit("rematch:offer", { code: roomCode, betAmount: amount });
    setRematchOffer({ betAmount: amount, from: "me" });
    if (vsBot) {
      const delay = 1200 + Math.random() * 1800;
      setTimeout(() => {
        if (aiRandomDecision()) {
          socket.emit("rematch:accept", { code: roomCode }, (res) => {
            if (!res?.ok) toastError("Could not start the rematch");
          });
        } else {
          setRematchOffer(null);
          setOpponentQuit(true);
          toastInfo("Opponent doesn't want a rematch.");
        }
      }, delay);
    }
  };
  const acceptRematch = () => {
    socket.emit("rematch:accept", { code: roomCode }, (res) => {
      if (!res?.ok) toastError("Could not start the rematch");
    });
  };
  const declineRematch = () => {
    socket.emit("rematch:decline", { code: roomCode });
    setRematchOffer(null);
  };

  // Non-online modes have no opponent to ask over the network — the "other
  // side" is either the local AI (random decision, same as an online bot)
  // or the second human sharing this device (a simple confirm).
  const handleProposeDrawLocal = async () => {
    if (mode === "ai") {
      toastInfo("Proposing a draw…");
      const delay = 800 + Math.random() * 1200;
      setTimeout(() => {
        if (aiRandomDecision()) finishDraw();
        else toastInfo("The AI declined — game continues.");
      }, delay);
    } else if (mode === "local") {
      const ok = await confirmDialog({
        title: "Propose a draw?",
        message: "Does the other player agree to end this game as a draw?",
        confirmLabel: "They agree",
        cancelLabel: "Continue playing",
      });
      if (ok) finishDraw();
    }
  };
  const handleProposeDraw = mode === "online" ? proposeDraw : handleProposeDrawLocal;

  const handleAddFriend = async () => {
    try {
      await api.addFriend(playerId, opponentId);
      setFriendStatus("friends");
      toastSuccess(`${opponentName} added as a friend!`);
    } catch (err) {
      if (err.message?.includes("Already")) setFriendStatus("friends");
      else toastError(err.message || "Could not add friend");
    }
  };

  const myScore = scores[playerId] || 0;
  const oppScore = scores[opponentId] || 0;
  const showScoreRail = mode === "online" && (myScore > 0 || oppScore > 0 || rematchOffer || gameOver);

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
        onProposeDraw={!gameOver && !drawOffer && canProposeDraw(board) ? handleProposeDraw : undefined}
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
            disabled={isDisabled}
            lastMove={lastMove}
          />
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

      {gameOver && reviewingBoard && (
        <div className="game-over-review-bar">
          <span>Reviewing the final board.</span>
          <Button variant="gold" onClick={() => setReviewingBoard(false)}>
            Done Reviewing
          </Button>
        </div>
      )}

      {gameOver && !reviewingBoard && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h3>
              {gameOver.forfeit
                ? "Opponent Left"
                : gameOver.result === "draw"
                ? "Draw"
                : gameOver.winner === playerColor || mode === "local"
                ? "Game Over"
                : "Defeat"}
            </h3>
            <p>
              {gameOver.forfeit
                ? `${opponentName} left the match — you win! 🎉`
                : gameOver.result === "draw"
                ? "Both players agreed to a draw."
                : mode === "local"
                ? `${gameOver.winner.toUpperCase()} wins!`
                : gameOver.winner === playerColor
                ? "You win! 🎉"
                : "You lose. Try again?"}
            </p>
            {mode === "online" && betAmount > 0 && (
              <p className="game-over-bet">
                {gameOver.result === "draw"
                  ? `Bet returned: ${formatCoinsFull(betAmount)}`
                  : gameOver.winner === playerColor
                  ? `+${formatCoinsFull(betAmount * 2)}`
                  : `-${formatCoinsFull(betAmount)}`}{" "}
                🪙
              </p>
            )}

            <Button variant="ghost" onClick={() => setReviewingBoard(true)}>
              Review Board
            </Button>

            {mode === "online" && !gameOver.forfeit && (
              <>
                {(myScore > 0 || oppScore > 0) && (
                  <p className="game-over-score">
                    Score: {myScore} — {oppScore}
                  </p>
                )}

                {opponentQuit ? (
                  <p className="rematch-waiting">{opponentName} quit.</p>
                ) : (
                  <>
                    {!rematchOffer && (
                      <div className="rematch-picker">
                        <div className="rematch-picker__label">Rematch bet:</div>
                        <div className="rematch-picker__chips">
                          {BET_TIERS.slice(0, 6).map((tier) => (
                            <button
                              key={tier}
                              className={`bet-chip ${rematchBetChoice === tier ? "bet-chip--selected" : ""} ${!isTierUnlocked(tier, totalEarnings) ? "bet-chip--locked" : ""}`}
                              disabled={!isTierUnlocked(tier, totalEarnings)}
                              onClick={() => setRematchBetChoice(tier)}
                            >
                              {formatCoins(tier)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {rematchOffer?.from === "them" ? (
                      <div className="rematch-offer">
                        <p>
                          {opponentName} wants a rematch for {formatCoinsFull(rematchOffer.betAmount)} 🪙
                        </p>
                        <div className="game-over-actions">
                          <Button variant="ghost" onClick={declineRematch}>
                            Decline
                          </Button>
                          <Button variant="gold" onClick={acceptRematch}>
                            Accept
                          </Button>
                        </div>
                      </div>
                    ) : rematchOffer?.from === "me" ? (
                      <p className="rematch-waiting">Waiting for {opponentName} to respond…</p>
                    ) : (
                      <div className="game-over-actions">
                        <Button variant="gold" onClick={() => offerRematch(rematchBetChoice)}>
                          🔁 Rematch
                        </Button>
                        {!vsBot && friendStatus !== "friends" && (
                          <Button variant="ghost" onClick={handleAddFriend}>
                            ➕ Add Friend
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="game-over-actions">
              {mode !== "online" && (
                <Button variant="ghost" onClick={handleRestart}>
                  Play Again
                </Button>
              )}
              <Button variant={mode === "online" ? "ghost" : "gold"} onClick={handleLeave}>
                {mode === "online" ? "Quit to Lobby" : "Exit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
