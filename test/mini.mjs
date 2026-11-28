// Mini games: each one plays through, and the shared rounds keep fair score.
import assert from 'node:assert/strict';
import { GAMES, create } from '../public/minigames.js';
import { MINI, PLAY, BREAK, LEAD, wins } from '../lib/mini.js';
import { handle } from '../lib/rooms.js';
import { screen } from '../lib/screen.js';
import * as rules from '../lib/rules.js';
import { query, room } from './harness.mjs';
import { bot } from './bots.js';

assert.deepEqual([...MINI].sort(), Object.keys(GAMES).sort(), 'server and phones know the same ten games');

// A board that ignores drawing, so every drawing routine still runs.
const board = new Proxy({}, { get: (t, k) => k in t ? t[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => (t[k] = v, true) });
const run = (id, seed, { play = true, from = 0 } = {}) => {
  const game = create(id, seed, from), memory = {};
  for (let t = from, frame = 0; t <= 30.05; t += 1 / 60) { game.advance(t); if (play) bot(id, game, t, memory); if (frame++ % 15 === 0) game.paint(board); }
  return game;
};
for (const id of MINI) {
  const good = [1, 2, 3].map(seed => run(id, seed).score), idle = [1, 2, 3].reduce((sum, seed) => sum + run(id, seed, { play: false }).score, 0) / 3;
  console.log(`  ${id}: good ${good.join(', ')} idle ${Math.round(idle)}`);
  assert.ok(good.every(s => s >= 50), `${id} rewards good play: ${good}`);
  assert.ok(idle < Math.min(...good) / 2, `${id} pays little for doing nothing: ${idle}`);
  assert.equal(run(id, 2).score, good[1], `${id} is the same course for the same seed`);
  assert.ok(run(id, 4, { from: 14 }).score >= 0, `${id} can be joined late`);
}

// Shared rounds
{
  const r = room('bluff', 3), T = Date.now();
  assert.ok(rules.miniRound(r, 'p0', T));
  const first = r.mini.rounds[0];
  assert.ok(first.start > T && first.end - first.start === PLAY);
  assert.ok(!rules.miniRound(r, 'p1', T + 1000), 'everyone shares the round');
  assert.ok(!rules.miniScore(r, 'p0', first.n, 40, T + 1000), 'no scores before it ends');
  assert.ok(rules.miniScore(r, 'p0', first.n, 40, first.end));
  assert.ok(!rules.miniScore(r, 'p0', first.n, 900, first.end), 'one score each');
  assert.ok(!rules.miniScore(r, 'p1', first.n, -1, first.end) && !rules.miniScore(r, 'p1', first.n, 2.5, first.end));
  assert.ok(rules.miniScore(r, 'p1', first.n, 70, first.end + 500));
  assert.ok(!rules.miniRound(r, 'p0', first.end + 1000), 'scores stay up for a while');
  assert.ok(rules.miniRound(r, 'p0', first.end + BREAK - LEAD));
  const second = r.mini.rounds[1];
  assert.equal(second.start, first.end + BREAK, 'ten seconds between games');
  assert.notEqual(second.game, first.game);
  assert.equal(wins(r, first.end + 1000)[0].name, 'P1');
  // All ten come up before any repeats.
  let at = second.end;
  const seen = [first.game, second.game];
  for (let i = 0; i < 8; i++) { at += BREAK; rules.miniRound(r, 'p0', at); seen.push(r.mini.rounds.at(-1).game); at = r.mini.rounds.at(-1).end; }
  assert.equal(new Set(seen).size, 10);
  // Starting the real game clears the lobby practice.
  rules.start(r, [{ question: 'q', answer: 'a' }]);
  assert.equal(r.mini, undefined);
  assert.throws(() => rules.miniRound(r, 'p0'), /Finish your own turn/);
  rules.submitFake(r, 'p0', 'one'); rules.submitFake(r, 'p1', 'two');
  const now = Date.now();
  assert.ok(rules.miniRound(r, 'p0', now - 40000)); // a finished round
  const done = r.mini.rounds.at(-1);
  rules.miniScore(r, 'p0', done.n, 30, done.end); rules.miniScore(r, 'p1', done.n, 10, done.end);
  assert.ok(rules.miniRound(r, 'p1', now));
  const live = r.mini.rounds.at(-1);
  assert.equal(screen(r).mini, undefined);
  rules.submitFake(r, 'p2', 'three'); // the real game moves on mid round
  assert.equal(r.phase, 'voting'); assert.ok(live.void);
  assert.ok(!rules.miniScore(r, 'p0', live.n, 500, live.end), 'a cancelled round is not saved');
  rules.advance(r); r.index = r.rounds.length - 1; rules.advance(r);
  while (r.phase !== 'done') rules.advance(r);
  assert.deepEqual(rules.view(r, 'p0').miniTrophy, { names: ['P0'], wins: 1 });
  assert.deepEqual(screen(r).miniTrophy, { names: ['P0'], wins: 1 });
  // One player alone never wins a round.
  const solo = room('bluff', 2);
  rules.miniRound(solo, 'p0', now - 40000); rules.miniScore(solo, 'p0', solo.mini.rounds[0].n, 99, solo.mini.rounds[0].end);
  assert.deepEqual(rules.view(solo, 'p0').mini.wins, []);
}
// Through the server, with phones asking at once.
{
  const host = await handle(query, { action: 'create', game: 'bluff', name: 'A' });
  const guest = await handle(query, { action: 'join', code: host.code, name: 'B' });
  const who = h => ({ code: host.code, playerId: h.playerId, secret: h.secret });
  const [one, two] = await Promise.all([handle(query, { action: 'mini', ...who(host) }), handle(query, { action: 'mini', ...who(guest) })]);
  assert.equal(one.state.mini.n, two.state.mini.n);
  assert.equal(one.state.mini.seed, two.state.mini.seed);
  await assert.rejects(handle(query, { action: 'mini', code: host.code, playerId: host.playerId, secret: 'no' }));
}
