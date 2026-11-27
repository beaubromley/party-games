import { randomBytes, randomInt } from 'node:crypto';
import * as rules from './rules.js';
import { addQuestions } from './db.js';
import starter from './questions.js';
import { suggest } from './hint.js';
import { tooClose } from './match.js';
import { isTopic } from '../public/topics.js';
import { DOODLE_PROMPTS } from '../public/words.js';
import { BIBLE, WORDS, ABOUT_US, TOPICS } from './modes.js';
import { FACEOFF, MAJORITY } from './party-content.js';
import { ODD, SPLIT, WHOSAID, SURVIVAL, RAP } from './more-content.js';
const { GameError } = rules;

const DUELS = { faceoff: FACEOFF, rap: RAP };
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels, so codes never spell words
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
const newPlayer = name => ({ id: randomBytes(6).toString('hex'), secret: randomBytes(16).toString('hex'), name });

async function load(query, code) {
  const { rows } = await query('SELECT version, state FROM rooms WHERE code = ?', [code]);
  if (!rows.length) throw new GameError('Room not found');
  return { version: rows[0].version, room: JSON.parse(rows[0].state) };
}

// Optimistic locking: if another phone saved first, reload and apply the change again.
async function change(query, code, mutate) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const { version, room } = await load(query, code);
    await mutate(room);
    rules.stamp(room);
    rules.tally(room);
    const { changes } = await query('UPDATE rooms SET version = ?, state = ?, updated = ? WHERE code = ? AND version = ?',
      [version + 1, JSON.stringify(room), Date.now(), code, version]);
    if (changes) return { version: version + 1, room };
    await new Promise(r => setTimeout(r, 20 + Math.random() * 40 * (attempt + 1)));
  }
  throw new GameError('The room is busy. Try again.');
}

// A room doesn't repeat a prompt until it has run short of new ones.
function unused(room, pool, items, count, key = item => item) {
  const seen = new Set(room?.seen?.[pool]);
  const left = items.filter(item => !seen.has(key(item)));
  if (left.length >= count) return left;
  if (room?.seen) delete room.seen[pool];
  return items;
}
function remember(room, pool, keys) {
  if (room) ((room.seen ??= {})[pool] ??= []).push(...keys);
}
function draw(room, pool, items, count) {
  const picked = rules.shuffle(unused(room, pool, items, count)).slice(0, count);
  remember(room, pool, picked);
  return picked;
}

// Pass `room` to skip what it has seen and note what it is dealt; previews pass nothing.
async function content(query, topic, count, players, room) {
  const levels = Object.hasOwn(TOPICS, topic) ? TOPICS[topic] : topic === 'bible' ? BIBLE : topic === 'words' ? { words: WORDS } : null;
  if (levels) {
    const all = Object.values(levels).flat(), key = q => q.question;
    const allowed = new Set(unused(room, topic, all, count, key));
    const picked = rules.mixed(Object.fromEntries(Object.entries(levels).map(([name, list]) => [name, list.filter(q => allowed.has(q))])), count);
    remember(room, topic, picked.map(key));
    return picked;
  }
  if (topic === 'about') {
    const order = rules.shuffle(players), prompts = draw(room, 'about', ABOUT_US, count);
    return prompts.map((prompt, i) => {
      const p = order[i % order.length];
      return { question: prompt.replace('{name}', p.name), subject: p.id };
    });
  }
  return questions(query, count, room);
}

// What each game needs in order to start. `choice` is the length the host picked.
async function deal(query, room, { topic, rounds: choice }) {
  const pick = (allowed, fallback) => allowed.includes(choice) ? choice : fallback;
  if (room.game === 'bluff') return content(query, topic, pick([3, 5, 8], 5), room.players, room);
  if (room.game === 'faceoff' || room.game === 'rap') {
    const sets = pick([1, 2], 1);
    return { sets, prompts: draw(room, room.game, DUELS[room.game], sets * room.players.length) };
  }
  if (room.game === 'majority') return { prompts: draw(room, 'majority', MAJORITY, pick([5, 8, 12], 8)) };
  if (room.game === 'telephone' || room.game === 'snack') return {};
  if (room.game === 'oddone') return { prompts: draw(room, 'oddone', ODD, pick([3, 5, 8], 5)) };
  if (room.game === 'whosaid') return { prompts: draw(room, 'whosaid', WHOSAID, pick([3, 5, 8], 5)) };
  // Enough for every seat in every round, so latecomers get their own.
  if (room.game === 'split') { const sets = pick([1, 2], 1); return { sets, stems: draw(room, 'split', SPLIT, sets * rules.MAX_PLAYERS) }; }
  if (room.game === 'survival') return { questions: draw(room, 'survival', SURVIVAL, pick([8, 12, 16], 12)) };
  return draw(room, 'doodle', DOODLE_PROMPTS, room.players.length);
}

async function questions(query, count, room) {
  const pick = async () => {
    const seen = room?.seen?.trivia ?? [];
    const skip = seen.length ? `WHERE question NOT IN (${seen.map(() => '?').join(', ')}) ` : '';
    return (await query(`SELECT question, answer FROM questions ${skip}ORDER BY RANDOM() LIMIT ?`, [...seen, count])).rows;
  };
  let rows = await pick();
  if (rows.length < count && room?.seen) { delete room.seen.trivia; rows = await pick(); }
  if (rows.length < count) { await addQuestions(query, starter); rows = await pick(); }
  remember(room, 'trivia', rows.map(q => q.question));
  return rows;
}

// The host's phone checks in; if it goes quiet, someone else may take over.
const AWAY_AFTER = 5 * 60 * 1000;
const hostSeen = (query, code) => query('INSERT OR REPLACE INTO presence (code, seen) VALUES (?, ?)', [code, Date.now()]);
async function hostAway(query, code) {
  const { rows } = await query('SELECT seen FROM presence WHERE code = ?', [code]);
  if (!rows.length) { await hostSeen(query, code); return false; }
  return Date.now() - rows[0].seen > AWAY_AFTER;
}

const DAILY_HINTS = 300; // caps API spending, since anyone with the link can open a room

async function hint(query, code, body, auth, ask) {
  let player, round;
  await change(query, code, room => {
    player = auth(room);
    if (body.step !== room.step) throw new GameError('The game moved on');
    round = rules.reserveHint(room, player.id);
  });
  let text = '', problem = 'AI help is unavailable right now. No points lost.';
  try {
    const day = new Date().toISOString().slice(0, 10);
    await query('INSERT OR IGNORE INTO hint_usage (day, n) VALUES (?, 0)', [day]);
    const { changes } = await query('UPDATE hint_usage SET n = n + 1 WHERE day = ? AND n < ?', [day, DAILY_HINTS]);
    if (!changes) problem = "Today's AI help is used up.";
    else {
      // "About us" questions name a player; the name is not sent.
      const subject = (await load(query, code)).room.players.find(p => p.id === round.subject);
      const question = subject ? round.question.replaceAll(subject.name, 'this player') : round.question;
      text = await ask({ question, answer: round.answer, funny: round.funny });
      if (round.answer && tooClose(text, round.answer)) text = '';
    }
  } catch (err) { console.error(err.message); }
  // Save the suggestion, or release the reservation so nothing is charged.
  let delivered = false;
  const saved = await change(query, code, room => {
    delivered = false;
    if (room.step !== body.step || !room.hints) return;
    delivered = rules.saveHint(room, round.key, text);
  });
  if (!delivered) throw new GameError(problem);
  return { version: saved.version, state: rules.view(saved.room, player.id) };
}

// Quick Draw on other phones: the drawer's phone uploads its picture, watchers poll it. The word is only sent afterwards.
async function cast(query, body) {
  const { action } = body, code = String(body.code ?? '').toUpperCase().trim();
  if (action === 'cast-start') {
    await query('DELETE FROM casts WHERE updated < ?', [Date.now() - 24 * 3600 * 1000]);
    const secret = randomBytes(16).toString('hex');
    for (let i = 0; i < 10; i++) {
      const made = makeCode();
      const { changes } = await query('INSERT OR IGNORE INTO casts (code, secret, version, state, updated) VALUES (?, ?, 1, ?, ?)',
        [made, secret, JSON.stringify({ status: 'waiting', strokes: [] }), Date.now()]);
      if (changes) return { code: made, secret };
    }
    throw new GameError('Could not start sharing. Try again.');
  }
  if (action === 'cast-send') {
    const { status, strokes = [], word, seconds } = body;
    if (!['waiting', 'drawing', 'done'].includes(status) || !(Array.isArray(strokes) && (!strokes.length || rules.validDrawing(strokes)))) throw new GameError('Could not share that');
    const state = { status, strokes, word: status === 'done' ? rules.clean(word, 60) : undefined,
      ends: status === 'drawing' ? Date.now() + Math.min(600, Math.max(0, Number(seconds) || 0)) * 1000 : undefined };
    const { changes } = await query('UPDATE casts SET version = version + 1, state = ?, updated = ? WHERE code = ? AND secret = ?',
      [JSON.stringify(state), Date.now(), code, String(body.secret ?? '')]);
    if (!changes) throw new GameError('Sharing has ended');
    return {};
  }
  if (action === 'cast-watch') {
    const { rows } = await query('SELECT version FROM casts WHERE code = ?', [code]);
    if (!rows.length) throw new GameError('Nobody is sharing with that code');
    if (rows[0].version === body.version) return { version: body.version };
    const [row] = (await query('SELECT version, state FROM casts WHERE code = ?', [code])).rows;
    const { ends, ...state } = JSON.parse(row.state);
    return { version: row.version, ...state, seconds: ends && Math.max(0, Math.ceil((ends - Date.now()) / 1000)) };
  }
  throw new GameError('Unknown action');
}

export async function handle(query, body, { ask = suggest } = {}) {
  const { action } = body;
  const reply = (version, room, player) => ({ version, state: rules.view(room, player.id) });

  if (action === 'create') {
    await query('DELETE FROM rooms WHERE updated < ?', [Date.now() - 24 * 3600 * 1000]);
    await query('DELETE FROM faces WHERE code NOT IN (SELECT code FROM rooms)');
    await query('DELETE FROM presence WHERE code NOT IN (SELECT code FROM rooms)');
    const room = rules.newRoom(body.game), player = newPlayer(body.name);
    rules.join(room, player);
    for (let i = 0; i < 10; i++) {
      const code = makeCode();
      const { changes } = await query('INSERT OR IGNORE INTO rooms (code, version, state, updated) VALUES (?, 1, ?, ?)', [code, JSON.stringify(room), Date.now()]);
      if (!changes) continue;
      await hostSeen(query, code);
      return { code, playerId: player.id, secret: player.secret, ...reply(1, room, player) };
    }
    throw new GameError('Could not create a room. Try again.');
  }

  if (action?.startsWith('cast-')) return cast(query, body);

  const code = String(body.code ?? '').toUpperCase().trim();
  if (action === 'join') {
    const player = newPlayer(body.name);
    let joined;
    const saved = await change(query, code, room => {
      const playing = !['lobby', 'done'].includes(room.phase), extra = {};
      if (playing && room.game === 'doodle') [extra.prompt] = draw(room, 'doodle', DOODLE_PROMPTS, 1);
      if (playing && DUELS[room.game]) extra.prompts = draw(room, room.game, DUELS[room.game], room.sets);
      joined = rules.join(room, player, extra);
    });
    if (saved.room.players[0].id === joined.id) await hostSeen(query, code);
    return { code, playerId: joined.id, secret: joined.secret, game: saved.room.game, ...reply(saved.version, saved.room, joined) };
  }

  const auth = room => {
    const p = room.players.find(p => p.id === body.playerId && p.secret === body.secret);
    if (!p) throw new GameError('You are not in this room');
    return p;
  };
  if (action === 'poll') {
    // Cheap check first: skip downloading the room (drawings included) when nothing changed.
    // Only for callers already holding this version, which they got by proving who they are.
    if (body.version) {
      const { rows } = await query('SELECT version FROM rooms WHERE code = ?', [code]);
      if (rows[0]?.version === body.version) return { version: body.version };
    }
    const { version, room } = await load(query, code);
    const player = auth(room);
    return version === body.version ? { version } : reply(version, room, player);
  }

  if (action === 'ping') {
    const { room } = await load(query, code);
    if (auth(room).id !== room.players[0].id) return { hostAway: await hostAway(query, code) };
    await hostSeen(query, code);
    return { hostAway: false };
  }

  // Leaving, removing someone and taking over work from any screen, so they skip the step check.
  if (['leave', 'kick', 'claim'].includes(action)) {
    const away = action === 'claim' && await hostAway(query, code);
    let me, newHost;
    const saved = await change(query, code, room => {
      me = auth(room);
      const before = room.players[0].id;
      if (action === 'leave') rules.remove(room, me.id);
      else if (action === 'kick') {
        if (before !== me.id) throw new GameError('Only the host can remove players');
        if (body.target === me.id) throw new GameError('Use Leave game to remove yourself');
        rules.remove(room, body.target);
      } else {
        if (!away) throw new GameError('The host is still here');
        room.players = [me, ...room.players.filter(p => p.id !== me.id)];
      }
      newHost = room.players[0]?.id !== before;
    });
    if (newHost) await hostSeen(query, code);
    const gone = action === 'leave' ? me.id : action === 'kick' ? body.target : null;
    if (gone) await query('DELETE FROM faces WHERE code = ? AND player = ?', [code, gone]);
    return reply(saved.version, saved.room, me);
  }

  // Reactions come in at any moment on a results screen, so they skip the step check too.
  if (action === 'react') {
    let me;
    const saved = await change(query, code, room => { me = auth(room); rules.react(room, me.id, body.kind); });
    return reply(saved.version, saved.room, me);
  }

  // Pokes aim at whoever is still going right now, so no step check either.
  if (action === 'poke') {
    let me;
    const saved = await change(query, code, room => { me = auth(room); rules.poke(room, me.id, body.to, body.text); });
    return reply(saved.version, saved.room, me);
  }

  if (action === 'faces') {
    auth((await load(query, code)).room);
    const { rows } = await query('SELECT player, data FROM faces WHERE code = ?', [code]);
    return { faces: Object.fromEntries(rows.map(r => [r.player, r.data])) };
  }
  // A face photo (or '' to remove it) can change at any point, so it skips the step check.
  if (action === 'face') {
    const data = String(body.data ?? '');
    if (data && !(data.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data))) throw new GameError("That photo didn't work. Try another.");
    const me = auth((await load(query, code)).room);
    if (data) await query('INSERT OR REPLACE INTO faces (code, player, data) VALUES (?, ?, ?)', [code, me.id, data]);
    else await query('DELETE FROM faces WHERE code = ? AND player = ?', [code, me.id]);
    const saved = await change(query, code, room => {
      const p = auth(room);
      if (data) p.face = randomBytes(4).toString('hex'); else delete p.face;
    });
    return reply(saved.version, saved.room, me);
  }

  // Fetched only when someone opens them, because drawings are big.
  if (action === 'highlights') {
    const { room } = await load(query, code);
    auth(room);
    return { highlights: [...room.highlights ?? []].reverse() };
  }

  // A few sample questions, never the answers.
  if (action === 'preview') {
    auth((await load(query, code)).room);
    if (!isTopic(body.topic)) throw new GameError('Unknown topic');
    const list = body.topic === 'about'
      ? rules.shuffle(ABOUT_US).slice(0, 3).map(q => ({ question: q.replaceAll('{name}', 'a player') }))
      : await content(query, body.topic, 3, []);
    return { samples: list.map(q => q.question) };
  }

  if (action === 'hint') return hint(query, code, body, auth, ask);

  let player;
  const saved = await change(query, code, async room => {
    player = auth(room);
    const isHost = room.players[0].id === player.id;
    // A tap that was meant for an earlier screen must not act on the current one.
    if (body.step !== room.step) throw new GameError('The game moved on');
    if (action === 'start') {
      if (!isHost || !['lobby', 'done'].includes(room.phase)) throw new GameError('Only the host can start');
      const dealt = await deal(query, room, body);
      room.timer = rules.TIMERS.includes(body.timer) ? body.timer : 0;
      room.clockFor = '';
      rules.start(room, dealt);
    } else if (action === 'request') rules.requestTopic(room, player.id, body.topic);
    else if (action === 'drawing') rules.submitDrawing(room, player.id, body.strokes);
    else if (action === 'fake') rules.submitFake(room, player.id, body.text, body.item);
    else if (action === 'unsend') rules.unsend(room, player.id, body.item);
    else if (action === 'vote') rules.vote(room, player.id, body.choice);
    else if (action === 'merge') {
      if (!isHost) throw new GameError('Only the host can combine answers');
      rules.merge(room, body.a, body.b);
    } else if (action === 'like') rules.like(room, player.id, body.target);
    else if (action === 'forget') {
      if (!isHost || !['lobby', 'done'].includes(room.phase)) throw new GameError('Only the host can reset the standings');
      room.night = {};
      room.highlights = [];
    } else if (action === 'switch') {
      if (!isHost) throw new GameError('Only the host can switch games');
      rules.switchGame(room, body.game);
    } else if (action === 'restart') {
      if (!isHost || room.phase === 'lobby') throw new GameError('Only the host can restart a game');
      rules.restart(room, room.phase === 'done' ? '' : 'The host restarted the game.');
    } else if (action === 'next') {
      if (!isHost) throw new GameError('Only the host can skip');
      rules.advance(room);
    } else throw new GameError('Unknown action');
  });
  return reply(saved.version, saved.room, player);
}
