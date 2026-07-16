// Lightweight "personality" for bot opponents in online quick-match games
// that fell back to a bot. Picks a short line (and sometimes an emoji) for
// a given moment in the match. Nothing here is persisted or sent to a
// server — it's purely local flavor text rendered straight into the chat
// panel as if the bot had typed it.

const LINES = {
  gameStart: [
    "gl, let's see what you've got 🤞",
    "Ready when you are.",
    "New board, new me. Let's play!",
    "Good luck — you'll need it 😏",
    "Alright, let's dance.",
  ],
  botCapture: [
    "Gotcha! 😈",
    "That piece is mine now.",
    "Too easy.",
    "Didn't see that coming, huh?",
    "Nom nom 🍽️",
    "Ouch, sorry not sorry.",
  ],
  playerCapture: [
    "Ugh, didn't see that.",
    "Okay okay, nice one.",
    "Hey! Rude. 😤",
    "Fine, take it.",
    "You got lucky there.",
  ],
  botKing: [
    "Crowned! 👑",
    "Bow to your king.",
    "King me — literally.",
  ],
  playerKing: [
    "Ugh, a king. Great.",
    "Careful with that thing 👀",
    "Respect, that's a king now.",
  ],
  dangerousMove: [
    "...are you sure about that? 👀",
    "Bold move. Let's see how it plays out.",
    "Hmm, I wouldn't have done that.",
    "Interesting choice.",
  ],
  quickResponse: [
    "Whoa, fast hands! ⚡",
    "No hesitation, I like it.",
    "Speedy! Barely had time to think.",
  ],
  winning: [
    "This is looking good for me 😌",
    "I think I've got this one.",
  ],
  losing: [
    "Okay, you're actually good at this.",
    "Not gonna lie, I'm sweating a little 😅",
  ],
  win: [
    "GG! Good game 🏆",
    "That's a win for me. GG!",
    "Well played, but I win this one 😎",
  ],
  loss: [
    "GG, well played!",
    "Ugh, you got me. Rematch? 😤",
    "Nicely done. GG.",
  ],
  draw: ["That's a draw. GG!", "Even match — GG!"],
};

// Difficulty flavors the tone slightly — higher difficulty bots are cockier,
// lower difficulty ones are friendlier — without needing separate pools for
// every category.
const DIFFICULTY_SUFFIX = {
  beginner: ["😊", "🙂", ""],
  easy: ["🙂", ""],
  medium: [""],
  hard: ["😏", ""],
  expert: ["😏", "🔥", ""],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Chance (0-1) that the bot actually speaks for a given trigger — keeps it
// from being chatty on every single move.
const SPEAK_CHANCE = {
  gameStart: 0.9,
  botCapture: 0.55,
  playerCapture: 0.35,
  botKing: 0.7,
  playerKing: 0.4,
  dangerousMove: 0.3,
  quickResponse: 0.2,
  win: 0.95,
  loss: 0.9,
  draw: 0.7,
};

export function maybeGetBotLine(trigger, difficulty = "medium") {
  const chance = SPEAK_CHANCE[trigger] ?? 0.3;
  if (Math.random() > chance) return null;
  const pool = LINES[trigger];
  if (!pool || pool.length === 0) return null;
  let text = pick(pool);
  const suffixPool = DIFFICULTY_SUFFIX[difficulty] || DIFFICULTY_SUFFIX.medium;
  const suffix = pick(suffixPool);
  if (suffix && !text.includes(suffix)) text = `${text} ${suffix}`.trim();
  return text;
}
