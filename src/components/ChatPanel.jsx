import { useEffect, useRef, useState } from "react";
import { toastError } from "../store/uiStore.js";
import "./ChatPanel.css";

const QUICK_EMOJI = ["👍", "😂", "😮", "😢", "🔥", "🤝", "😤", "👏"];
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

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
  };

  const sendEmoji = (emoji) => {
    socket.emit("emoji:react", { code: roomCode, emoji, from: playerName });
  };

  return (
    <div className="chat-widget">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {floatingEmoji && (
        <div key={floatingEmoji.key} className="chat-emoji-float">
          {floatingEmoji.emoji}
        </div>
      )}

      {floatingText && (
        <div key={floatingText.key} className="chat-text-float">
          <span className="chat-text-float__from">{floatingText.from}</span>
          {floatingText.text}
        </div>
      )}

      <div className="chat-toolbar">
        <button className={`chat-mic ${micStatus}`} onClick={toggleMic}>
          {micStatus === "off" ? "🎙️ Off" : micStatus === "connecting" ? "🎙️ Connecting…" : "🎙️ Live"}
        </button>
        <button className={`chat-mute ${muted ? "chat-mute--active" : ""}`} onClick={() => setMuted((m) => !m)}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {open && (
        <div className="chat-panel">
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
        </div>
      )}
    </div>
  );
}
