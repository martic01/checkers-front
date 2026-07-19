import { getAllMoves, countPieces, WHITE } from "./checkersLogic.js";

// How often the bot actually says something when a situation fires — not
// every qualifying move, per the request. "Silent" personalities barely
// talk at all; everyone else talks sometimes, not constantly.
const SPEAK_CHANCE = { friendly: 0.4, funny: 0.4, competitive: 0.38, angry: 0.35, playful: 0.42, respectful: 0.32, silent: 0.08 };

const EMOJI_POOL = {
  friendly: ["😊", "👍", "🙂"],
  funny: ["😂", "🤣", "😅"],
  competitive: ["😤", "🔥", "💪"],
  angry: ["😠", "🙄"],
  playful: ["😏", "😉", "🤭"],
  respectful: ["🙏", "🤝"],
  silent: ["...", "🙂"],
};

// One or two lines per personality per situation. Not meant to be
// exhaustive — variety comes as much from the random emoji suffix and the
// randomness of whether the bot speaks at all as from the line pool itself.
const LINES = {
  start: {
    friendly: ["Hey, good luck! Have fun 😊", "Hi there — let's have a good game!"],
    funny: ["Let's see what you've got 😄", "Fair warning, I've had my coffee."],
    competitive: ["Let's go. No mercy.", "Ready when you are."],
    angry: ["Let's just play.", "Hmph. Go ahead."],
    playful: ["Ooh, a challenger 😏", "Let's make this fun."],
    respectful: ["Good luck, have fun!", "May the best strategy win."],
    silent: ["...", "hi"],
  },
  botCapture: {
    friendly: ["Sorry about that! 😅", "Got one, gg so far."],
    funny: ["Oops 😂", "Didn't mean to — okay I did."],
    competitive: ["I'm coming for you.", "One down."],
    angry: ["That's what happens.", "Took it."],
    playful: ["Gotcha 😏", "Too easy."],
    respectful: ["Well played to get there, but I'll take it.", "Good exchange."],
    silent: ["+1", "..."],
  },
  humanCapture: {
    friendly: ["Nice move!", "You got lucky 😊"],
    funny: ["Oops.", "Rude."],
    competitive: ["You got lucky.", "Won't happen again."],
    angry: ["Hmph.", "Fine."],
    playful: ["Ooh, sneaky 😏", "Okay okay, nice."],
    respectful: ["Well played.", "Good capture."],
    silent: ["...", "ok"],
  },
  botDoubleCapture: {
    friendly: ["Whoa, didn't expect that many! 😊", "Double trouble, sorry!"],
    funny: ["Two for one 😂", "Combo!"],
    competitive: ["Double capture. Let's keep going.", "That's how it's done."],
    angry: ["Two. Not enough.", "Keep up."],
    playful: ["Ooh, double 😏", "Bet you didn't see that coming."],
    respectful: ["Nice exchange there, I'll take the two.", "Good sequence, but I'll take it."],
    silent: ["+2", "..."],
  },
  humanDoubleCapture: {
    friendly: ["Whoa, nice one!", "Okay, that was good 😊"],
    funny: ["Haha 😄 ouch.", "Well that hurt."],
    competitive: ["You got lucky.", "Noted."],
    angry: ["...", "Tch."],
    playful: ["Okay showoff 😏", "Not bad."],
    respectful: ["That was dangerous. Well played.", "Nicely done."],
    silent: ["...", "ouch"],
  },
  botKingship: {
    friendly: ["King me! 😊", "Got a king now, nice."],
    funny: ["Crowned 👑", "Royalty now."],
    competitive: ["Kinged up. Watch out.", "Now it gets interesting."],
    angry: ["King. Now watch.", "That changes things."],
    playful: ["King me 😏", "Things just got fun."],
    respectful: ["A king already — let's see how this goes.", "Kinged up, good game so far."],
    silent: ["👑", "..."],
  },
  humanKingship: {
    friendly: ["Nice, a king already? 😊", "You're improving!"],
    funny: ["Uh oh, royalty 😅", "That's not good for me."],
    competitive: ["Noted. I'll deal with it.", "We'll see."],
    angry: ["Hmph.", "..."],
    playful: ["Ooh fancy 😏", "Look at you."],
    respectful: ["Well earned.", "Nice promotion."],
    silent: ["👑", "..."],
  },
  dangerousMove: {
    friendly: ["That was dangerous! 😊", "Careful there."],
    funny: ["That was dangerous 😅", "Uh oh for you."],
    competitive: ["That was dangerous. Let's see.", "I'm coming for you."],
    angry: ["Big mistake.", "You'll regret that."],
    playful: ["Ooh, risky 😏", "Let's see what happens."],
    respectful: ["That's a risky position.", "Careful there."],
    silent: ["...", "hm"],
  },
  botWinning: {
    friendly: ["Going well for me so far! 😊", "Feeling good about this one."],
    funny: ["I could get used to this 😄", "This is fun."],
    competitive: ["Let's close this out.", "Feeling good."],
    angry: ["This is how it should be.", "Keep struggling."],
    playful: ["This is fun 😏", "Enjoying this."],
    respectful: ["Good game so far.", "This is a solid game."],
    silent: ["🙂", "..."],
  },
  botLosing: {
    friendly: ["You're playing really well! 😊", "This is tough for me!"],
    funny: ["This is not going well for me 😅", "Send help."],
    competitive: ["Not over yet.", "I'll find a way back."],
    angry: ["Not for long.", "We'll see about that."],
    playful: ["Uh oh for me 😏", "You're good at this."],
    respectful: ["You're playing really well.", "Nicely played so far."],
    silent: ["...", "hm"],
  },
  comeback: {
    friendly: ["Making a comeback! 😊", "Okay, feeling better now!"],
    funny: ["Plot twist 😄", "The comeback arc begins."],
    competitive: ["Back in this.", "Let's see."],
    angry: ["Told you.", "Not done yet."],
    playful: ["Ooh, twist 😏", "Back in it."],
    respectful: ["Good fight — let's see how it ends.", "This turned into a good game."],
    silent: ["...", "back"],
  },
  nearDefeat: {
    friendly: ["Down to my last few — this is tense! 😊", "It's not looking great for me!"],
    funny: ["I'm in trouble 😅", "This is fine. (It's not.)"],
    competitive: ["Not done yet.", "I'll fight to the end."],
    angry: ["Not over.", "Keep trying."],
    playful: ["Uh oh 😏", "This is getting close."],
    respectful: ["Well played — you've got me on the ropes.", "Tough spot for me."],
    silent: ["...", "hm"],
  },
  lastPiece: {
    friendly: ["Last piece standing! 😊", "This is it for me!"],
    funny: ["One piece left, send memes 😂", "Down to the wire."],
    competitive: ["One piece. Still not done.", "Let's see."],
    angry: ["Still here.", "Not finished."],
    playful: ["Last one standing 😏", "This is dramatic."],
    respectful: ["Well played, this was a good game.", "Down to the wire — good game."],
    silent: ["...", "hm"],
  },
  closeGame: {
    friendly: ["This is a close one! 😊", "Anyone's game right now!"],
    funny: ["This is a nail-biter 😅", "My heart can't take this."],
    competitive: ["Close game. Let's see who wants it more.", "This is where it counts."],
    angry: ["Close. Won't stay that way.", "Let's finish this."],
    playful: ["Ooh, tight game 😏", "This is fun."],
    respectful: ["Good, close game.", "This has been a great match."],
    silent: ["...", "close"],
  },
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns a chat line for the given situation/personality, or null if the
// bot decides not to speak this time (the common case — see SPEAK_CHANCE).
export function maybeGetBotLine(situation, personality = "friendly") {
  const chance = SPEAK_CHANCE[personality] ?? 0.35;
  if (Math.random() > chance) return null;
  const bucket = LINES[situation]?.[personality] || LINES[situation]?.friendly;
  if (!bucket) return null;
  let line = pick(bucket);
  if (personality !== "silent" && Math.random() < 0.3) {
    line = `${line} ${pick(EMOJI_POOL[personality] || EMOJI_POOL.friendly)}`;
  }
  return line;
}

// Figures out which situations a just-committed move triggers, from the
// bot's point of view. `moverColor` is whoever just moved; `botColor` is
// the AI's own color. Returns an array (a move can trigger more than one —
// e.g. a capture that also creates a king).
export function detectChatSituations({ move, boardAfter, moverColor, botColor, mandatoryJumps = true, wasBehindRef, promoted }) {
  const situations = [];
  const byBot = moverColor === botColor;
  const captures = move?.captures?.length || 0;

  if (captures >= 2) situations.push(byBot ? "botDoubleCapture" : "humanDoubleCapture");
  else if (captures === 1) situations.push(byBot ? "botCapture" : "humanCapture");

  if (promoted) situations.push(byBot ? "botKingship" : "humanKingship");

  // A human move that leaves the bot with a capture on offer next turn.
  if (!byBot) {
    const botMoves = getAllMoves(boardAfter, botColor, mandatoryJumps);
    if (botMoves.some((m) => m.captures?.length > 0)) situations.push("dangerousMove");
  }

  const { white, black } = countPieces(boardAfter);
  const botCount = botColor === WHITE ? white : black;
  const humanCount = botColor === WHITE ? black : white;
  const diff = botCount - humanCount;

  if (botCount === 1) situations.push("lastPiece");
  else if (botCount <= 2) situations.push("nearDefeat");

  if (diff >= 3) situations.push("botWinning");
  else if (diff <= -3) situations.push("botLosing");
  else if (botCount + humanCount <= 10) situations.push("closeGame");

  if (wasBehindRef) {
    if (diff <= -3) wasBehindRef.current = true;
    else if (wasBehindRef.current && diff >= 0) {
      situations.push("comeback");
      wasBehindRef.current = false;
    }
  }

  return situations;
}
