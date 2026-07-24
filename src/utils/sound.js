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

// A short burst of filtered white noise — for percussive/impact sounds
// (cracks, booms, risers) instead of melodic oscillator runs, so a "bang"
// reads as bold and cinematic rather than like a toy/8-bit jingle.
function noiseHit(ctx, { duration = 0.25, volume = 0.3, delay = 0, filterType = "lowpass", filterFreq = 1200, filterEnd } = {}) {
  const t0 = ctx.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t0);
  if (filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 40), t0 + duration);

  const gain = ctx.createGain();
  const peak = Math.min(0.9, volume * MASTER_GAIN);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.05);
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
  // Bigger, more dramatic versions for the end-of-match banner — a
  // percussive impact under the existing fanfare/descent so the moment the
  // result lands on screen actually feels like it landed.
  gameEndWin: (ctx) => {
    noiseHit(ctx, { duration: 0.3, volume: 0.32, filterType: "highpass", filterFreq: 500, filterEnd: 5000 });
    tone(ctx, { freq: 100, freqEnd: 55, duration: 0.5, type: "sine", volume: 0.4 });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(ctx, { freq: f, duration: 0.3, type: "triangle", volume: 0.22, delay: 0.14 + i * 0.09 })
    );
  },
  gameEndLose: (ctx) => {
    noiseHit(ctx, { duration: 0.35, volume: 0.24, filterType: "lowpass", filterFreq: 900, filterEnd: 140 });
    tone(ctx, { freq: 90, freqEnd: 40, duration: 0.6, type: "sine", volume: 0.3 });
    [392, 349.23, 293.66, 220].forEach((f, i) =>
      tone(ctx, { freq: f, duration: 0.4, type: "sine", volume: 0.22, delay: 0.1 + i * 0.18 })
    );
  },
  gameEndDraw: (ctx) => {
    noiseHit(ctx, { duration: 0.22, volume: 0.2, filterType: "bandpass", filterFreq: 700 });
    tone(ctx, { freq: 440, duration: 0.3, type: "sine", volume: 0.22, delay: 0.08 });
    tone(ctx, { freq: 440, duration: 0.34, type: "sine", volume: 0.22, delay: 0.42 });
  },
  notify: (ctx) => tone(ctx, { freq: 600, freqEnd: 900, duration: 0.13, type: "sine", volume: 0.22 }),
  // Epic-tier entry emote: a short cinematic riser, then a bold double
  // sub-bass boom with a tight noise crack on each hit, and a low rumble
  // tail. Purely percussive/impact — no melody or arpeggio — so it reads
  // as a bold trailer-style "bang" instead of a toy jingle.
  epicEmote: (ctx) => {
    noiseHit(ctx, { duration: 0.26, volume: 0.15, filterType: "highpass", filterFreq: 300, filterEnd: 4500 });
    tone(ctx, { freq: 95, freqEnd: 36, duration: 0.7, type: "sine", volume: 0.55, delay: 0.26 });
    noiseHit(ctx, { duration: 0.16, volume: 0.4, delay: 0.26, filterType: "lowpass", filterFreq: 2400, filterEnd: 180 });
    tone(ctx, { freq: 62, freqEnd: 26, duration: 0.55, type: "sine", volume: 0.38, delay: 0.42 });
    noiseHit(ctx, { duration: 0.12, volume: 0.3, delay: 0.42, filterType: "lowpass", filterFreq: 1900, filterEnd: 150 });
    tone(ctx, { freq: 50, freqEnd: 22, duration: 0.95, type: "triangle", volume: 0.2, delay: 0.3 });
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
  const preferredNames = [
    "Google UK English Male",
    "Microsoft Ryan",
    "Microsoft Guy",
    "Microsoft David",
    "Microsoft Mark",
    "Daniel",
    "Fred",
    "Alex",
    "Male",
  ];
  for (const name of preferredNames) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) return match;
  }
  const englishVoice = voices.find((v) => /^en/i.test(v.lang));
  return englishVoice || voices[0];
}

// Strips emoji/pictographic symbols so the voice never tries to "say" them
// (and doesn't stumble over the surrounding rhythm/pauses because of one).
// Plain punctuation — commas, periods, etc. — is left untouched, since
// speech engines already pace pauses off it once the clutter is gone.
const EMOJI_REGEX =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\uFE0F\u200D]/gu;

function sanitizeForSpeech(text) {
  if (!text) return "";
  return text
    .replace(EMOJI_REGEX, "")
    .replace(/[*_~`#]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function speakQuote(text, { enabled = true, delayMs = 0 } = {}) {
  const clean = sanitizeForSpeech(text);
  if (!enabled || !clean) return null;
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const utter = new SpeechSynthesisUtterance(clean);
  const voice = pickDeepVoice();
  if (voice) utter.voice = voice;
  // A pitch this extreme is what caused the "cracky"/glitchy sound — most
  // engines distort past ~0.6. This keeps it deep but clean, with rate and
  // voice choice doing the work of sounding bold/authoritative instead.
  utter.pitch = 0.82;
  utter.rate = 0.92;
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
