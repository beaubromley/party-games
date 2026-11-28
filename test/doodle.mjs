// Group Doodle: one shared picture, many hands, nobody's strokes lost.
import assert from 'node:assert/strict';
import { LEAD, DRAW, PROMPTS } from '../lib/doodle.js';
import { handle } from '../lib/rooms.js';
import { query, sqlite } from './harness.mjs';

const host = await handle(query, { action: 'create', game: 'bluff', name: 'Ann' });
const who = h => ({ code: host.code, playerId: h.playerId, secret: h.secret });
const guests = [];
for (let i = 0; i < 11; i++) guests.push(await handle(query, { action: 'join', code: host.code, name: `P${i}` }));
const all = [host, ...guests];
const started = await Promise.all(all.slice(0, 3).map(h => handle(query, { action: 'doodle-start', ...who(h) })));
assert.equal(new Set(started.map(s => s.state.doodle.n)).size, 1, 'taps at once make one doodle');
const round = started[0].state.doodle;
assert.ok(PROMPTS.includes(round.prompt));
assert.equal(round.painters.length, 12);
assert.equal(new Set(round.painters.map(p => p.color)).size, 12, 'everyone gets their own color');
// Pretend the countdown is over.
const shift = ms => {
  const row = sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(host.code), r = JSON.parse(row.state);
  r.doodle.start -= ms; r.doodle.end -= ms;
  sqlite.prepare('UPDATE rooms SET state = ?, version = version + 1 WHERE code = ?').run(JSON.stringify(r), host.code);
};
const early = await handle(query, { action: 'doodle-sync', ...who(host), n: round.n, strokes: [[10, [1, 1, 2, 2]]] });
assert.equal(early.strokes.length, 0, 'no head starts');
shift(LEAD + 1000);
const version = sqlite.prepare('SELECT version FROM rooms WHERE code = ?').get(host.code).version;
await Promise.all(all.map((h, i) => handle(query, { action: 'doodle-sync', ...who(h), n: round.n, strokes: [[10, [i, i, 50, 50]], [30, [i, 9]]] })));
assert.equal(sqlite.prepare('SELECT version FROM rooms WHERE code = ?').get(host.code).version, version, 'drawing never redraws anyone’s screen');
const seen = await handle(query, { action: 'doodle-sync', ...who(host), n: round.n, after: 0 });
assert.equal(seen.strokes.length, 24);
assert.equal(new Set(seen.strokes.map(s => s[0])).size, 12);
assert.equal((await handle(query, { action: 'doodle-sync', ...who(host), n: round.n, after: seen.last })).strokes.length, 0);
// Nonsense is ignored, and the TV can only look.
await handle(query, { action: 'doodle-sync', ...who(host), n: round.n, strokes: [[99, [1, 1]], [10, [1]], [10, [5000, 1]], 'x', [10, Array(900).fill(1)]] });
const tv = await handle(query, { action: 'doodle-watch', code: host.code, n: round.n, after: 0, strokes: [[10, [1, 1]]] });
assert.equal(tv.strokes.length, 24);
await assert.rejects(handle(query, { action: 'doodle-sync', code: host.code, playerId: host.playerId, secret: 'no', n: round.n }));
const screened = await handle(query, { action: 'screen', code: host.code });
assert.equal(screened.state.doodle.prompt, round.prompt);
shift(DRAW + 10000);
await handle(query, { action: 'doodle-sync', ...who(host), n: round.n, strokes: [[10, [1, 1]]] });
assert.equal((await handle(query, { action: 'doodle-watch', code: host.code, n: round.n })).strokes.length, 24, 'time is up');
// The next one is fresh; starting the real game puts it away.
const next = await handle(query, { action: 'doodle-start', ...who(host) });
assert.notEqual(next.state.doodle.prompt, round.prompt);
assert.equal((await handle(query, { action: 'doodle-sync', ...who(host), n: next.state.doodle.n })).strokes.length, 0);
assert.ok((await handle(query, { action: 'doodle-sync', ...who(host), n: round.n })).over);
const game = await handle(query, { action: 'start', ...who(host), step: next.state.step, rounds: 3 });
assert.equal(game.state.doodle, undefined);
await assert.rejects(handle(query, { action: 'doodle-start', ...who(host) }), /between games/);
