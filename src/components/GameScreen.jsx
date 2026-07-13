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
  BOARD_SIZE,
  WHITE,
  BLACK,
} from "../game/checkersLogic.js";
import { getAiMove } from "../game/ai.js";
import { playSound, isSoundEnabled } from "../utils/sound.js";
import { confirmDialog, toastSuccess, toastError, toastInfo } from "../store/uiStore.js";
import { api } from "../api/client.js";
import { BET_TIERS, isTierUnlocked, formatCoins } from "../game/rank.js";
import Button from "./Button.jsx";
import "./GameScreen.css";

// How long the slide/capture animation takes before the turn actually
// advances. Kept in one place so every move (human, AI, or online) shares
// the same pacing instead of pieces teleporting between turns.
const MOVE_ANIMATION_MS = 620;

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
  betAmount: initialBetAmount = 0,
  totalEarnings = 0,
  socket,
  roomCode,
  vsBot = false,
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [connStatus, setConnStatus] = useState({ player: "connected", opponent: "connecting" });

  const [betAmount, setBetAmount] = useState(initialBetAmount);
  const [scores, setScores] = useState({});
  const [rematchOffer, setRematchOffer] = useState(null); // { betAmount, from: 'me' | 'them' }
  const [rematchBetChoice, setRematchBetChoice] = useState(initialBetAmount);
  const [friendStatus, setFriendStatus] = useState("idle"); // idle | sent | friends

  const soundsOn = isSoundEnabled(settings);
  const animTimer = useRef(null);
  useEffect(() => () => clearTimeout(animTimer.current), []);

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
      setTimeout(() => onExit("win"), 3200);
    };

    const onRematchOffered = ({ betAmount: offered }) => {
      setRematchOffer({ betAmount: offered, from: "them" });
      playSound("notify", soundsOn);
    };
    const onRematchStarted = ({ betAmount: newBet, scores: newScores }) => {
      setRematchOffer(null);
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

    socket.on("game:settled", onSettledEvent);
    socket.on("opponent:forfeit", onForfeit);
    socket.on("rematch:offered", onRematchOffered);
    socket.on("rematch:started", onRematchStarted);
    socket.on("rematch:declined", onRematchDeclined);
    socket.on("rematch:cancelled", onRematchCancelled);
    return () => {
      socket.off("game:settled", onSettledEvent);
      socket.off("opponent:forfeit", onForfeit);
      socket.off("rematch:offered", onRematchOffered);
      socket.off("rematch:started", onRematchStarted);
      socket.off("rematch:declined", onRematchDeclined);
      socket.off("rematch:cancelled", onRematchCancelled);
    };
  }, [mode, socket, onSettled, playerColor, soundsOn, settings.firstMove, onExit]);

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
      const kingedUp = pieces.some(
        (p) =>
          p.row === move.from.row &&
          p.col === move.from.col &&
          !p.king &&
          (p.color === WHITE ? move.to.row === 0 : move.to.row === BOARD_SIZE - 1)
      );
      if (kingedUp) {
        setTimeout(() => playSound("king", soundsOn), MOVE_ANIMATION_MS * 0.5);
      }

      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => {
        setPieces((prev) => prev.filter((p) => !p.capturing));
        setBoard(nextBoard);
        setTurn(nextTurn);
        setIsAnimating(false);

        const winner = getWinner(nextBoard, nextTurn, mandatoryJumps);
        if (winner) finishGame(winner);
      }, MOVE_ANIMATION_MS);
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
  const botDifficultyRef = useRef(Math.random() < 0.5 ? "hard" : "expert");
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
    playSound("click", soundsOn);
  };

  const handleHint = () => {
    if (interactiveMoves.length === 0) return;
    const best = getAiMove(board, turn, "hard", mandatoryJumps);
    if (best) setLastMove(best);
    playSound("notify", soundsOn);
  };

  const handleInvalidClick = () => playSound("invalid", soundsOn);

  const handleLeave = async () => {
    if (!gameOver) {
      const message =
        mode === "online" && betAmount > 0
          ? `You'll forfeit this match and your ${betAmount} coin bet, plus a 100 coin penalty. Leave anyway?`
          : "Leave this game in progress?";
      const ok = await confirmDialog({ title: "Leave game?", message, confirmLabel: "Leave", tone: "danger" });
      if (!ok) return;
    }
    if (mode === "online" && socket) socket.emit("room:leave");
    onExit(gameOver?.result);
  };

  const offerRematch = (amount) => {
    socket.emit("rematch:offer", { code: roomCode, betAmount: amount });
    setRematchOffer({ betAmount: amount, from: "me" });
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
        opponentId={mode === "online" && !vsBot ? opponentId : null}
        turn={turn}
        connectionStatus={connStatus}
        mode={mode}
        vsBot={vsBot}
        potAmount={mode === "online" ? betAmount * 2 : 0}
        canUndo={history.length > 0 && mode !== "online"}
        onUndo={mode !== "online" ? handleUndo : undefined}
        onHint={settings.helper !== "OFF" ? handleHint : undefined}
        onRestart={mode !== "online" ? handleRestart : undefined}
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

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h3>
              {gameOver.forfeit
                ? "Opponent Left"
                : gameOver.winner === playerColor || mode === "local"
                ? "Game Over"
                : "Defeat"}
            </h3>
            <p>
              {gameOver.forfeit
                ? `${opponentName} left the match — you win! 🎉`
                : mode === "local"
                ? `${gameOver.winner.toUpperCase()} wins!`
                : gameOver.winner === playerColor
                ? "You win! 🎉"
                : "You lose. Try again?"}
            </p>
            {mode === "online" && betAmount > 0 && (
              <p className="game-over-bet">
                {gameOver.winner === playerColor ? `+${betAmount * 2}` : `-${betAmount}`} 🪙
              </p>
            )}

            {mode === "online" && !gameOver.forfeit && !vsBot && (
              <>
                {(myScore > 0 || oppScore > 0) && (
                  <p className="game-over-score">
                    Score: {myScore} — {oppScore}
                  </p>
                )}

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
                    <p>{opponentName} wants a rematch for {rematchOffer.betAmount} 🪙</p>
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
                    {friendStatus !== "friends" && (
                      <Button variant="ghost" onClick={handleAddFriend}>
                        ➕ Add Friend
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="game-over-actions">
              {mode !== "online" && (
                <Button variant="ghost" onClick={handleRestart}>
                  Play Again
                </Button>
              )}
              <Button variant={mode === "online" ? "ghost" : "gold"} onClick={() => onExit(gameOver.result, gameOver.winner)}>
                {mode === "online" ? "Back to Lobby" : "Exit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
