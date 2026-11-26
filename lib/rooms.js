import { randomBytes, randomInt } from 'node:crypto';
import * as rules from './rules.js';
import { addQuestions } from './db.js';
import starter from './questions.js';
import { DOODLE_PROMPTS } from '../public/words.js';
import { BIBLE, WORDS, ABOUT_US } from './modes.js';
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
  if (topic === 'bible') return rules.shuffle(BIBLE).slice(0, count);
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

export async function handle(query, body) {
  const { action } = body;
  const reply = (version, room, player) => ({ version, state: rules.view(room, player.id) });

  if (action === 'create') {
    await query('DELETE FROM rooms WHERE updated < ?', [Date.now() - 24 * 3600 * 1000]);
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
