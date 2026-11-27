// Pure game rules: every function takes the room state and changes it. No database or network.
import { tooClose } from './match.js';
import { isTopic } from '../public/topics.js';
import { PARTY } from './party.js';
import * as extras from './extras.js';
export { tally } from './extras.js';
export class GameError extends Error {}
const need = (ok, message) => { if (!ok) throw new GameError(message); };
export const MIN_PLAYERS = 2, MAX_PLAYERS = 12;
export const GAMES = ['bluff', 'doodle', 'faceoff', 'majority', 'telephone', 'oddone', 'split', 'whosaid', 'snack', 'survival', 'rap'];
const duel = game => game === 'faceoff' || game === 'rap'; // head-to-head writing games
// Fewest players to start a game, and to keep one going.
const startMin = game => PARTY[game]?.startMin ?? PARTY[game]?.min ?? MIN_PLAYERS;
const keepMin = game => PARTY[game]?.min ?? MIN_PLAYERS;
export const TIMERS = [0, 30, 60, 90, 120];
const TIMED = ['writing', 'drawing', 'voting'];

// Starts a new countdown whenever the turn changes. It only nudges: nothing moves on by itself.
export function stamp(room, now = Date.now()) {
  const turn = [room.phase, room.step === 0, room.index, room.set, room.turn].join();
  if (turn === room.clockFor) return;
  room.clockFor = turn;
  // Drawing, and writing two Face-Off answers, get double time.
  const double = room.phase === 'drawing' || (duel(room.game) && room.phase === 'writing');
  room.deadline = room.timer && TIMED.includes(room.phase) ? now + room.timer * (double ? 2000 : 1000) : 0;
}

// The host moves everyone to another game without anybody rejoining.
export function switchGame(room, game) {
  need(['lobby', 'done'].includes(room.phase), 'Finish or restart this game first');
  need(GAMES.includes(game), 'Unknown game');
  room.game = game;
  room.requests = {};
  restart(room);
}

// Who has a job this turn.
function expected(room) {
  const all = room.players.map(p => p.id);
  if (duel(room.game)) return room.phase === 'voting' ? PARTY.faceoff.voters(room) : all;
  if (room.game === 'telephone' && room.phase !== 'voting') return all.filter(id => room.order.includes(id));
  if (duel(room.game) && room.phase === 'writing') return all.filter(id => room.matches.some(m => m.players.includes(id)));
  if (PARTY[room.game]) return PARTY[room.game].expected?.(room) ?? all;
  if (room.phase === 'drawing') return all.filter(id => room.rounds.some(r => r.artist === id));
  const { artist, subject } = round(room);
  return all.filter(id => id !== artist && (room.phase === 'writing' || id !== subject));
}

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
  need(GAMES.includes(game), 'Unknown game');
  return { game, phase: 'lobby', step: 0, players: [], rounds: [], index: 0, fakes: {}, votes: {}, options: [], gains: {} };
}

// Anyone can join at any point. A returning name gets its old seat and score back.
// `extra` is what a late arrival needs dealt: a drawing prompt, or Face-Off prompts for later rounds.
export function join(room, { id, secret, name }, extra = {}) {
  name = clean(name, 14);
  need(name, 'Enter your name');
  need(room.players.length < MAX_PLAYERS, 'Room is full');
  need(!room.players.some(p => p.name.toLowerCase() === name.toLowerCase()), 'That name is taken');
  const back = room.left?.[name.toLowerCase()];
  const player = { id: back?.id ?? id, secret, name, score: back?.score ?? 0 };
  room.players.push(player);
  if (back) delete room.left[name.toLowerCase()];
  delete room.gone?.[player.id];
  if (room.game === 'doodle' && room.phase === 'drawing' && extra.prompt && !room.rounds.some(r => r.artist === player.id)) {
    room.rounds.push({ artist: player.id, answer: extra.prompt, drawing: null });
  }
  if (duel(room.game) && !['lobby', 'done'].includes(room.phase)) room.prompts.push(...extra.prompts ?? []);
  return player;
}
// Scores belong to one game, including those of players who stepped out.
const forgetScores = room => Object.values(room.left ?? {}).forEach(p => { p.score = 0; });

// Bluff: content = [{question, answer}]. Doodle: content = one prompt string per player.
export function start(room, content) {
  need(room.players.length >= startMin(room.game), `Need at least ${startMin(room.game)} players`);
  room.players.forEach(p => { p.score = 0; });
  forgetScores(room);
  room.index = 0;
  room.requests = {};
  room.notice = '';
  Object.assign(room, { stats: {}, counted: false });
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
  room.phase = phase; room.step++; room.likes = {};
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

// Back to the lobby, keeping everyone in the room.
export function restart(room, notice = '') {
  Object.assign(room, { phase: 'lobby', rounds: [], index: 0, fakes: {}, votes: {}, options: [], gains: {}, hints: {}, notice });
  room.step++;
  room.players.forEach(p => { p.score = 0; });
  forgetScores(room);
}

// Takes a player out at any point. The game carries on where it can, and returns to the lobby where it can't.
export function remove(room, id) {
  const at = room.players.findIndex(p => p.id === id);
  need(at >= 0, 'They already left');
  const [leaver] = room.players.splice(at, 1);
  (room.gone ??= {})[id] = leaver.name; // results already on screen still show who it was
  (room.left ??= {})[leaver.name.toLowerCase()] = { id, score: leaver.score }; // in case they come back
  if (room.requests) delete room.requests[id];
  if (['lobby', 'done'].includes(room.phase)) return;
  const least = keepMin(room.game);
  if (room.players.length < least) return restart(room, `${leaver.name} left, and this game needs ${least} players. Back to the lobby.`);
  if (PARTY[room.game]) return PARTY[room.game].remove(room, id);

  const theirs = r => r.artist === id || r.subject === id;
  if (room.phase === 'drawing') {
    room.rounds = room.rounds.filter(r => !theirs(r));
    if (!waitingOn(room).length) advance(room);
    return;
  }
  const current = round(room);
  room.rounds = room.rounds.filter((r, i) => i <= room.index || !theirs(r));
  delete room.hints?.[id];
  if (room.phase === 'reveal') return;
  // Their own drawing, or a question about them, can't be finished.
  if (theirs(current)) {
    room.rounds.splice(room.index, 1);
    if (room.index >= room.rounds.length) { room.phase = 'done'; room.step++; return; }
    return open(room, 'writing');
  }
  delete room.fakes[id];
  if (room.phase === 'voting') {
    delete room.votes[id];
    const before = room.options, kept = [];
    for (const o of before) {
      o.authors = o.authors.filter(a => a !== id);
      if (o.truth || o.authors.length) kept.push(o);
    }
    if (kept.length !== before.length) {
      // Positions shifted: re-point votes, free anyone who picked the removed answer, and redraw every phone.
      for (const [voter, choice] of Object.entries(room.votes)) {
        const now = kept.indexOf(before[choice]);
        if (now < 0) delete room.votes[voter]; else room.votes[voter] = now;
      }
      room.options = kept;
      room.step++;
    }
  }
  if (!waitingOn(room).length) advance(room);
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
  if (PARTY[room.game]) {
    need(PARTY[room.game].text, 'Nothing to write in this game');
    return PARTY[room.game].text(room, playerId, text, item);
  }
  need(room.phase === 'writing', 'Writing time is over');
  need(playerId !== round(room).artist, 'This one is your drawing');
  need(!(playerId in room.fakes), 'Already sent');
  text = clean(text, 60);
  need(normalize(text), 'Write something');
  need(round(room).subject || !tooClose(text, round(room).answer, { loose: room.game === 'doodle' }), 'Too close to the real answer. Try another!');
  room.fakes[playerId] = text;
  if (!waitingOn(room).length) advance(room);
}

// AI help: one per Bluff round, or one per Face-Off prompt. '' marks a request still in progress.
export function reserveHint(room, playerId) {
  need(['bluff', 'faceoff'].includes(room.game) && room.phase === 'writing', 'AI help is only for writing an answer');
  let key = playerId, ask;
  if (room.game === 'faceoff') {
    const item = PARTY.faceoff.todo(room, playerId);
    need(item >= 0, 'Already sent');
    key = `${playerId}:${item}`;
    ask = { question: room.matches[item].prompt, funny: true };
  } else {
    need(playerId !== round(room).subject, 'Answer this one yourself. It is about you.');
    need(!(playerId in room.fakes), 'Already sent');
    ask = round(room);
  }
  room.hints ??= {};
  need(!(key in room.hints), 'You already used AI help on this one');
  room.hints[key] = '';
  return { ...ask, key };
}
// Stores the suggestion, or frees the reservation so nothing is charged. True if the player gets it.
export function saveHint(room, key, text) {
  const [id, item] = key.split(':');
  const answered = item === undefined ? id in room.fakes : id in (room.matches[item]?.answers ?? {});
  if (text && !answered) { room.hints[key] = text; return true; }
  delete room.hints[key];
  return false;
}

// A thumbs-up for someone's answer on the results screen. Tap again to take it back. No points.
export function like(room, playerId, author) {
  need(room.phase === 'reveal' && room.game !== 'telephone', 'Like answers on the results screen');
  const mine = PARTY[room.game];
  need(!mine || ['faceoff', 'majority', 'rap'].includes(room.game) || mine.likeable, 'No likes in this game');
  const groups = mine?.likeable ? mine.likeable(room) : room.game === 'majority' ? room.groups.map(g => g.authors)
    : duel(room.game) ? room.options.map(o => [o.author]) : room.options.map(o => o.authors);
  const authors = groups.find(list => list.includes(author));
  need(authors, 'Pick an answer');
  need(!authors.includes(playerId), "That one's yours");
  const likes = room.likes ??= {}, liked = authors.some(a => likes[a]?.includes(playerId));
  for (const a of authors) {
    const had = likes[a]?.includes(playerId);
    if (liked && had) { likes[a] = likes[a].filter(id => id !== playerId); extras.count(room, a, 'liked', -1); }
    if (!liked) { (likes[a] ??= []).push(playerId); extras.count(room, a, 'liked'); }
  }
}

// Players ask the host for a topic between games. Tapping the same one again withdraws it.
export function requestTopic(room, playerId, topic) {
  need(room.game === 'bluff' && ['lobby', 'done'].includes(room.phase), 'Request topics between games');
  need(isTopic(topic), 'Unknown topic');
  room.requests ??= {};
  if (room.requests[playerId] === topic) delete room.requests[playerId]; else room.requests[playerId] = topic;
}

export function vote(room, playerId, choice) {
  if (PARTY[room.game]?.vote) return PARTY[room.game].vote(room, playerId, choice);
  need(room.game !== 'majority', 'No voting in this game');
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

export function react(room, playerId, kind) {
  need(['reveal', 'done'].includes(room.phase), 'Save it for the results');
  need(Number.isInteger(kind) && kind >= 0 && kind < extras.REACTIONS, 'Unknown reaction');
  need(extras.react(room, room.players.find(p => p.id === playerId), kind), 'One at a time!');
}

// Take a typed answer back to fix it, for as long as the others are still writing.
export function unsend(room, playerId, item) {
  need(room.phase === 'writing', 'Too late to change it');
  if (PARTY[room.game]) {
    need(PARTY[room.game].unsend, 'Picks are final in this game');
    return PARTY[room.game].unsend(room, playerId, item);
  }
  need(playerId in room.fakes, 'Nothing to edit');
  delete room.fakes[playerId];
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
  extras.roundHighlight(room);
  const add = (id, points) => {
    const p = room.players.find(p => p.id === id);
    if (p) { p.score += points; room.gains[id] = (room.gains[id] || 0) + points; }
  };
  for (const [voter, choice] of Object.entries(room.votes)) {
    const option = room.options[choice];
    if (option.truth) {
      add(voter, 1000);
      extras.count(room, voter, 'found');
      const owner = round(room).artist ?? round(room).subject;
      if (owner) add(owner, 500);
      if (round(room).artist) extras.count(room, owner, 'guessed');
    } else {
      extras.count(room, voter, 'gullible');
      option.authors.forEach(id => { add(id, room.hints?.[id] ? 250 : 500); extras.count(room, id, 'fooled'); }); // AI help halves it
    }
  }
}

// What one player is allowed to see. Answers and authors stay hidden until the reveal.
export function view(room, playerId) {
  const names = { ...room.gone, ...Object.fromEntries(room.players.map(p => [p.id, p.name])) };
  const r = round(room);
  const out = {
    game: room.game, phase: room.phase, step: room.step, you: playerId, host: room.players[0]?.id,
    players: room.players.map(({ id, name, score, face }) => ({ id, name, score, face })),
    index: room.index, total: room.rounds.length, notice: room.notice || undefined,
    waiting: room.phase === 'lobby' || room.phase === 'done' ? [] : waitingOn(room).map(id => names[id]),
  };
  out.night = extras.standings(room);
  if (room.phase === 'reveal') out.likes = room.likes ?? {};
  out.highlights = { count: room.highlights?.length ?? 0, latest: room.highlightCount ?? 0 };
  out.reactions = (room.reactions ?? []).map(({ n, name, kind }) => ({ n, name, kind }));
  if (room.phase === 'done') out.awards = extras.awards(room);
  out.requests = Object.entries(room.requests ?? {}).map(([id, topic]) => ({ id, name: names[id], topic }));
  if (TIMED.includes(room.phase)) {
    const waiting = waitingOn(room);
    out.progress = expected(room).map(id => ({ name: names[id], done: !waiting.includes(id) }));
    if (room.deadline) out.timeLeft = Math.max(0, room.deadline - Date.now());
  }
  if (PARTY[room.game]) {
    if (room.phase === 'done') PARTY[room.game].done?.(room, out);
    else if (room.phase !== 'lobby') PARTY[room.game].view(room, playerId, out);
  } else if (room.phase === 'drawing') {
    const mine = room.rounds.find(x => x.artist === playerId);
    Object.assign(out, { prompt: mine?.answer, sent: Boolean(mine?.drawing) });
  } else if (r && ['writing', 'voting', 'reveal'].includes(room.phase)) {
    Object.assign(out, { question: r.question, drawing: r.drawing, artist: names[r.artist], isArtist: r.artist === playerId,
      subject: names[r.subject], isSubject: r.subject === playerId });
    if (room.phase === 'writing') {
      out.sent = playerId in room.fakes;
      out.mine = room.fakes[playerId];
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
