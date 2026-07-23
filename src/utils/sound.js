// Small Web Audio based sound engine. Every sound is synthesized on the fly
// so the app needs no external audio files. All playback is gated by the
// `enabled` flag the caller passes in (tied to settings.sounds !== 'OFF').

let audioCtx = null;

// Overall loudness multiplier. Bumped up across the board per feedback that
// effects were too quiet against typical device/browser volume levels.
const MASTER_GAIN = 1.8;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(ctx, { freq, freqEnd, duration = 0.15, type = "sine", volume = 0.18, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  const peak = Math.min(0.9, volume * MASTER_GAIN);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const RECIPES = {
  click: (ctx) => tone(ctx, { freq: 740, duration: 0.055, type: "triangle", volume: 0.16 }),
  toggle: (ctx) => tone(ctx, { freq: 520, freqEnd: 700, duration: 0.09, type: "triangle", volume: 0.2 }),
  select: (ctx) => tone(ctx, { freq: 500, duration: 0.08, type: "sine", volume: 0.22 }),
  move: (ctx) => tone(ctx, { freq: 320, freqEnd: 230, duration: 0.17, type: "sine", volume: 0.26 }),
  // Wrong piece / illegal square tapped: a short, unmistakably "no" double-buzz.
  invalid: (ctx) => {
    tone(ctx, { freq: 160, duration: 0.09, type: "square", volume: 0.2 });
    tone(ctx, { freq: 120, duration: 0.12, type: "square", volume: 0.18, delay: 0.1 });
  },
  capture: (ctx) => {
    tone(ctx, { freq: 220, duration: 0.15, type: "square", volume: 0.26 });
    tone(ctx, { freq: 145, duration: 0.22, type: "square", volume: 0.22, delay: 0.08 });
  },
  king: (ctx) => {
    tone(ctx, { freq: 440, freqEnd: 880, duration: 0.32, type: "triangle", volume: 0.28 });
    tone(ctx, { freq: 660, duration: 0.28, type: "sine", volume: 0.2, delay: 0.09 });
    tone(ctx, { freq: 990, duration: 0.22, type: "sine", volume: 0.14, delay: 0.16 });
  },
  win: (ctx) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(ctx, { freq: f, duration: 0.26, type: "triangle", volume: 0.24, delay: i * 0.12 })
    );
  },
  lose: (ctx) => {
    [392, 349.23, 293.66].forEach((f, i) =>
      tone(ctx, { freq: f, duration: 0.34, type: "sine", volume: 0.22, delay: i * 0.16 })
    );
  },
  notify: (ctx) => tone(ctx, { freq: 600, freqEnd: 900, duration: 0.13, type: "sine", volume: 0.22 }),
  // Epic-tier entry emote: a deep gong hit for gravitas, a heroic rising
  // arpeggio, then a shimmering high sparkle tail — distinct and much
  // bigger than the regular "win" fanfare so an Epic entrance feels iconic.
  epicEmote: (ctx) => {
    tone(ctx, { freq: 80, freqEnd: 42, duration: 0.9, type: "sine", volume: 0.5 });
    tone(ctx, { freq: 160, freqEnd: 90, duration: 0.7, type: "triangle", volume: 0.3, delay: 0.02 });
    [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(ctx, { freq: f, freqEnd: f * 1.02, duration: 0.45, type: "sawtooth", volume: 0.15, delay: 0.12 + i * 0.07 })
    );
    [1800, 2400, 3000].forEach((f, i) =>
      tone(ctx, { freq: f, freqEnd: f * 1.3, duration: 0.5, type: "triangle", volume: 0.1, delay: 0.5 + i * 0.05 })
    );
  },
};

export function playSound(name, enabled = true) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const recipe = RECIPES[name];
  if (!recipe) return;
  try {
    recipe(ctx);
  } catch {
    /* audio is best-effort; never let it break gameplay */
  }
}

export function isSoundEnabled(settings) {
  return settings?.sounds !== "OFF";
}

// ---------- Speech: reads an Epic-tier emote's quote aloud in a deep,
// dramatic voice. Only ever called for Epic emotes — never lower tiers.
let cachedVoices = [];
function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickDeepVoice() {
  const voices = loadVoices();
  if (!voices.length) return null;
  const preferredNames = ["Google UK English Male", "Daniel", "Fred", "Microsoft David", "Microsoft Guy", "Alex", "Male"];
  for (const name of preferredNames) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }
  const englishVoice = voices.find((v) => /^en/i.test(v.lang));
  return englishVoice || voices[0];
}

export function speakQuote(text, { enabled = true, delayMs = 0 } = {}) {
  if (!enabled || !text) return null;
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickDeepVoice();
  if (voice) utter.voice = voice;
  utter.pitch = 0.35; // deep
  utter.rate = 0.85; // slightly slow, dramatic
  utter.volume = 1;
  const speak = () => {
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      /* speech is best-effort; never let it break the emote animation */
    }
  };
  if (delayMs > 0) setTimeout(speak, delayMs);
  else speak();
  return utter;
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
