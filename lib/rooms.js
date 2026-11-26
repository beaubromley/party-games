import { randomBytes, randomInt } from 'node:crypto';
import * as rules from './rules.js';
import { addQuestions } from './db.js';
import starter from './questions.js';
import { suggest } from './hint.js';
import { tooClose } from './match.js';
import { DOODLE_PROMPTS } from '../public/words.js';
import { BIBLE, WORDS, ABOUT_US, TOPICS } from './modes.js';
const { GameError } = rules;

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
    const { changes } = await query('UPDATE rooms SET version = ?, state = ?, updated = ? WHERE code = ? AND version = ?',
      [version + 1, JSON.stringify(room), Date.now(), code, version]);
    if (changes) return { version: version + 1, room };
    await new Promise(r => setTimeout(r, 20 + Math.random() * 40 * (attempt + 1)));
  }
  throw new GameError('The room is busy. Try again.');
}

async function content(query, topic, count, players) {
  if (Object.hasOwn(TOPICS, topic)) return rules.mixed(TOPICS[topic], count);
  if (topic === 'bible') return rules.mixed(BIBLE, count);
  if (topic === 'words') return rules.shuffle(WORDS).slice(0, count);
  if (topic === 'about') {
    const order = rules.shuffle(players), prompts = rules.shuffle(ABOUT_US);
    return Array.from({ length: count }, (_, i) => {
      const p = order[i % order.length];
      return { question: prompts[i].replace('{name}', p.name), subject: p.id };
    });
  }
  return questions(query, count);
}

async function questions(query, count) {
  const pick = () => query('SELECT question, answer FROM questions ORDER BY RANDOM() LIMIT ?', [count]);
  let { rows } = await pick();
  if (rows.length < count) { await addQuestions(query, starter); ({ rows } = await pick()); }
  return rows;
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
      text = await ask({ question, answer: round.answer });
      if (round.answer && tooClose(text, round.answer)) text = '';
    }
  } catch (err) { console.error(err.message); }
  // Save the suggestion, or release the reservation so nothing is charged.
  let delivered = false;
  const saved = await change(query, code, room => {
    delivered = false;
    if (room.step !== body.step || !room.hints) return;
    if (text && !(player.id in room.fakes)) { room.hints[player.id] = text; delivered = true; }
    else delete room.hints[player.id];
  });
  if (!delivered) throw new GameError(problem);
  return { version: saved.version, state: rules.view(saved.room, player.id) };
}

export async function handle(query, body, { ask = suggest } = {}) {
  const { action } = body;
  const reply = (version, room, player) => ({ version, state: rules.view(room, player.id) });

  if (action === 'create') {
    await query('DELETE FROM rooms WHERE updated < ?', [Date.now() - 24 * 3600 * 1000]);
    await query('DELETE FROM faces WHERE code NOT IN (SELECT code FROM rooms)');
    const room = rules.newRoom(body.game), player = newPlayer(body.name);
    rules.join(room, player);
    for (let i = 0; i < 10; i++) {
      const code = makeCode();
      const { changes } = await query('INSERT OR IGNORE INTO rooms (code, version, state, updated) VALUES (?, 1, ?, ?)', [code, JSON.stringify(room), Date.now()]);
      if (changes) return { code, playerId: player.id, secret: player.secret, ...reply(1, room, player) };
    }
    throw new GameError('Could not create a room. Try again.');
  }

  const code = String(body.code ?? '').toUpperCase().trim();
  if (action === 'join') {
    const player = newPlayer(body.name);
    const saved = await change(query, code, room => rules.join(room, player));
    return { code, playerId: player.id, secret: player.secret, game: saved.room.game, ...reply(saved.version, saved.room, player) };
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

  if (action === 'hint') return hint(query, code, body, auth, ask);

  let player;
  const saved = await change(query, code, async room => {
    player = auth(room);
    const isHost = room.players[0].id === player.id;
    // A tap that was meant for an earlier screen must not act on the current one.
    if (body.step !== room.step) throw new GameError('The game moved on');
    if (action === 'start') {
      if (!isHost || !['lobby', 'done'].includes(room.phase)) throw new GameError('Only the host can start');
      const rounds = room.game === 'bluff'
        ? await content(query, body.topic, [3, 5, 8].includes(body.rounds) ? body.rounds : 5, room.players)
        : rules.shuffle(DOODLE_PROMPTS).slice(0, room.players.length);
      rules.start(room, rounds);
    } else if (action === 'drawing') rules.submitDrawing(room, player.id, body.strokes);
    else if (action === 'fake') rules.submitFake(room, player.id, body.text);
    else if (action === 'vote') rules.vote(room, player.id, body.choice);
    else if (action === 'next') {
      if (!isHost) throw new GameError('Only the host can skip');
      rules.advance(room);
    } else throw new GameError('Unknown action');
  });
  return reply(saved.version, saved.room, player);
}
