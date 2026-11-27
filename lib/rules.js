// Pure game rules: every function takes the room state and changes it. No database or network.
import { tooClose } from './match.js';
import { isTopic } from '../public/topics.js';
import { PARTY } from './party.js';
export class GameError extends Error {}
const need = (ok, message) => { if (!ok) throw new GameError(message); };
export const MIN_PLAYERS = 2, MAX_PLAYERS = 12;

export const clean = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const normalize = text => String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').replace(/\b(a|an|the)\b/g, '').replace(/\s+/g, '');
export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Takes from each difficulty level in turn, then shuffles so the order is unpredictable.
export function mixed(levels, count, random = Math.random) {
  const piles = shuffle(Object.values(levels).map(list => shuffle(list, random)), random);
  const picked = [];
  while (picked.length < count && piles.some(p => p.length)) {
    for (const pile of piles) if (picked.length < count && pile.length) picked.push(pile.pop());
  }
  return shuffle(picked, random);
}

export function newRoom(game) {
  need(game === 'bluff' || game === 'doodle' || Object.hasOwn(PARTY, game), 'Unknown game');
  return { game, phase: 'lobby', step: 0, players: [], rounds: [], index: 0, fakes: {}, votes: {}, options: [], gains: {} };
}

export function join(room, { id, secret, name }) {
  name = clean(name, 14);
  need(name, 'Enter your name');
  need(room.phase === 'lobby', 'That game already started');
  need(room.players.length < MAX_PLAYERS, 'Room is full');
  need(!room.players.some(p => p.name.toLowerCase() === name.toLowerCase()), 'That name is taken');
  room.players.push({ id, secret, name, score: 0 });
}

// Bluff: content = [{question, answer}]. Doodle: content = one prompt string per player.
export function start(room, content) {
  need(room.players.length >= MIN_PLAYERS, `Need at least ${MIN_PLAYERS} players`);
  room.players.forEach(p => { p.score = 0; });
  room.index = 0;
  room.requests = {};
  if (PARTY[room.game]) return PARTY[room.game].start(room, content);
  if (room.game === 'bluff') {
    // A "subject" round is about one player, who supplies the real answer during writing.
    room.rounds = content.map(({ question, answer, subject }) => ({ question, answer, subject }));
    open(room, 'writing');
  } else {
    room.rounds = room.players.map((p, i) => ({ artist: p.id, answer: content[i], drawing: null }));
    open(room, 'drawing');
  }
}

function open(room, phase) {
  room.phase = phase; room.step++;
  if (phase === 'writing' || phase === 'drawing') Object.assign(room, { fakes: {}, votes: {}, options: [], gains: {}, hints: {} });
}

const round = room => room.rounds[room.index];
// Who still owes something in the current phase.
export function waitingOn(room) {
  if (PARTY[room.game]) return PARTY[room.game].waiting(room);
  const ids = room.players.map(p => p.id);
  if (room.phase === 'drawing') return room.rounds.filter(r => !r.drawing).map(r => r.artist);
  const guessers = ids.filter(id => id !== round(room)?.artist && id !== round(room)?.subject);
  if (room.phase === 'writing') return ids.filter(id => id !== round(room).artist && !(id in room.fakes));
  if (room.phase === 'voting') return guessers.filter(id => !(id in room.votes));
  return [];
}

export function submitDrawing(room, playerId, strokes) {
  if (room.game === 'telephone') return PARTY.telephone.drawing(room, playerId, strokes);
  need(room.phase === 'drawing', 'Drawing time is over');
  const mine = room.rounds.find(r => r.artist === playerId);
  need(mine && !mine.drawing, 'Already sent');
  need(validDrawing(strokes), 'Draw something first (or simplify a very detailed drawing)');
  mine.drawing = strokes;
  if (!waitingOn(room).length) advance(room);
}

export function validDrawing(s) {
  if (!Array.isArray(s) || !s.length || s.length > 600) return false;
  let points = 0;
  for (const stroke of s) {
    if (!Array.isArray(stroke) || stroke.length !== 3) return false;
    const [color, width, p] = stroke;
    if (!Number.isInteger(color) || color < 0 || color > 6 || !Number.isInteger(width) || width < 1 || width > 80) return false;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 || !p.every(n => Number.isInteger(n) && n >= 0 && n <= 1000)) return false;
    points += p.length / 2;
  }
  return points <= 6000;
}

export function submitFake(room, playerId, text, item) {
  if (PARTY[room.game]) return PARTY[room.game].text(room, playerId, text, item);
  need(room.phase === 'writing', 'Writing time is over');
  need(playerId !== round(room).artist, 'This one is your drawing');
  need(!(playerId in room.fakes), 'Already sent');
  text = clean(text, 60);
  need(normalize(text), 'Write something');
  need(round(room).subject || !tooClose(text, round(room).answer, { loose: room.game === 'doodle' }), 'Too close to the real answer. Try another!');
  room.fakes[playerId] = text;
  if (!waitingOn(room).length) advance(room);
}

// AI help: one per player per round, in Bluff only. '' marks a request still in progress.
export function reserveHint(room, playerId) {
  need(room.game === 'bluff' && room.phase === 'writing', 'AI help is only for writing a Bluff answer');
  need(playerId !== round(room).subject, 'Answer this one yourself. It is about you.');
  need(!(playerId in room.fakes), 'Already sent');
  room.hints ??= {};
  need(!(playerId in room.hints), 'You already used AI help this round');
  room.hints[playerId] = '';
  return round(room);
}

// Players ask the host for a topic between games. Tapping the same one again withdraws it.
export function requestTopic(room, playerId, topic) {
  need(room.game === 'bluff' && ['lobby', 'done'].includes(room.phase), 'Request topics between games');
  need(isTopic(topic), 'Unknown topic');
  room.requests ??= {};
  if (room.requests[playerId] === topic) delete room.requests[playerId]; else room.requests[playerId] = topic;
}

export function vote(room, playerId, choice) {
  if (room.game === 'faceoff') return PARTY.faceoff.vote(room, playerId, choice);
  need(room.phase === 'voting', 'Voting is over');
  need(playerId !== round(room).artist, 'Artists do not vote on their own drawing');
  need(playerId !== round(room).subject, 'This question is about you');
  need(!(playerId in room.votes), 'Already voted');
  const option = room.options[choice];
  need(option, 'Pick an answer');
  need(!option.authors.includes(playerId), "You can't pick your own");
  room.votes[playerId] = choice;
  if (!waitingOn(room).length) advance(room);
}

// Moves to the next phase. Also what the host's "skip" button does.
export function merge(room, a, b) {
  need(room.game === 'majority', 'Nothing to combine');
  PARTY.majority.merge(room, a, b);
}

export function advance(room, random = Math.random) {
  if (PARTY[room.game]) {
    need(!['lobby', 'done'].includes(room.phase), 'Nothing to skip');
    return PARTY[room.game].advance(room, random);
  }
  if (room.phase === 'drawing') {
    room.rounds = shuffle(room.rounds.filter(r => r.drawing), random);
    if (!room.rounds.length) { room.phase = 'done'; room.step++; return; }
    open(room, 'writing');
  } else if (room.phase === 'writing') {
    const { subject } = round(room);
    if (subject) {
      // Without the real answer there is nothing to vote on, so move past the round.
      if (!(subject in room.fakes)) return nextRound(room);
      round(room).answer = room.fakes[subject];
    }
    const options = [{ text: round(room).answer, truth: true, authors: [] }];
    for (const [id, text] of Object.entries(room.fakes)) {
      if (subject && (id === subject || tooClose(text, round(room).answer))) continue;
      const same = options.find(o => normalize(o.text) === normalize(text));
      if (same) same.authors.push(id); else options.push({ text, truth: false, authors: [id] });
    }
    room.options = shuffle(options, random);
    open(room, 'voting');
  } else if (room.phase === 'voting') {
    score(room);
    open(room, 'reveal');
  } else if (room.phase === 'reveal') {
    nextRound(room);
  } else throw new GameError('Nothing to skip');
}

function nextRound(room) {
  if (room.index + 1 >= room.rounds.length) { room.phase = 'done'; room.step++; return; }
  room.index++;
  open(room, 'writing');
}

function score(room) {
  const add = (id, points) => {
    const p = room.players.find(p => p.id === id);
    if (p) { p.score += points; room.gains[id] = (room.gains[id] || 0) + points; }
  };
  for (const [voter, choice] of Object.entries(room.votes)) {
    const option = room.options[choice];
    if (option.truth) {
      add(voter, 1000);
      const owner = round(room).artist ?? round(room).subject;
      if (owner) add(owner, 500);
    }
    else option.authors.forEach(id => add(id, room.hints?.[id] ? 250 : 500)); // AI help halves it
  }
}

// What one player is allowed to see. Answers and authors stay hidden until the reveal.
export function view(room, playerId) {
  const names = Object.fromEntries(room.players.map(p => [p.id, p.name]));
  const r = round(room);
  const out = {
    game: room.game, phase: room.phase, step: room.step, you: playerId, host: room.players[0]?.id,
    players: room.players.map(({ id, name, score, face }) => ({ id, name, score, face })),
    index: room.index, total: room.rounds.length,
    waiting: room.phase === 'lobby' || room.phase === 'done' ? [] : waitingOn(room).map(id => names[id]),
  };
  out.requests = Object.entries(room.requests ?? {}).map(([id, topic]) => ({ id, name: names[id], topic }));
  if (PARTY[room.game]) {
    if (!['lobby', 'done'].includes(room.phase)) PARTY[room.game].view(room, playerId, out);
  } else if (room.phase === 'drawing') {
    const mine = room.rounds.find(x => x.artist === playerId);
    Object.assign(out, { prompt: mine?.answer, sent: Boolean(mine?.drawing) });
  } else if (r && ['writing', 'voting', 'reveal'].includes(room.phase)) {
    Object.assign(out, { question: r.question, drawing: r.drawing, artist: names[r.artist], isArtist: r.artist === playerId,
      subject: names[r.subject], isSubject: r.subject === playerId });
    if (room.phase === 'writing') {
      out.sent = playerId in room.fakes;
      out.hint = room.hints?.[playerId] || undefined;
      out.canHint = room.game === 'bluff' && !out.isSubject && !out.sent && !(playerId in (room.hints ?? {}));
    }
    if (room.phase === 'voting') {
      out.sent = playerId in room.votes;
      out.options = room.options.map(o => ({ text: o.text, mine: o.authors.includes(playerId) }));
    }
    if (room.phase === 'reveal') {
      out.options = room.options.map((o, i) => ({ text: o.text, truth: o.truth, authors: o.authors.map(id => names[id]), authorIds: o.authors, helped: o.authors.filter(id => room.hints?.[id]).map(id => names[id]),
        voters: Object.entries(room.votes).filter(([, c]) => c === i).map(([id]) => names[id]) }));
      out.gains = room.gains;
      const picked = room.options[room.votes[playerId]];
      out.bluffedBy = picked && !picked.truth ? picked.authors : [];
    }
  }
  return out;
}
