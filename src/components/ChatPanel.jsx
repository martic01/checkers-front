import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toastError } from "../store/uiStore.js";
import "./ChatPanel.css";

const QUICK_EMOJI = ["👍", "😂", "😮", "😢", "🔥", "🤝", "😤", "👏"];
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const VOICE_POS_KEY = "checkers.voiceControlsPos";
const VOICE_WIDGET_SIZE = { width: 118, height: 44 };

function loadVoicePos() {
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_POS_KEY) || "null");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") return saved;
  } catch {
    /* ignore corrupt/unavailable storage */
  }
  return null;
}

function clampVoicePos(x, y) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(6, window.innerWidth - VOICE_WIDGET_SIZE.width - 6);
  const maxY = Math.max(6, window.innerHeight - VOICE_WIDGET_SIZE.height - 6);
  return { x: Math.min(Math.max(6, x), maxX), y: Math.min(Math.max(6, y), maxY) };
}

// Default spot: bottom-left, clear of the top-right chat/game controls and
// the board itself, so it doesn't need to overlap anything until dragged.
function defaultVoicePos() {
  if (typeof window === "undefined") return { x: 12, y: 90 };
  return clampVoicePos(12, window.innerHeight - VOICE_WIDGET_SIZE.height - 96);
}

export default function ChatPanel({ socket, roomCode, playerName, playerColor, open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState(null);
  const [floatingText, setFloatingText] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [micStatus, setMicStatus] = useState("off"); // off | connecting | live

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const mutedRef = useRef(muted);
  const peerReadyRef = useRef(false);
  mutedRef.current = muted;

  // The chat popup used to be position:absolute inside .chat-anchor, but
  // .chat-anchor lives inside .game-topbar which has backdrop-filter — that
  // creates its own stacking context, so the popup's z-index only ever won
  // against other elements *inside the topbar*, not the board. It could
  // render behind the board, and on narrow screens the fixed 232px width
  // anchored to the button's right edge could push it off the left edge of
  // the viewport. Portaling to body + measuring the button's position fixes
  // both: real page-level stacking, and a position we can clamp on-screen.
  const widgetRef = useRef(null);
  const [panelPos, setPanelPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const PANEL_WIDTH = 232;
    const measure = () => {
      const rect = widgetRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(Math.max(8, rect.right - PANEL_WIDTH), window.innerWidth - PANEL_WIDTH - 8);
      setPanelPos({ top: rect.bottom + 8, left });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // ---------- Floating draggable mic/speaker controls (request #5) ----------
  const [voicePos, setVoicePos] = useState(() => loadVoicePos() || defaultVoicePos());
  const [dragging, setDragging] = useState(false);
  const voiceWidgetRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setVoicePos((p) => clampVoicePos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleVoicePointerDown = (e) => {
    const rect = voiceWidgetRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handleVoicePointerMove = (e) => {
    if (!dragging) return;
    setVoicePos(clampVoicePos(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
  };
  const handleVoicePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    setVoicePos((p) => {
      try {
        localStorage.setItem(VOICE_POS_KEY, JSON.stringify(p));
      } catch {
        /* storage unavailable — position just won't persist across sessions */
      }
      return p;
    });
  };

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      if (mutedRef.current && msg.from !== playerName) return;
      setMessages((prev) => [...prev, msg]);
      setFloatingText({ text: msg.text, from: msg.from, key: `${msg.id}-float` });
      setTimeout(() => setFloatingText((cur) => (cur?.key === `${msg.id}-float` ? null : cur)), 2600);
    };
    const onExpire = ({ id }) => setMessages((prev) => prev.filter((m) => m.id !== id));
    const onEmoji = ({ emoji, from }) => {
      if (mutedRef.current && from !== playerName) return;
      setFloatingEmoji({ emoji, key: Date.now() });
      setTimeout(() => setFloatingEmoji(null), 1200);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:expire", onExpire);
    socket.on("emoji:react", onEmoji);

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:expire", onExpire);
      socket.off("emoji:react", onEmoji);
    };
  }, [socket, playerName]);

  // ---------- Voice chat (WebRTC, audio-only, STUN-only best effort) ----------
  useEffect(() => {
    if (!socket) return;

    const createPeerConnection = () => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("voice:ice", { code: roomCode, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
        setMicStatus("live");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setMicStatus(micOn ? "connecting" : "off");
        }
      };
      return pc;
    };

    const startOffer = async () => {
      const pc = pcRef.current || (pcRef.current = createPeerConnection());
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice:offer", { code: roomCode, sdp: offer });
    };

    const onReady = () => {
      peerReadyRef.current = true;
      if (!micOn || !localStreamRef.current) return; // we'll retry once our own mic turns on
      if (playerColor === "white") startOffer();
    };

    const onOffer = async ({ sdp }) => {
      if (!micOn || !localStreamRef.current) return;
      const pc = pcRef.current || (pcRef.current = createPeerConnection());
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("voice:answer", { code: roomCode, sdp: answer });
    };

    const onAnswer = async ({ sdp }) => {
      if (pcRef.current) await pcRef.current.setRemoteDescription(sdp);
    };

    const onIce = async ({ candidate }) => {
      try {
        if (pcRef.current) await pcRef.current.addIceCandidate(candidate);
      } catch {
        /* ignore late/invalid candidates */
      }
    };

    const onLeave = () => {
      setMicStatus(micOn ? "connecting" : "off");
      pcRef.current?.close();
      pcRef.current = null;
    };

    socket.on("voice:ready", onReady);
    socket.on("voice:offer", onOffer);
    socket.on("voice:answer", onAnswer);
    socket.on("voice:ice", onIce);
    socket.on("voice:leave", onLeave);

    // Covers the case where the peer turned their mic on (and signaled
    // ready) before we turned ours on — without this, that ready signal
    // would have been missed entirely and the call would hang on
    // "Connecting…" forever.
    if (peerReadyRef.current) onReady();

    return () => {
      socket.off("voice:ready", onReady);
      socket.off("voice:offer", onOffer);
      socket.off("voice:answer", onAnswer);
      socket.off("voice:ice", onIce);
      socket.off("voice:leave", onLeave);
    };
  }, [socket, roomCode, micOn, playerColor]);

  const toggleMic = async () => {
    if (micOn) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      socket.emit("voice:leave", { code: roomCode });
      setMicOn(false);
      setMicStatus("off");
      return;
    }
    try {
      setMicStatus("connecting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setMicOn(true);
      socket.emit("voice:ready", { code: roomCode });
    } catch {
      setMicStatus("off");
      toastError("Microphone permission is required for voice chat.");
    }
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("chat:message", { code: roomCode, text, from: playerName });
    setText("");
    onClose?.();
  };

  const sendEmoji = (emoji) => {
    socket.emit("emoji:react", { code: roomCode, emoji, from: playerName });
    onClose?.();
  };

  return (
    <div className="chat-widget" ref={widgetRef}>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {floatingEmoji &&
        createPortal(
          <div key={floatingEmoji.key} className="chat-emoji-float">
            {floatingEmoji.emoji}
          </div>,
          document.body
        )}

      {floatingText &&
        createPortal(
          <div key={floatingText.key} className="chat-text-float">
            <span className="chat-text-float__from">{floatingText.from}</span>
            {floatingText.text}
          </div>,
          document.body
        )}

      {createPortal(
        <div
          ref={voiceWidgetRef}
          className={`voice-controls ${dragging ? "voice-controls--dragging" : ""}`}
          style={{ left: voicePos.x, top: voicePos.y }}
          onPointerMove={handleVoicePointerMove}
          onPointerUp={handleVoicePointerUp}
          onPointerCancel={handleVoicePointerUp}
        >
          <span className="voice-controls__grip" onPointerDown={handleVoicePointerDown} title="Drag">
            ⠿
          </span>
          <button className={`chat-mic ${micStatus}`} onClick={toggleMic}>
            {micStatus === "off" ? "🎙️ Off" : micStatus === "connecting" ? "🎙️ Connecting…" : "🎙️ Live"}
          </button>
          <button className={`chat-mute ${muted ? "chat-mute--active" : ""}`} onClick={() => setMuted((m) => !m)} title={muted ? "Unmute" : "Mute"}>
            {muted ? "🔇" : "🔊"}
          </button>
        </div>,
        document.body
      )}

      {open &&
        panelPos &&
        createPortal(
          <div className="chat-panel" style={{ top: panelPos.top, left: panelPos.left }}>
            <div className="chat-panel__header">
              <span>Match Chat</span>
              <button className="chat-panel__close" onClick={onClose} aria-label="Close chat">
                ✕
              </button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && <p className="chat-empty">Say hi! Messages disappear after 1 minute.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`chat-msg ${m.from === playerName ? "chat-msg--me" : ""}`}>
                  <span className="chat-msg__from">{m.from}</span>
                  <span className="chat-msg__text">{m.text}</span>
                </div>
              ))}
            </div>

            <div className="chat-emoji-row">
              {QUICK_EMOJI.map((e) => (
                <button key={e} onClick={() => sendEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Message…"
                maxLength={200}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
