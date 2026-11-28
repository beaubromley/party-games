// Pure game rules: every function takes the room state and changes it. No database or network.
import { tooClose, repeats } from './match.js';
import * as mini from './mini.js';
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
  room.wants = {};
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
  room.wants = {};
  room.notice = '';
  Object.assign(room, { stats: {}, counted: false, liked: [], mini: undefined }); // each game has its own mini game trophy
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

// Every new screen starts with no likes, except that likes given while voting carry into the results.
export function enter(room, phase) {
  const carry = room.phase === 'voting' && phase === 'reveal';
  if (!carry) room.likes = {};
  room.phase = phase; room.step++;
  mini.moved(room, Date.now());
}
function open(room, phase) {
  enter(room, phase);
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
  if (room.wants) delete room.wants[id];
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
    const { question, answer, subject } = round(room);
    ask = { question, answer, subject };
  }
  room.hints ??= {};
  need(!(key in room.hints), 'You already used AI help on this one');
  room.hints[key] = '';
  return { ...ask, key };
}
// What others have already answered this one, so AI help doesn't copy them. Never sent to a phone.
export function takenAnswers(room, key) {
  const [, item] = key.split(':');
  return item === undefined ? Object.values(room.fakes) : Object.values(room.matches[item]?.answers ?? {});
}
// Stores the suggestion, or frees the reservation so nothing is charged. True if the player gets it.
export function saveHint(room, key, text) {
  const [id, item] = key.split(':');
  const answered = item === undefined ? id in room.fakes : id in (room.matches[item]?.answers ?? {});
  // Two people asking at once mustn't get the same idea.
  if (text && !answered && !repeats(text, room.suggested ?? [])) {
    room.hints[key] = text;
    room.suggested = [...room.suggested ?? [], text].slice(-60);
    return true;
  }
  delete room.hints[key];
  return false;
}

// What can be liked while a vote is open: one entry per answer on screen. `ref` is how a phone names it,
// so nobody has to be told who wrote what. A real answer gets a stand-in author, so it looks like any other.
function likeTargets(room) {
  const name = id => room.players.find(p => p.id === id)?.name;
  if (room.game === 'bluff' || room.game === 'doodle') return room.options.map((o, i) => ({ ref: i, text: o.text, authors: o.authors.length ? o.authors : [`*${i}`] }));
  if (duel(room.game)) return room.options.map((o, i) => ({ ref: i, text: o.text, authors: [o.author] }));
  if (room.game === 'oddone') return room.cast.filter(id => name(id) && id in room.answers).map(id => ({ ref: id, text: room.answers[id], by: name(id), authors: [id] }));
  if (room.game === 'whosaid') return room.list.map(a => ({ ref: a.n, text: a.text, authors: [a.author] }));
  if (room.game === 'split') {
    const s = room.scenarios[room.index];
    return [{ ref: 0, text: s.stem.replace('___', s.text), by: name(s.author), authors: [s.author] }];
  }
  return [];
}
// Only once your own turn is done, so likes can't sway your vote.
const canLikeNow = (room, id) => room.phase === 'voting' && !waitingOn(room).includes(id);

// A thumbs-up for someone's answer, after voting or on the results screen. Tap again to take it back. No points.
export function like(room, playerId, target) {
  need(room.phase === 'reveal' || canLikeNow(room, playerId), 'Like answers once you have voted');
  const mine = PARTY[room.game];
  need(room.game !== 'telephone' && (!mine || ['faceoff', 'majority', 'rap'].includes(room.game) || mine.likeable), 'No likes in this game');
  let authors;
  if (room.phase === 'voting') authors = likeTargets(room).find(t => t.ref === target)?.authors;
  else {
    const groups = mine?.likeable ? mine.likeable(room) : room.game === 'majority' ? room.groups.map(g => g.authors)
      : duel(room.game) ? room.options.map(o => [o.author]) : room.options.map(o => o.authors);
    authors = groups.find(list => list.includes(target));
  }
  need(authors, 'Pick an answer');
  need(!authors.includes(playerId), "That one's yours");
  const likes = room.likes ??= {}, liked = authors.some(a => likes[a]?.includes(playerId));
  const tally = (a, by) => { if (!a.startsWith('*')) extras.count(room, a, 'liked', by); };
  for (const a of authors) {
    const had = likes[a]?.includes(playerId);
    if (liked && had) { likes[a] = likes[a].filter(id => id !== playerId); tally(a, -1); }
    if (!liked) { (likes[a] ??= []).push(playerId); tally(a, 1); }
  }
  noteLikes(room, authors);
}

// The game's most liked answers, for the final results. One entry per answer; taking every like back removes it.
const LIKED_KEPT = 60;
function noteLikes(room, authors) {
  const name = id => room.players.find(p => p.id === id)?.name ?? room.gone?.[id];
  const text = room.game === 'majority' ? room.groups.find(g => g.authors.includes(authors[0])).texts[0]
    : likeTargets(room).find(t => t.authors.includes(authors[0]))?.text;
  const real = authors[0].startsWith('*') || room.options?.some(o => o.truth && o.authors === authors);
  const at = `${room.index}|${room.set}`;
  const fans = new Set(authors.flatMap(a => room.likes[a] ?? [])).size;
  // The host may have combined answers since, so match on anyone in common.
  const list = (room.liked ?? []).filter(l => l.at !== at || !l.authors.some(a => authors.includes(a)));
  if (fans) list.push({ at, authors: [...authors], text, by: real ? '' : authors.map(name).join(' & '), likes: fans });
  room.liked = list.slice(-LIKED_KEPT);
}
const mostLiked = room => [...room.liked ?? []].sort((a, b) => b.likes - a.likes).slice(0, 5).map(({ text, by, likes }) => ({ text, by, likes }));

// Your own turn, repeated back to you for as long as the screen is up.
function yours(room, id) {
  const name = who => room.players.find(p => p.id === who)?.name ?? room.gone?.[who];
  const writing = room.phase === 'writing', drawing = room.phase === 'drawing', voting = room.phase === 'voting';
  const out = [], say = (label, text) => { if (text !== undefined && text !== '') out.push({ label, text }); };
  if (room.game === 'bluff' || room.game === 'doodle') {
    if (drawing) { const mine = room.rounds.find(r => r.artist === id); if (mine?.drawing) out.push({ label: 'Your drawing', strokes: mine.drawing }); }
    else {
      say('Your answer', room.fakes[id]);
      if (voting) say('Your pick', room.options[room.votes[id]]?.text);
    }
  } else if (duel(room.game)) {
    if (writing) for (const m of room.matches) say(`Your answer to “${m.prompt.split('|')[0]}”`, m.answers[id]);
    if (voting) {
      say('Your answer', room.options.find(o => o.author === id)?.text);
      say('Your pick', room.options[room.votes[id]]?.text);
    }
  } else if (room.game === 'telephone') {
    const entry = (writing || drawing) && PARTY.telephone.book(room, id)?.entries[room.turn];
    if (entry) out.push(entry.strokes ? { label: 'Your drawing', strokes: entry.strokes } : { label: 'You wrote', text: entry.text });
  } else if (room.game === 'majority') {
    if (writing) say('Your answer', room.answers[id]);
  } else if (room.game === 'oddone') {
    say('Your answer', room.answers[id]);
    if (voting && id in room.votes) say('You suspect', name(room.votes[id]));
  } else if (room.game === 'split') {
    const s = writing && room.scenarios.find(s => s.author === id);
    if (s && s.text) say('You wrote', s.stem.replace('___', s.text));
    if (voting) say('You voted', { yes: 'Yes', no: 'No' }[room.votes[id]]);
  } else if (room.game === 'whosaid') {
    say('Your answer', room.answers[id]);
    const guesses = voting && room.votes[id];
    if (guesses) say('Your guesses', room.list.filter(a => a.n in guesses).map(a => `${a.text}: ${name(guesses[a.n])}`).join('\n'));
  } else if (room.game === 'snack') {
    // A night pick can give a role away, so it is marked to stay covered.
    if (writing && id in room.picks) out.push({ label: 'Your pick', text: name(room.picks[id]), secret: true });
    if (voting && id in room.votes) say('You voted', room.votes[id] === 'skip' ? 'Skip' : name(room.votes[id]));
  } else if (room.game === 'survival') {
    if (voting) say('You picked', room.quiz.choices[room.picks[id]]);
  }
  return out;
}

// Mini games are for anyone left waiting: in the lobby, or once their own turn is done.
export const canPlayMini = (room, id) => room.phase === 'lobby' || (TIMED.includes(room.phase) && !waitingOn(room).includes(id));
export function miniRound(room, playerId, now = Date.now()) {
  need(canPlayMini(room, playerId), 'Finish your own turn first');
  return mini.next(room, now);
}
export function miniScore(room, playerId, n, points, now = Date.now()) { return mini.score(room, playerId, n, points, now); }

// Which game to play next. Everyone gets one pick; tap it again to take it back.
export function want(room, playerId, game) {
  need(['lobby', 'done'].includes(room.phase), 'Vote for the next game between games');
  need(GAMES.includes(game), 'Unknown game');
  room.wants ??= {};
  if (room.wants[playerId] === game) delete room.wants[playerId]; else room.wants[playerId] = game;
}

// A new name between rounds. Night standings follow it.
export function rename(room, playerId, name) {
  need(['lobby', 'reveal', 'done'].includes(room.phase), 'Change names between rounds');
  name = clean(name, 14);
  need(name, 'Enter your name');
  const me = room.players.find(p => p.id === playerId), old = me.name.toLowerCase(), key = name.toLowerCase();
  need(!room.players.some(p => p !== me && p.name.toLowerCase() === key), 'That name is taken');
  need(!room.left?.[key] || room.left[key].id === playerId, 'That name is saved for someone who left');
  me.name = name;
  const mine = room.night?.[old];
  if (mine) {
    delete room.night[old];
    const there = room.night[key];
    room.night[key] = { name, points: mine.points + (there?.points ?? 0), wins: mine.wins + (there?.wins ?? 0) };
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

// Pestering: once you're done, poke one person who is still going. The host can switch it off at any time.
// Midnight Snack allows pokes only, from players still in.
const mayNudge = (room, id) => !room.pokesOff && TIMED.includes(room.phase) && !waitingOn(room).includes(id)
  && (room.game !== 'snack' || PARTY.snack.living(room).includes(id));
export const POKE_EVERY = 10000, POKED_EVERY = 10000; // per sender, and per person on the receiving end
const cooling = (room, id, now) => Math.max(0, ...(room.pokes ?? []).filter(p => p.by === id).map(p => p.at + POKE_EVERY - now));
export function poke(room, playerId, to, text, now = Date.now()) {
  need(!room.pokesOff, 'The host turned pestering off');
  need(mayNudge(room, playerId), 'Finish your own turn first');
  need(waitingOn(room).includes(to), "They're done now");
  text = clean(text, 60);
  need(!text || room.game !== 'snack', 'No notes in this game, just pokes');
  const list = room.pokes ??= [];
  const wait = cooling(room, playerId, now);
  need(!wait, `Easy there! Wait ${Math.ceil(wait / 1000)} more seconds.`);
  need(!list.some(p => p.to === to && now - p.at < POKED_EVERY), 'Someone just poked them. Give it a moment.');
  const from = room.players.find(p => p.id === playerId).name;
  room.pokeCount = (room.pokeCount || 0) + 1;
  list.push({ n: room.pokeCount, by: playerId, from, to, text, step: room.step, at: now });
  room.pokes = list.slice(-40);
}
export function setPokes(room, on) { room.pokesOff = !on; }

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
  out.pokesOff = Boolean(room.pokesOff);
  if (canPlayMini(room, playerId)) out.mini = mini.view(room, Date.now());
  if (room.phase === 'reveal') out.likes = room.likes ?? {};
  if (room.phase === 'lobby' || room.phase === 'done') out.wants = Object.entries(room.wants ?? {}).map(([id, game]) => ({ id, name: names[id], game }));
  // After voting: the answers again, to like. Who wrote them (and the counts) wait for the reveal.
  if (canLikeNow(room, playerId)) {
    const targets = room.phase === 'voting' ? likeTargets(room) : [];
    if (targets.length) out.likeables = targets.map(({ ref, text, by, authors }) => ({ ref, text, by,
      mine: authors.includes(playerId), liked: authors.some(a => room.likes?.[a]?.includes(playerId)) }));
  }
  if (TIMED.includes(room.phase)) {
    const mine = yours(room, playerId);
    if (mine.length) out.yours = mine;
  }
  out.highlights = { count: room.highlights?.length ?? 0, latest: room.highlightCount ?? 0 };
  out.reactions = (room.reactions ?? []).map(({ n, name, kind }) => ({ n, name, kind }));
  if (room.phase === 'done') { out.awards = extras.awards(room); out.mostLiked = mostLiked(room); out.miniTrophy = mini.trophy(room, Date.now()); }
  out.requests = Object.entries(room.requests ?? {}).map(([id, topic]) => ({ id, name: names[id], topic }));
  if (TIMED.includes(room.phase)) {
    const waiting = waitingOn(room);
    out.progress = expected(room).map(id => ({ name: names[id], done: !waiting.includes(id) }));
    if (room.deadline) out.timeLeft = Math.max(0, room.deadline - Date.now());
    if (mayNudge(room, playerId) && waiting.length) Object.assign(out, { nudge: waiting.map(id => ({ id, name: names[id] })), canNote: room.game !== 'snack', pokeWait: cooling(room, playerId, Date.now()) });
    // Only the person poked sees it, and only while that screen is still up.
    out.pokes = (room.pokesOff ? [] : room.pokes ?? []).filter(p => p.to === playerId && p.step === room.step).map(({ n, from, text }) => ({ n, from, text }));
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
