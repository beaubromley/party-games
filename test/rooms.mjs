// Three phone-sized browsers play full games against the real API handler code, with SQLite standing in for Turso.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { migrate } from '../lib/db.js';
import { handle } from '../lib/rooms.js';
import * as rules from '../lib/rules.js';
import { suitable } from '../scripts/filter.mjs';

assert.equal(suitable({ question: 'Which of these is a fish?', correct_answer: 'Cod' }), false);
assert.equal(suitable({ question: 'What is in beer?', correct_answer: 'Hops' }), false);
assert.equal(suitable({ question: 'What is the largest ocean?', correct_answer: 'Pacific' }), true);

const { tooClose } = await import('../lib/match.js');
for (const [fake, truth] of [['wall', 'The city walls'], ['City wall', 'The city walls'], ['3', 'Three'], ['Hezekia', 'Hezekiah'], ['the fallen city walls', 'The city walls'], ['flamboyence', 'A flamboyance']])
  assert.equal(tooClose(fake, truth), true, `${fake} should match ${truth}`);
for (const [fake, truth] of [['The gates', 'The city walls'], ['Paul', 'Saul'], ['1961', '1960'], ['City towers', 'The city walls'], ['A murder', 'A parliament']])
  assert.equal(tooClose(fake, truth), false, `${fake} should not match ${truth}`);
assert.equal(tooClose('A cat', 'A cat running a lemonade stand', { loose: true }), false);
const sqlite = new DatabaseSync(':memory:');
const query = async (sql, args = []) => {
  await new Promise(r => setTimeout(r, Math.random() * 5)); // lets requests interleave
  const st = sqlite.prepare(sql);
  if (/^select/i.test(sql)) return { rows: st.all(...args), changes: 0 };
  return { rows: [], changes: Number(st.run(...args).changes) };
};
await migrate(query);

// Twelve phones answering at the same instant must all be saved.
const first = await handle(query, { action: 'create', game: 'bluff', name: 'P0' });
const joined = await Promise.all(Array.from({ length: 11 }, (_, i) => i + 1).map(i => handle(query, { action: 'join', code: first.code, name: 'P' + i })));
const all = [first, ...joined].map(p => ({ code: p.code, playerId: p.playerId, secret: p.secret }));
await assert.rejects(handle(query, { action: 'join', code: first.code, name: 'Thirteenth' }), /full/);
let r = await handle(query, { action: 'start', ...all[0], step: 0, rounds: 3 });
await Promise.all(all.map((p, i) => handle(query, { action: 'fake', ...p, step: r.state.step, text: 'zzfib' + i })));
r = await handle(query, { action: 'poll', ...all[0] });
assert.equal(r.state.phase, 'voting'); assert.equal(r.state.options.length, 13);
assert.ok(r.state.options.every(o => !('truth' in o) && !('authors' in o)), 'answers hidden while voting');
await Promise.all(all.map(async p => {
  const mine = await handle(query, { action: 'poll', ...p });
  await handle(query, { action: 'vote', ...p, step: mine.state.step, choice: mine.state.options.findIndex(o => !o.mine) });
}));
assert.equal((await handle(query, { action: 'poll', ...all[0] })).state.phase, 'reveal');
// All twelve drawings sent at once, in Doodle Bluff.
{
  const h = await handle(query, { action: 'create', game: 'doodle', name: 'D0' });
  const g = await Promise.all(Array.from({ length: 11 }, (_, i) => handle(query, { action: 'join', code: h.code, name: 'D' + (i + 1) })));
  const ps = [h, ...g].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const s = await handle(query, { action: 'start', ...ps[0], step: 0 });
  await Promise.all(ps.map(p => handle(query, { action: 'drawing', ...p, step: s.state.step, strokes: [[0, 12, [1, 2, 3, 4]]] })));
  const after = await handle(query, { action: 'poll', ...ps[0] });
  assert.equal(after.state.phase, 'writing'); assert.equal(after.state.total, 12);
}
r = await handle(query, { action: 'poll', ...all[0] });
await assert.rejects(handle(query, { action: 'poll', ...all[0], secret: 'wrong' }), /not in this room/);
await assert.rejects(handle(query, { action: 'next', ...all[1], step: r.state.step }), /host/);
await assert.rejects(handle(query, { action: 'next', ...all[0], step: 0 }), /moved on/);
// About Us: the subject supplies the truth, cannot vote, and a skipped subject skips the round.
const about = rules.newRoom('bluff');
for (const n of ['a', 'b', 'c']) rules.join(about, { id: n, secret: n, name: n });
rules.start(about, [{ question: 'About a?', subject: 'a' }, { question: 'About b?', subject: 'b' }]);
rules.submitFake(about, 'a', 'tacos'); rules.submitFake(about, 'b', 'Tacos!'); rules.submitFake(about, 'c', 'soup');
assert.equal(about.options.length, 2);
assert.throws(() => rules.vote(about, 'a', 0), /about you/);
const truth = about.options.findIndex(o => o.truth);
rules.vote(about, 'b', truth); rules.vote(about, 'c', truth);
assert.equal(about.players[0].score, 1000);
rules.advance(about); rules.submitFake(about, 'a', 'x'); rules.advance(about);
assert.equal(about.phase, 'done');
for (const topic of ['bible', 'words', 'about', 'thanksgiving', 'music', 'sports', 'oklahoma', 'disney']) {
  const x = await handle(query, { action: 'create', game: 'bluff', name: 'A' });
  for (const name of ['B', 'C']) await handle(query, { action: 'join', code: x.code, name });
  const y = await handle(query, { action: 'start', code: x.code, playerId: x.playerId, secret: x.secret, step: 0, topic, rounds: 8 });
  assert.equal(y.state.total, 8); assert.ok(y.state.question);
}
assert.equal(rules.validDrawing([[0, 12, [1, 2, 'x', 4]]]), false);

// Two players are enough, one is not.
{
  const h = await handle(query, { action: 'create', game: 'bluff', name: 'A' });
  const a = { code: h.code, playerId: h.playerId, secret: h.secret };
  await assert.rejects(handle(query, { action: 'start', ...a, step: 0, topic: 'bible' }), /at least 2/);
  await handle(query, { action: 'join', code: h.code, name: 'B' });
  assert.equal((await handle(query, { action: 'start', ...a, step: 0, topic: 'bible', rounds: 3 })).state.phase, 'writing');
  await assert.rejects(handle(query, { action: 'face', ...a, data: 'javascript:alert(1)' }), /didn't work/);
  await assert.rejects(handle(query, { action: 'faces', ...a, secret: 'no' }), /not in this room/);
}
// AI help: halves fooling points, once per round, free if it fails.
const ask = async () => 'A hootenanny';
{
  const h = await handle(query, { action: 'create', game: 'bluff', name: 'A' });
  const j = await handle(query, { action: 'join', code: h.code, name: 'B' });
  const [a, b] = [h, j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const { state } = await handle(query, { action: 'start', ...a, step: 0, topic: 'bible', rounds: 3 });
  const step = state.step;
  await assert.rejects(handle(query, { action: 'hint', ...a, step }, { ask: async () => { throw new Error('down'); } }), /No points lost/);
  const both = await Promise.allSettled([1, 2].map(() => handle(query, { action: 'hint', ...a, step }, { ask })));
  assert.equal(both.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await handle(query, { action: 'poll', ...a })).state.hint, 'A hootenanny');
  assert.equal((await handle(query, { action: 'poll', ...b })).state.hint, undefined, 'hints are private');
  await handle(query, { action: 'fake', ...a, step, text: 'A hootenanny' });
  const v = await handle(query, { action: 'fake', ...b, step, text: 'zzz' });
  const choice = v.state.options.findIndex(o => o.text === 'A hootenanny');
  await handle(query, { action: 'vote', ...b, step: v.state.step, choice });
  const done = await handle(query, { action: 'next', ...a, step: v.state.step });
  assert.equal(done.state.players[0].score, 250);
}
{
  const { BIBLE, WORDS, ABOUT_US, TOPICS } = await import('../lib/modes.js');
  for (const [name, set] of Object.entries({ BIBLE, ...TOPICS })) {
    const all = Object.values(set).flat();
    assert.ok(all.length >= 40, `${name} has ${all.length}`);
    assert.equal(new Set(all.map(q => q.question)).size, all.length);
    assert.ok(all.every(q => q.question && q.answer && q.answer.length <= 60));
  }
  assert.ok(WORDS.length >= 40 && ABOUT_US.length >= 40, `${WORDS.length} words, ${ABOUT_US.length} about`);
  for (const count of [3, 5, 8]) {
    const picked = rules.mixed(BIBLE, count);
    assert.equal(new Set(picked).size, count);
    const per = Object.values(BIBLE).map(list => picked.filter(q => list.includes(q)).length);
    assert.ok(Math.min(...per) >= 1 && Math.max(...per) - Math.min(...per) <= 1, `even mix for ${count}: ${per}`);
  }
}
// The three party games, rules only.
const room = (game, n) => {
  const r = rules.newRoom(game);
  for (let i = 0; i < n; i++) rules.join(r, { id: 'p' + i, secret: 's', name: 'P' + i });
  return r;
};
{
  const { FACEOFF, MAJORITY } = await import('../lib/party-content.js');
  for (const list of [FACEOFF, MAJORITY]) { assert.ok(list.length >= 40); assert.equal(new Set(list).size, list.length); }
  for (const n of [2, 3, 12]) {
    const f = room('faceoff', n);
    rules.start(f, { sets: 2, prompts: FACEOFF.slice(0, 2 * n) });
    const seen = new Set();
    for (let guard = 0; f.phase !== 'done'; guard++) {
      assert.ok(guard < 200);
      const waiting = rules.waitingOn(f);
      if (f.phase === 'writing') for (const id of waiting) for (let k = 0; k < 2; k++) {
        const v = rules.view(f, id); seen.add(v.question);
        rules.submitFake(f, id, `${id} ${k}`, v.item);
        if (k === 0) assert.throws(() => rules.submitFake(f, id, 'double tap', v.item), /Already|over/);
      }
      else if (f.phase === 'voting') {
        assert.ok(rules.view(f, 'p0').options.every(o => !('author' in o)));
        for (const id of waiting) rules.vote(f, id, rules.view(f, id).options.findIndex(o => !o.mine));
      } else rules.advance(f);
    }
    assert.equal(seen.size, 2 * n);
    assert.ok(f.players.some(p => p.score > 0));
  }
  // One missing answer wins unopposed; none skips the matchup.
  const f = room('faceoff', 3);
  rules.start(f, { sets: 1, prompts: ['a', 'b', 'c'] });
  rules.advance(f); assert.equal(f.phase, 'done');

  const m = room('majority', 5);
  rules.start(m, { prompts: ['Name a drink', 'Name a pie'] });
  ['Soda', 'sodas', 'Pop', 'pop!', 'Tea'].forEach((a, i) => rules.submitFake(m, 'p' + i, a));
  assert.equal(m.phase, 'reveal'); assert.equal(m.groups.length, 3);
  assert.deepEqual(m.players.map(p => p.score), [1000, 1000, 1000, 1000, 0]);
  rules.merge(m, 0, 1);
  assert.deepEqual(m.players.map(p => p.score), [1000, 1000, 1000, 1000, 0], 'combining never double-scores');
  assert.throws(() => rules.merge(m, 0, 0), /different/);
  rules.advance(m);
  ['pie', 'pumpkin pie', 'apple', 'pecan', 'cherry'].forEach((a, i) => rules.submitFake(m, 'p' + i, a));
  assert.equal(m.groups.length, 5); assert.deepEqual(m.gains, {});
  rules.advance(m); assert.equal(m.phase, 'done');

  const { turnCount } = await import('../lib/party.js');
  assert.deepEqual([2, 3, 4, 5, 8, 12].map(turnCount), [3, 3, 3, 5, 7, 9]);
  for (const n of [2, 3, 4, 12]) {
    const t = room('telephone', n);
    rules.start(t, {});
    while (t.phase === 'writing' || t.phase === 'drawing') {
      const turn = t.turn;
      for (const id of rules.waitingOn(t)) {
        const v = rules.view(t, id);
        if (turn) assert.ok(t.phase === 'drawing' ? v.prev.text : v.prev.strokes);
        if (t.phase === 'drawing') rules.submitDrawing(t, id, [[0, 12, [1, 2, 3, 4]]]); else rules.submitFake(t, id, 'words from ' + id);
      }
      assert.ok(t.turn !== turn || t.phase === 'reveal');
    }
    for (const b of t.books) {
      assert.equal(b.entries.length, turnCount(n));
      if (n > 2) assert.equal(new Set(b.entries.map(e => e.by)).size, b.entries.length, 'nobody sees a book twice');
    }
    let pages = 0; while (t.phase === 'reveal') { rules.advance(t); pages++; }
    assert.equal(pages, n * turnCount(n));
  }
  // Skipping everyone still leaves a complete chain.
  const t = room('telephone', 4);
  rules.start(t, {});
  for (let i = 0; i < 3; i++) rules.advance(t);
  assert.equal(t.phase, 'reveal'); assert.ok(t.books.every(b => b.entries.every(e => e.skipped && (e.text || rules.validDrawing(e.strokes)))));
  // And through the real handler.
  for (const game of ['faceoff', 'majority', 'telephone']) {
    const h = await handle(query, { action: 'create', game, name: 'A' });
    await handle(query, { action: 'join', code: h.code, name: 'B' });
    const y = await handle(query, { action: 'start', code: h.code, playerId: h.playerId, secret: h.secret, step: 0, rounds: 1 });
    assert.equal(y.state.phase, 'writing');
  }
}
// Removing players: every game, every phase, either carries on to a finish or returns to the lobby.
{
  const games = ['bluff', 'doodle', 'faceoff', 'majority', 'telephone'];
  const strokes = [[0, 12, [1, 2, 3, 4]]];
  const begin = (game, n, about) => {
    const r = room(game, n);
    rules.start(r, game === 'bluff' ? Array.from({ length: 4 }, (_, i) => about ? { question: 'q' + i, subject: 'p' + (i % n) } : { question: 'q' + i, answer: 'truth ' + i })
      : game === 'doodle' ? r.players.map(p => 'prompt ' + p.id)
      : game === 'faceoff' ? { sets: 2, prompts: Array.from({ length: 2 * n }, (_, i) => 'f' + i) }
      : game === 'majority' ? { prompts: ['a', 'b', 'c'] } : {});
    return r;
  };
  // One legal move, or the host moving things along.
  const act = (r, random) => {
    const waiting = rules.waitingOn(r);
    if (!waiting.length || random() < 0.05) return rules.advance(r, random);
    const id = waiting[Math.floor(random() * waiting.length)];
    const v = rules.view(r, id);
    if (r.phase === 'drawing') rules.submitDrawing(r, id, strokes);
    else if (r.phase === 'writing') rules.submitFake(r, id, `word ${id} ${r.step}`, v.item);
    else if (r.game === 'telephone') rules.vote(r, id, v.gallery.find(d => d.byId !== id).key);
    else rules.vote(r, id, v.options.findIndex(o => !o.mine));
  };
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let carried = 0, restarted = 0;
  for (let run = 0; run < 6000; run++) {
    const game = games[run % games.length], n = 2 + (run % 5);
    const r = begin(game, n, game === 'bluff' && run % 2 === 0);
    const log = `${game} ${n} players, run ${run}`;
    for (let guard = 0; !['done', 'lobby'].includes(r.phase); guard++) {
      assert.ok(guard < 500, 'stuck: ' + log);
      if (r.players.length > 1 && random() < 0.08) {
        const target = r.players[Math.floor(random() * r.players.length)].id;
        rules.remove(r, target);
        if (r.phase === 'lobby') { restarted++; assert.ok(r.players.length < 2 && r.notice, log); } else carried++;
      } else if (r.players.length < 7 && random() < 0.05) {
        // Someone new, or someone coming back.
        const gone = Object.keys(r.left ?? {});
        rules.join(r, { id: 'n' + r.step + '-' + guard, secret: 's', name: gone.length && random() < 0.6 ? gone[0] : `N${run}-${guard}` }, { prompt: 'late', prompts: ['l' + guard, 'm' + guard] });
      } else act(r, random);
      // Nobody may be left staring at a screen that waits for no one.
      if (['writing', 'drawing', 'voting'].includes(r.phase)) assert.ok(rules.waitingOn(r).length, `idle in ${r.phase}: ${log}`);
      for (const p of r.players) {
        const v = rules.view(r, p.id);
        assert.ok(!JSON.stringify(v).includes('undefined'), log);
        if (['writing', 'voting'].includes(r.phase) && rules.waitingOn(r).includes(p.id) && game !== 'telephone')
          assert.ok(v.question || v.drawing, `blank screen: ${log}`);
      }
    }
  }
  assert.ok(carried > 500 && restarted > 50, `${carried} carried on, ${restarted} restarted`);
  // Dropping the one removed answer re-points votes.
  const r = begin('bluff', 4);
  for (const p of r.players) rules.submitFake(r, p.id, 'fib ' + p.id);
  const pick = text => r.options.findIndex(o => o.text === text);
  rules.vote(r, 'p0', pick('fib p1')); rules.vote(r, 'p1', pick('truth 0')); rules.vote(r, 'p2', pick('fib p3'));
  const step = r.step;
  rules.remove(r, 'p3');
  assert.equal(r.step, step + 1);
  assert.equal(r.options[r.votes.p0].text, 'fib p1'); assert.equal(r.options[r.votes.p1].text, 'truth 0'); assert.ok(!('p2' in r.votes));
  // Through the handler: kick, leave, host handover.
  const h = await handle(query, { action: 'create', game: 'majority', name: 'A' });
  const j = await Promise.all(['B', 'C'].map(name => handle(query, { action: 'join', code: h.code, name })));
  const [a, b, c] = [h, ...j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  await handle(query, { action: 'start', ...a, step: 0 });
  await assert.rejects(handle(query, { action: 'kick', ...b, target: c.playerId }), /Only the host/);
  await assert.rejects(handle(query, { action: 'claim', ...b }), /still here/);
  assert.equal((await handle(query, { action: 'ping', ...b })).hostAway, false);
  sqlite.prepare('UPDATE presence SET seen = ? WHERE code = ?').run(Date.now() - 4 * 60000, h.code);
  assert.equal((await handle(query, { action: 'ping', ...b })).hostAway, false, 'four quiet minutes is fine');
  sqlite.prepare('UPDATE presence SET seen = ? WHERE code = ?').run(Date.now() - 6 * 60000, h.code);
  assert.equal((await handle(query, { action: 'ping', ...b })).hostAway, true);
  assert.equal((await handle(query, { action: 'claim', ...b })).state.host, b.playerId);
  await assert.rejects(handle(query, { action: 'claim', ...c }), /still here/);
  assert.equal((await handle(query, { action: 'kick', ...b, target: c.playerId })).state.phase, 'writing');
  await assert.rejects(handle(query, { action: 'poll', ...c, version: 1 }), /not in this room/);
  const left = await handle(query, { action: 'leave', ...b });
  assert.equal(left.state.phase, 'lobby'); assert.equal(left.state.host, a.playerId);
  await handle(query, { action: 'join', code: h.code, name: 'C' }); // welcome back
  const again = await handle(query, { action: 'poll', ...a });
  await handle(query, { action: 'start', ...a, step: again.state.step });
  const now = await handle(query, { action: 'poll', ...a });
  assert.equal((await handle(query, { action: 'restart', ...a, step: now.state.step })).state.phase, 'lobby');
}
// Timer, game switching and favorite drawings.
{
  const h = await handle(query, { action: 'create', game: 'majority', name: 'A' });
  const j = await Promise.all(['B', 'C'].map(name => handle(query, { action: 'join', code: h.code, name })));
  const [a, b, c] = [h, ...j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const at = async who => (await handle(query, { action: 'poll', ...who })).state;
  await handle(query, { action: 'start', ...a, step: 0, timer: 60 });
  let v = await at(a);
  assert.ok(v.timeLeft > 55000 && v.timeLeft <= 60000);
  assert.deepEqual(v.progress.map(p => p.done), [false, false, false]);
  await new Promise(r => setTimeout(r, 40));
  await handle(query, { action: 'fake', ...b, step: v.step, text: 'x' });
  const next = await at(a);
  assert.ok(next.timeLeft < v.timeLeft, 'answering does not restart the clock');
  assert.deepEqual(next.progress.filter(p => p.done).map(p => p.name), ['B']); // join order varies
  await assert.rejects(handle(query, { action: 'switch', ...a, step: next.step, game: 'telephone' }), /restart/);
  v = (await handle(query, { action: 'restart', ...a, step: next.step })).state;
  await assert.rejects(handle(query, { action: 'switch', ...b, step: v.step, game: 'telephone' }), /Only the host/);
  await assert.rejects(handle(query, { action: 'switch', ...a, step: v.step, game: 'chess' }), /Unknown/);
  v = (await handle(query, { action: 'switch', ...a, step: v.step, game: 'telephone' })).state;
  assert.equal((await at(c)).game, 'telephone'); assert.equal(v.players.length, 3);
  await handle(query, { action: 'start', ...a, step: v.step, timer: 999 });
  assert.equal((await at(a)).timeLeft, undefined, 'bad timer values are off');
  const t = room('telephone', 3);
  rules.start(t, {});
  for (let turn = 0; turn < 3; turn++) for (const id of rules.waitingOn(t)) turn % 2 ? rules.submitDrawing(t, id, [[0, 12, [1, 2, 3, 4]]]) : rules.submitFake(t, id, 'p' + turn + id);
  const artist = t.books[0].entries[1].by, fans = ['p0', 'p1', 'p2'].filter(id => id !== artist);
  assert.throws(() => rules.vote(t, fans[0], '0:1'), /after the last book/);
  while (t.phase === 'reveal') rules.advance(t);
  assert.equal(t.phase, 'voting'); assert.equal(rules.view(t, 'p0').gallery.length, 3);
  assert.throws(() => rules.vote(t, artist, '0:1'), /your own/);
  assert.throws(() => rules.vote(t, fans[0], '0:0'), /Pick a drawing/);
  rules.vote(t, fans[0], '0:1'); assert.throws(() => rules.vote(t, fans[0], '0:1'), /Already voted/);
  rules.vote(t, fans[1], '0:1');
  const other = rules.view(t, artist).gallery.find(d => d.byId !== artist);
  rules.vote(t, artist, other.key);
  assert.equal(t.phase, 'done', 'the last vote ends the game');
  const [best] = rules.view(t, 'p0').favorites;
  assert.equal(best.votes, 2); assert.equal(best.artist, t.players.find(p => p.id === artist).name); assert.ok(best.strokes && best.prompt);
  const m = room('majority', 2); assert.throws(() => rules.vote(m, 'p0', 0));
}
// Standings, awards, reactions and no repeats.
{
  const h = await handle(query, { action: 'create', game: 'majority', name: 'A' });
  const j = await Promise.all(['B', 'C'].map(name => handle(query, { action: 'join', code: h.code, name })));
  const [a, b, c] = [h, ...j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const at = async () => (await handle(query, { action: 'poll', ...a })).state;
  const seen = [];
  let v = await at();
  for (let game = 0; game < 6; game++) {
    await handle(query, { action: 'start', ...a, step: v.step, rounds: 12 });
    for (let q = 0; q < 12; q++) {
      v = await at(); seen.push(v.question);
      await assert.rejects(handle(query, { action: 'react', ...b, kind: 0 }), /results/);
      for (const [p, text] of [[a, 'dog'], [b, 'dog'], [c, 'cat']]) await handle(query, { action: 'fake', ...p, step: v.step, text });
      v = await at();
      await handle(query, { action: 'next', ...a, step: v.step });
    }
    v = await at();
  }
  const { MAJORITY } = await import('../lib/party-content.js');
  assert.equal(new Set(seen.slice(0, 72)).size, 72, 'no repeats while new prompts remain');
  assert.deepEqual(v.night.map(p => [p.name, p.points, p.wins]).sort(), [['A', 18, 6], ['B', 18, 6], ['C', 0, 0]]);
  assert.deepEqual(v.awards.map(x => [x.title, x.names.sort().join(), x.times]), [['Hive Mind', 'A,B', 12], ['Free Spirit', 'C', 12]]);
  // Standings count once, survive a game switch, and only the host clears them.
  await handle(query, { action: 'face', ...c, data: '' });
  v = (await handle(query, { action: 'switch', ...a, step: v.step, game: 'bluff' })).state;
  assert.equal(v.night[0].points, 18);
  await assert.rejects(handle(query, { action: 'forget', ...b, step: v.step }), /Only the host/);
  assert.deepEqual((await handle(query, { action: 'forget', ...a, step: v.step })).state.night, []);
  // Bible has enough for several games without a repeat.
  const asked = [];
  v = await at();
  for (let game = 0; game < 6; game++) {
    v = (await handle(query, { action: 'start', ...a, step: v.step, topic: 'bible', rounds: 8 })).state;
    for (let q = 0; q < 8; q++) {
      v = await at(); asked.push(v.question);
      v = (await handle(query, { action: 'next', ...a, step: v.step })).state;
      v = (await handle(query, { action: 'next', ...a, step: v.step })).state;
      v = (await handle(query, { action: 'next', ...a, step: v.step })).state;
    }
  }
  assert.equal(new Set(asked).size, asked.length);
  // Running a topic dry starts it over instead of failing.
  for (let game = 0; game < 4; game++) { v = (await handle(query, { action: 'start', ...a, step: v.step, topic: 'bible', rounds: 8 })).state; assert.equal(v.total, 8);
    v = (await handle(query, { action: 'restart', ...a, step: v.step })).state; }
  for (let game = 0; game < 4; game++) { v = (await handle(query, { action: 'start', ...a, step: v.step, topic: 'trivia', rounds: 8 })).state; assert.equal(v.total, 8);
    v = (await handle(query, { action: 'restart', ...a, step: v.step })).state; }
  const r = room('bluff', 3);
  rules.start(r, [{ question: 'q', answer: 'truth' }]);
  ['x', 'y', 'z'].forEach((text, i) => rules.submitFake(r, 'p' + i, text));
  const pick = text => r.options.findIndex(o => o.text === text);
  rules.vote(r, 'p0', pick('y')); rules.vote(r, 'p1', pick('truth')); rules.vote(r, 'p2', pick('y'));
  rules.react(r, 'p0', 3);
  assert.throws(() => rules.react(r, 'p0', 1), /One at a time/);
  assert.throws(() => rules.react(r, 'p1', 9), /Unknown/);
  rules.advance(r); rules.tally(r); rules.tally(r);
  assert.deepEqual(rules.view(r, 'p0').awards.map(x => [x.title, x.names.join()]), [['Best Bluffer', 'P1'], ['Sharpest Detective', 'P1'], ['Most Gullible', 'P0,P2']]);
  assert.equal(r.night.p1.points, 3);
}
// Editing answers in every writing game, and only while writing is open.
{
  for (const game of ['bluff', 'majority', 'telephone', 'faceoff']) {
    const r = room(game, 3);
    rules.start(r, game === 'bluff' ? [{ question: 'q', answer: 'truth' }] : game === 'majority' ? { prompts: ['q'] } : game === 'faceoff' ? { sets: 1, prompts: ['a', 'b', 'c'] } : {});
    const item = rules.view(r, 'p0').item;
    assert.throws(() => rules.unsend(r, 'p0', item), /Nothing to edit/);
    rules.submitFake(r, 'p0', 'frist', item);
    const v = rules.view(r, 'p0');
    assert.equal(game === 'faceoff' ? v.written[0].text : v.mine, 'frist');
    assert.ok(!JSON.stringify(rules.view(r, 'p1')).includes('frist'), 'answers stay private');
    rules.unsend(r, 'p0', item);
    assert.ok(rules.waitingOn(r).includes('p0'));
    const saved = JSON.parse(JSON.stringify(r)); // as stored in the database
    rules.submitFake(saved, 'p0', 'first', item);
    for (let guard = 0; saved.phase === 'writing'; guard++) { assert.ok(guard < 10); const id = rules.waitingOn(saved)[0]; rules.submitFake(saved, id, 'w' + id + guard, rules.view(saved, id).item); }
    assert.throws(() => rules.unsend(saved, 'p0', item), /Too late/);
  }
}
// Night highlights: what gets kept, and the limits.
{
  const play = (game, content, act) => { const r = room(game, 4); rules.start(r, content); act(r); return r; };
  const others = (r, not) => r.players.map(p => p.id).filter(id => !not.includes(id));
  const bluff = play('bluff', [{ question: 'q1', answer: 'truth' }], r => {
    for (const id of rules.waitingOn(r)) rules.submitFake(r, id, 'fib ' + id);
    const target = r.options.findIndex(o => o.authors.includes('p0'));
    for (const id of rules.waitingOn(r)) rules.vote(r, id, id === 'p0' ? r.options.findIndex(o => o.truth) : target);
  });
  assert.deepEqual(bluff.highlights.map(h => [h.heading, h.text, h.credit]), [['q1', 'fib p0', 'P0 fooled 3 people']]);
  assert.deepEqual(rules.view(bluff, 'p1').highlights, { count: 1, latest: 1 });
  assert.ok(!JSON.stringify(rules.view(bluff, 'p1').highlights).includes('fib'), 'the list is fetched separately');
  rules.restart(bluff); assert.equal(bluff.highlights.length, 1, 'kept across games');

  const face = play('faceoff', { sets: 1, prompts: ['a', 'b', 'c', 'd'] }, r => {
    while (r.phase === 'writing') { const id = rules.waitingOn(r)[0]; rules.submitFake(r, id, 'joke ' + id, rules.view(r, id).item); }
    for (const id of rules.waitingOn(r)) rules.vote(r, id, 0);
  });
  assert.equal(face.highlights.length, 1); assert.match(face.highlights[0].credit, /2 votes$/);

  const same = play('majority', { prompts: ['q', 'r'] }, r => { for (const p of r.players) rules.submitFake(r, p.id, 'pie'); rules.advance(r); });
  assert.deepEqual(same.highlights.map(h => h.text), ['pie']);

  const line = [[0, 12, [1, 1, 9, 9]]];
  const art = play('doodle', ['w', 'x', 'y', 'z'], r => {
    for (const p of r.players) rules.submitDrawing(r, p.id, line);
    rules.advance(r); rules.advance(r);
  });
  assert.equal(art.highlights.length, 1); assert.ok(art.highlights[0].strokes);

  const tele = play('telephone', {}, r => {
    for (let g = 0; r.phase !== 'reveal'; g++) { assert.ok(g < 99); const id = rules.waitingOn(r)[0]; r.phase === 'drawing' ? rules.submitDrawing(r, id, line) : rules.submitFake(r, id, 'hi'); }
    for (let g = 0; r.phase === 'reveal'; g++) { assert.ok(g < 99); rules.advance(r); }
    rules.vote(r, others(r, [r.books[0].entries[1].by])[0], '0:1');
    rules.advance(r);
  });
  assert.equal(tele.highlights.length, 1); assert.match(tele.highlights[0].credit, /Fan favorite/);

  const { highlight } = await import('../lib/extras.js');
  const full = room('doodle', 2);
  for (let i = 0; i < 50; i++) highlight(full, { heading: String(i), strokes: i % 2 ? line : undefined });
  assert.equal(full.highlights.length, 30); assert.equal(full.highlights.filter(h => h.strokes).length, 10);
  assert.equal(full.highlights.at(-1).heading, '49');
}
// Joining late, in every game, and finishing normally.
{
  const line = [[0, 12, [1, 1, 9, 9]]];
  const finish = r => {
    for (let g = 0; r.phase !== 'done'; g++) {
      assert.ok(g < 300, `${r.game} stuck in ${r.phase}`);
      const id = rules.waitingOn(r)[0];
      if (!id) rules.advance(r);
      else if (r.phase === 'drawing') rules.submitDrawing(r, id, line);
      else if (r.phase === 'writing') rules.submitFake(r, id, `w${id}${g}`, rules.view(r, id).item);
      else if (r.game === 'telephone') rules.vote(r, id, rules.view(r, id).gallery.find(d => d.byId !== id).key);
      else rules.vote(r, id, rules.view(r, id).options.findIndex(o => !o.mine));
    }
  };
  const deal = { bluff: [{ question: 'q1', answer: 'a' }, { question: 'q2', answer: 'b' }], doodle: ['x', 'y', 'z'], faceoff: { sets: 2, prompts: 'abcdef'.split('') }, majority: { prompts: ['q', 'r'] }, telephone: {} };
  for (const game of rules.GAMES) {
    // Join at every possible moment of a game.
    for (let when = 0; ; when++) {
      assert.ok(when < 300);
      const r = room(game, 3);
      rules.start(r, structuredClone(deal[game]));
      for (let g = 0; g < when && r.phase !== 'done'; g++) {
        const id = rules.waitingOn(r)[0];
        if (!id) rules.advance(r);
        else if (r.phase === 'drawing') rules.submitDrawing(r, id, line);
        else if (r.phase === 'writing') rules.submitFake(r, id, `w${id}${g}`, rules.view(r, id).item);
        else if (r.game === 'telephone') rules.vote(r, id, rules.view(r, id).gallery.find(d => d.byId !== id).key);
        else rules.vote(r, id, rules.view(r, id).options.findIndex(o => !o.mine));
      }
      const over = r.phase === 'done';
      rules.join(r, { id: 'late', secret: 's', name: 'Late' }, { prompt: 'p', prompts: ['g', 'h'] });
      const v = rules.view(r, 'late');
      if (r.phase === 'drawing' && game === 'doodle') assert.equal(v.prompt, 'p');
      if (game === 'telephone' && ['writing', 'drawing'].includes(r.phase)) { assert.ok(v.sittingOut); assert.ok(!v.progress.some(p => p.name === 'Late')); }
      finish(r);
      assert.ok(rules.view(r, 'late').players.length === 4);
      if (over) break;
    }
  }
  // Leaving and coming back keeps the seat and the score; a new game starts it at zero.
  const r = room('telephone', 3);
  rules.start(r, {});
  r.players[2].score = 700;
  rules.remove(r, 'p2');
  const back = rules.join(r, { id: 'new', secret: 'n', name: 'p2' });
  assert.deepEqual([back.id, back.score], ['p2', 700]);
  assert.equal(rules.view(r, 'p2').sittingOut, false);
  rules.remove(r, 'p2'); rules.restart(r);
  assert.equal(rules.join(r, { id: 'new2', secret: 'n', name: 'P2' }).score, 0);
}
// Likes: toggled on results, not your own, no points, and counted for an award.
{
  const m = room('majority', 4);
  rules.start(m, { prompts: ['q'] });
  assert.throws(() => rules.like(m, 'p0', 'p1'), /results/);
  ['soda', 'pop', 'tea', 'milk'].forEach((text, i) => rules.submitFake(m, 'p' + i, text));
  assert.throws(() => rules.like(m, 'p0', 'p0'), /yours/);
  rules.like(m, 'p0', 'p1'); rules.like(m, 'p2', 'p1'); rules.like(m, 'p2', 'p1'); rules.like(m, 'p3', 'p0');
  const at = who => m.groups.findIndex(g => g.authors.includes(who));
  rules.merge(m, at('p0'), at('p1'));
  assert.throws(() => rules.like(m, 'p0', 'p1'), /yours/);
  rules.like(m, 'p3', 'p1'); // liked already through its twin, so this takes it back
  assert.deepEqual(Object.values(rules.view(m, 'p0').likes).flat().sort(), ['p0']);
  assert.ok(m.players.every(p => p.score === (['p0', 'p1'].includes(p.id) ? 1000 : 0)));
  rules.advance(m);
  assert.deepEqual(rules.view(m, 'p0').awards.find(a => a.title === 'Fan Magnet').names, ['P1']);
}
// Face-Off AI help: one per prompt, half points, private, free when it fails.
{
  const seen = [];
  const funny = async q => { seen.push(q); return 'A polite goose'; };
  const h = await handle(query, { action: 'create', game: 'faceoff', name: 'A' });
  const j = [];
  for (const name of ['B', 'C']) j.push(await handle(query, { action: 'join', code: h.code, name }));
  const ps = [h, ...j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const at = async p => (await handle(query, { action: 'poll', ...p })).state;
  await handle(query, { action: 'start', ...ps[0], step: 0, rounds: 1 });
  let v = await at(ps[0]);
  await assert.rejects(handle(query, { action: 'hint', ...ps[0], step: v.step }, { ask: async () => { throw new Error('down'); } }), /No points lost/);
  await handle(query, { action: 'hint', ...ps[0], step: v.step }, { ask: funny });
  assert.equal(seen[0].funny, true); assert.equal(seen[0].question, v.question);
  v = await at(ps[0]); assert.equal(v.hint, 'A polite goose'); assert.equal(v.canHint, false);
  await assert.rejects(handle(query, { action: 'hint', ...ps[0], step: v.step }, { ask: funny }), /already used/);
  await handle(query, { action: 'fake', ...ps[0], step: v.step, item: v.item, text: v.hint });
  v = await at(ps[0]); assert.equal(v.canHint, true, 'the second prompt has its own');
  await handle(query, { action: 'fake', ...ps[0], step: v.step, item: v.item, text: 'mine' });
  for (const p of ps.slice(1)) for (let k = 0; k < 2; k++) { const x = await at(p); await handle(query, { action: 'fake', ...p, step: x.step, item: x.item, text: `t${k}` }); }
  let checked = false;
  for (let g = 0; g < 20; g++) {
    v = await at(ps[0]);
    if (v.phase === 'done') break;
    if (v.phase === 'voting') {
      for (const p of ps) {
        const x = await at(p);
        if (x.phase !== 'voting' || !x.canVote) continue;
        await handle(query, { action: 'vote', ...p, step: x.step, choice: Math.max(0, x.options.findIndex(o => o.text === 'A polite goose')) });
      }
    } else {
      const ai = v.options.find(o => o.text === 'A polite goose');
      if (ai) { assert.ok(ai.helped); assert.equal(v.gains[ai.authorId], 500); checked = true; }
      await handle(query, { action: 'next', ...ps[0], step: v.step });
    }
  }
  assert.ok(checked, 'the helped answer scored half');
}
// Late joining and sharing a drawing, through the server.
{
  const h = await handle(query, { action: 'create', game: 'doodle', name: 'A' });
  await handle(query, { action: 'join', code: h.code, name: 'B' });
  const a = { code: h.code, playerId: h.playerId, secret: h.secret };
  await handle(query, { action: 'start', ...a, step: 0 });
  const late = await handle(query, { action: 'join', code: h.code, name: 'C' });
  assert.ok(late.state.prompt && !late.state.sent);
  const cast = await handle(query, { action: 'cast-start' });
  let seen = await handle(query, { action: 'cast-watch', code: cast.code });
  assert.equal(seen.status, 'waiting');
  assert.deepEqual(await handle(query, { action: 'cast-watch', code: cast.code, version: seen.version }), { version: seen.version });
  await handle(query, { action: 'cast-send', ...cast, status: 'drawing', strokes: [[0, 12, [1, 2, 3, 4]]], word: 'secret', seconds: 42 });
  seen = await handle(query, { action: 'cast-watch', code: cast.code, version: seen.version });
  assert.equal(seen.strokes.length, 1); assert.ok(seen.seconds > 40 && seen.seconds <= 42);
  assert.ok(!JSON.stringify(seen).includes('secret'), 'the word stays hidden while drawing');
  await assert.rejects(handle(query, { action: 'cast-send', code: cast.code, secret: 'no', status: 'waiting' }), /ended/);
  await assert.rejects(handle(query, { action: 'cast-send', ...cast, status: 'drawing', strokes: [[99]] }), /Could not share/);
  await assert.rejects(handle(query, { action: 'cast-watch', code: 'ZZZZZ' }), /Nobody/);
}
const yes = p => p.locator('dialog.ask .yes').click();
const { chromium, devices } = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png' };
const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname === '/api/game') {
    let body = ''; for await (const c of req) body += c;
    try { res.end(JSON.stringify(await handle(query, JSON.parse(body), { ask }))); }
    catch (e) { res.writeHead(e instanceof rules.GameError ? 400 : 500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  const path = pathname === '/' ? '/index.html' : pathname;
  try { const b = await readFile(new URL('../public' + path, import.meta.url)); res.writeHead(200, { 'content-type': types[path.split('.').pop()] || 'application/json' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(), errors = [];
const phone = async () => { const p = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', e => errors.push(e.message)); return p; };
const click = (p, name) => p.getByRole('button', { name, exact: true }).click({ timeout: 8000 });
const scribble = async p => {
  const box = await p.locator('canvas.pad').boundingBox();
  await p.mouse.move(box.x + 40, box.y + 40); await p.mouse.down(); await p.mouse.move(box.x + 200, box.y + 180, { steps: 8 }); await p.mouse.up();
};

for (const game of ['bluff', 'doodle']) {
  const phones = [await phone(), await phone(), await phone()];
  const [host, ...guests] = phones;
  await host.goto(`${base}/play.html?game=${game}`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`${base}/play.html?game=${game}&code=${code}`);
    await g.getByPlaceholder('Your name').fill(['Bo', 'Cy'][i]); await click(g, 'Join room');
  }
  if (game === 'bluff') {
    for (const p of phones) await p.locator('#face').setInputFiles(new URL('../public/apple-touch-icon.png', import.meta.url).pathname);
    for (const p of phones) await p.waitForFunction(() => document.querySelectorAll('li img.face').length === 3, null, { timeout: 8000 });
    await host.screenshot({ path: '/tmp/lobby.png', fullPage: true });
    // The photo follows the phone into a new room, until it expires.
    await host.waitForFunction(() => localStorage.getItem('face'));
    const again = await host.context().newPage();
    await again.addInitScript(() => localStorage.removeItem('room'));
    await again.goto(`${base}/play.html?game=bluff&code=ZZZZ`);
    await again.getByPlaceholder('Your name').fill('Ann'); await click(again, 'Create a room');
    await again.locator('li img.face').waitFor({ timeout: 8000 });
    const kept = await again.evaluate(async () => {
      const { savedFace } = await import('/face.js');
      const full = localStorage.getItem('face');
      localStorage.setItem('face', JSON.stringify({ data: 'x', expires: Date.now() - 1 }));
      const expired = savedFace() === '' && !localStorage.getItem('face');
      localStorage.setItem('face', full);
      return expired;
    });
    assert.ok(kept, 'expired photos are erased');
    await again.close();
  }
  if (game === 'bluff') {
    const guest = guests[0];
    await click(guest, 'Sports'); await click(guest, 'Preview Sports');
    await guest.locator('.samples li').nth(2).waitFor({ timeout: 8000 });
    await click(guest, 'Ask host for Sports');
    await host.getByText('Bo wants Sports').waitFor({ timeout: 8000 });
    await click(host, 'Sports (1)');
    await click(host, 'Preview Sports'); await host.locator('.samples li').first().waitFor({ timeout: 8000 });
    await host.screenshot({ path: '/tmp/topics.png', fullPage: true });
  }
  await click(host, game === 'bluff' ? 'Start: 3 questions' : 'Start drawing');
  if (game === 'doodle') for (const p of phones) { await p.locator('canvas.pad').waitFor(); await scribble(p); if (p === host) await host.screenshot({ path: '/tmp/doodle.png', fullPage: true }); await click(p, 'Send drawing'); }
  for (let round = 0; round < 3; round++) {
    await host.getByText(`Round ${round + 1} of 3`).waitFor({ timeout: 8000 });
    await host.waitForTimeout(1800);
    const writers = [];
    for (const p of phones) { await p.getByText(`Round ${round + 1} of 3`).waitFor({ timeout: 8000 }); if (await p.locator('input').count()) writers.push(p); }
    assert.equal(writers.length, game === 'bluff' ? 3 : 2);
    if (game === 'bluff' && round === 0) {
      await click(writers[1], 'AI help (half points)');
      await writers[1].getByText('Suggested by Claude').waitFor({ timeout: 8000 });
      assert.equal(await writers[1].locator('input').inputValue(), 'A hootenanny');
    }
    for (const [i, p] of writers.entries()) {
      await p.locator('input').fill(`fib ${round} ${i}`);
      if (i === writers.length - 1) await p.waitForTimeout(1700); // typed text must survive a poll
      assert.equal(await p.locator('input').inputValue(), `fib ${round} ${i}`);
      await click(p, 'Send');
    }
    for (const p of writers) {
      await p.getByText('Which one is real?').waitFor({ timeout: 8000 });
      await p.locator('button.big:not(.alt):enabled').filter({ hasText: /fib|hootenanny/ }).first().click(); // always pick a fake
    }
    if (game === 'bluff' && round === 0) {
      let seen = false;
      for (const p of phones) {
        await p.getByText(/REAL:/).waitFor({ timeout: 8000 });
        if (await p.locator('.bluffed').count()) { await p.locator('.bluffed img').first().waitFor({ timeout: 8000 }); await p.screenshot({ path: '/tmp/bluffed.png' }); seen = true; }
      }
      assert.ok(seen, 'someone sees the face of whoever fooled them');
    }
    await host.getByText(/REAL:/).waitFor({ timeout: 8000 });
    if (round === 0) {
      await host.waitForTimeout(4300); await host.screenshot({ path: `/tmp/${game}-climbing.png`, fullPage: true });
      await host.screenshot({ path: `/tmp/${game}-reveal.png`, fullPage: true });
    }
    if (round === 1) { await guests[0].reload(); await guests[0].getByText(/REAL:/).waitFor({ timeout: 8000 }); } // rejoin
    await click(host, round === 2 ? 'Final scores' : 'Next round');
  }
  for (const p of phones) await p.getByText(/wins!|for the win!/).waitFor({ timeout: 8000 });
  await host.locator('.podium').waitFor();
  await host.getByRole('heading', { name: 'Play again' }).waitFor();
  await host.screenshot({ path: `/tmp/${game}-final.png`, fullPage: true });
  await host.getByText(/^Night highlights/).click(); await host.locator('.reel .answer').first().waitFor({ timeout: 8000 });
  await host.waitForTimeout(1700); // stays open while the screen updates
  assert.ok(await host.locator('.reel .answer').count() >= 3, 'one per round');
  await host.screenshot({ path: `/tmp/reel-${game}.png`, fullPage: true });
  // Choosing another game from the menu starts fresh instead of reopening this room.
  await guests[1].goto(`${base}/play.html?game=majority`); await guests[1].getByPlaceholder('Room code').waitFor();
  console.log(`${game}: full game passed on 3 browsers`);
}
for (const game of ['faceoff', 'majority', 'telephone']) {
  const phones = [await phone(), await phone(), await phone()];
  const [host, ...guests] = phones;
  await host.goto(`${base}/play.html?game=${game}`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`${base}/play.html?game=${game}&code=${code}`);
    await g.getByPlaceholder('Your name').fill(['Bo', 'Cy'][i]); await click(g, 'Join room');
  }
  await host.locator('#recap li').nth(2).waitFor({ timeout: 8000 });
  await host.screenshot({ path: `/tmp/${game}-lobby.png`, fullPage: true });
  await click(host, { faceoff: 'Start: 1 round', majority: 'Start: 5 questions', telephone: 'Start passing' }[game]);
  const say = async (p, text) => {
    await p.locator('input').fill(text); await p.waitForTimeout(1700); // survives a poll
    assert.equal(await p.locator('input').inputValue(), text);
    await click(p, 'Send');
  };
  if (game === 'faceoff') {
    for (const [i, p] of phones.entries()) {
      for (const n of [1, 2]) {
        await p.getByText(`Your prompt ${n} of 2`).waitFor({ timeout: 8000 });
        if (i === 1 && n === 1) {
          await click(p, 'AI help (half points)'); await p.getByText('Suggested by Claude.', { exact: false }).waitFor({ timeout: 8000 });
          assert.equal(await p.locator('input').inputValue(), 'A hootenanny');
        }
        await say(p, `joke ${i} ${n}`);
        if (i === 0 && n === 1) {
          await click(p, 'Edit “joke 0 1”'); await p.getByText('Your prompt 1 of 2').waitFor({ timeout: 8000 });
          assert.equal(await p.locator('input').inputValue(), 'joke 0 1');
          await click(p, 'Send');
        }
      }
    }
    for (let m = 1; m <= 3; m++) {
      let voted = 0;
      for (const p of phones) {
        await p.getByText(`Matchup ${m} of 3`).or(p.getByRole('button', { name: /^(Next|Final scores)$/ })).first().waitFor({ timeout: 8000 }).catch(() => {});
        await p.locator('button.big:not(.alt), .question').first().waitFor();
        await p.waitForTimeout(1700);
        const choice = p.locator('button.big:not(.alt)').filter({ hasText: 'joke' });
        if (await choice.count()) { await choice.first().click(); voted++; }
      }
      assert.equal(voted, 1);
      await host.locator('.answer.winner').waitFor({ timeout: 8000 });
      if (m === 1) await host.screenshot({ path: '/tmp/faceoff-reveal.png', fullPage: true });
      if (m === 1) {
        await host.locator('.like').first().waitFor({ timeout: 8000 });
        await host.locator('.like').first().click();
        await host.getByRole('button', { name: 'Liked (1)' }).waitFor({ timeout: 8000 });
        await host.screenshot({ path: '/tmp/like.png', fullPage: true });
      }
      await click(host, m === 3 ? 'Final scores' : 'Next');
    }
  } else if (game === 'majority') {
    for (let q = 1; q <= 5; q++) {
      for (const [i, p] of phones.entries()) { await p.getByText(`Question ${q} of 5`).waitFor({ timeout: 8000 }); await p.locator('input').waitFor(); await say(p, ['Soda', 'soda', 'Pop'][i]); }
      await host.locator('.answer.winner').waitFor({ timeout: 8000 });
      if (q === 1) {
        await host.locator('.answer button').first().click(); await host.getByRole('button', { name: 'Same as selected' }).click();
        await host.getByText('Soda / soda / Pop (3)', { exact: false }).or(host.getByText('(3)', { exact: false })).first().waitFor({ timeout: 8000 });
        await host.screenshot({ path: '/tmp/majority-reveal.png', fullPage: true });
      }
      await click(host, q === 5 ? 'Final scores' : 'Next question');
    }
  } else {
    for (let turn = 1; turn <= 3; turn++) {
      for (const [i, p] of phones.entries()) {
        await p.getByText(`Turn ${turn} of 3`).waitFor({ timeout: 8000 });
        if (turn === 2) {
          await p.locator('canvas.pad').waitFor(); await scribble(p);
          if (i === 0) await p.screenshot({ path: '/tmp/telephone-draw.png', fullPage: true });
          await click(p, 'Send drawing');
        } else {
          await p.locator('input').waitFor();
          if (turn === 1 && i === 0) { await click(p, 'Give me an idea'); assert.ok(await p.locator('input').inputValue()); await click(p, 'Send'); }
          else await say(p, `page ${turn} ${i}`);
        }
      }
    }
    for (let book = 1; book <= 3; book++) for (let page = 1; page <= 3; page++) {
      await host.locator('.page').nth(page - 1).waitFor({ timeout: 8000 });
      await host.getByText(`(${book} of 3)`).waitFor({ timeout: 8000 });
      assert.equal(await host.locator('.fav').count(), 0, 'no voting while reading');
      await guests[0].locator('.page').nth(page - 1).waitFor({ timeout: 8000 });
      if (book === 1 && page === 3) {
        await host.screenshot({ path: '/tmp/telephone-reveal.png', fullPage: true });
        const [file] = await Promise.all([host.waitForEvent('download'), click(host, 'Save this book')]);
        assert.equal(file.suggestedFilename(), 'telephone-book.png');
        await file.saveAs('/tmp/book.png');
        await click(guests[0], 'Bravo!');
        await host.locator('.bubbles p').filter({ hasText: 'Bravo! Bo' }).waitFor({ timeout: 8000 });
        await host.screenshot({ path: '/tmp/reaction.png' });
      }
      await click(host, page < 3 ? 'Show next page' : book < 3 ? 'Next book' : 'Vote for a favorite');
    }
    if (game === 'telephone') {
      for (const [i, p] of phones.entries()) {
        await p.getByText('Pick your favorite drawing').waitFor({ timeout: 8000 });
        if (!i) { assert.equal(await p.locator('.page').count(), 3); await p.screenshot({ path: '/tmp/telephone-vote.png', fullPage: true }); }
        await p.locator('.fav').first().click();
        if (i < phones.length - 1) await p.getByText('Vote locked in.').waitFor({ timeout: 8000 });
      }
    }
  }
  for (const p of phones) await p.getByText(game === 'telephone' ? 'Every book has been read.' : /wins!|for the win!/).waitFor({ timeout: 8000 });
  assert.equal(await host.locator('.podium').count(), game === 'telephone' ? 0 : 1);
  await host.getByRole('heading', { name: 'Play again' }).waitFor();
  if (game !== 'telephone') await host.screenshot({ path: `/tmp/${game}-final.png`, fullPage: true });
  if (game !== 'telephone') await host.getByRole('heading', { name: "Tonight's standings" }).waitFor();
  if (game === 'faceoff') {
    await click(host, 'Larger text: off'); await host.waitForTimeout(3500);
    await host.screenshot({ path: '/tmp/large.png', fullPage: true });
    const wide = await host.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(wide <= 0, 'larger text fits the screen');
    await click(host, 'Larger text: on');
  }
  if (game === 'telephone') {
    await host.getByRole('heading', { name: 'Fan favorite', exact: true }).waitFor();
    await host.waitForTimeout(900); await host.screenshot({ path: '/tmp/favorite.png', fullPage: true });
    // Switch everyone to another game with a timer, without rejoining.
    await host.getByText(/^Game options/).click(); await click(host, 'Switch to Majority Rules');
    for (const p of phones) await p.getByRole('heading', { name: 'Majority Rules' }).waitFor({ timeout: 8000 });
    await host.screenshot({ path: '/tmp/switched.png', fullPage: true });
    await host.getByRole('button', { name: '60s', exact: true }).click(); // the options stay open across redraws
    await host.getByText('Game options (timer: 60s)').waitFor();
    await click(host, 'Start: 5 questions');
    for (const p of phones) { await p.locator('.timer:visible').waitFor({ timeout: 8000 }); assert.match(await p.locator('.timer').textContent(), /^(1:00|0:\d\d)$/); }
    await say(guests[1], 'Dog'); await host.getByText('1 of 3 done').waitFor({ timeout: 8000 });
    // Take it back, fix it, send it again.
    await click(guests[1], 'Edit my answer');
    await host.getByText('0 of 3 done').waitFor({ timeout: 8000 });
    assert.equal(await guests[1].locator('input').inputValue(), 'Dog');
    await say(guests[1], 'Dogs'); await host.getByText('1 of 3 done').waitFor({ timeout: 8000 });
    // Losing signal shows a banner, and getting it back says so.
    await guests[0].context().setOffline(true);
    await guests[0].getByText('Connection lost. Reconnecting…').waitFor({ timeout: 8000 });
    await guests[0].screenshot({ path: '/tmp/offline.png' });
    await guests[0].context().setOffline(false);
    await guests[0].getByText('Back online').waitFor({ timeout: 8000 });
    await host.screenshot({ path: '/tmp/timer.png', fullPage: true });
    await guests[1].reload(); await guests[1].getByText('Question 1 of 5').waitFor({ timeout: 8000 });
    assert.equal(await guests[1].evaluate(() => localStorage.getItem('name')), 'Cy');
  }
  const reel = guests[0].getByText(/^Night highlights/);
  if (await reel.count()) {
    await reel.click(); await guests[0].locator('.reel .answer').first().waitFor({ timeout: 8000 });
    await guests[0].screenshot({ path: `/tmp/reel-${game}.png`, fullPage: true });
    console.log(`${game}: highlights shown`);
  }
  if (game === 'telephone') { await click(guests[0], 'Leave party'); await yes(guests[0]); await guests[0].getByPlaceholder('Room code').waitFor(); await guests[0].goto(base); }
  else {
    assert.equal(await guests[0].getByRole('button', { name: 'All games' }).count(), 0);
    // Step out by accident, then come straight back.
    const code = await guests[0].evaluate(() => JSON.parse(localStorage.getItem('room')).code);
    await click(guests[0], 'Leave party'); await yes(guests[0]);
    await click(guests[0], `Rejoin party ${code}`); await guests[0].getByText(code).first().waitFor({ timeout: 8000 });
    await guests[0].goto(base); await guests[0].getByRole('link', { name: `Back to your party (${code})` }).click();
    await guests[0].getByRole('button', { name: 'Leave party' }).waitFor({ timeout: 8000 });
    // Back to the lobby between games: same code, same people.
    await click(host, 'Back to lobby'); await host.getByText('How to play').waitFor({ timeout: 8000 });
    assert.equal((await host.locator('.code').textContent()).trim(), code);
    await host.locator('#recap li').nth(2).waitFor({ timeout: 8000 });
  }
  if (game === 'telephone') await guests[0].goto(base);
  await guests[0].locator('.menu, #recap').first().waitFor();
  console.log(`${game}: full game passed on 3 browsers`);
}
// In the browser: removing someone mid-drawing leaves the other drawings alone.
{
  const phones = [await phone(), await phone(), await phone(), await phone()];
  const [host, ...guests] = phones;
  await host.goto(`${base}/play.html?game=doodle`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`${base}/play.html?game=doodle&code=${code}`);
    await g.getByPlaceholder('Your name').fill(['Bo', 'Cy', 'Di'][i]); await click(g, 'Join room');
  }
  await host.locator('#recap li').nth(3).waitFor({ timeout: 8000 });
  await click(host, 'Start drawing');
  const [bo, cy, di] = guests;
  await cy.locator('canvas.pad').waitFor(); await scribble(cy);
  const ink = () => cy.evaluate(() => document.querySelector('canvas.pad').getContext('2d').getImageData(0, 0, 1000, 1000).data.filter((v, i) => i % 4 === 3 && v).length);
  const before = await ink(); assert.ok(before > 0);
  await host.getByText('Manage players').click();
  await host.screenshot({ path: '/tmp/manage.png', fullPage: true });
  await click(host, 'Remove Bo');
  await click(host.locator('dialog.ask'), 'Cancel'); await host.locator('dialog.ask').waitFor({ state: 'detached' });
  await click(host, 'Remove Bo'); await host.waitForTimeout(1700); // stays open while the screen updates
  await host.screenshot({ path: '/tmp/ask-remove.png' }); await yes(host);
  await bo.getByText('You are no longer in that room.').waitFor({ timeout: 8000 });
  await click(di, 'Leave party'); await yes(di); await di.getByPlaceholder('Room code').waitFor();
  await host.getByRole('button', { name: 'Remove Di' }).waitFor({ state: 'detached', timeout: 8000 });
  await cy.waitForTimeout(1700);
  assert.equal(await ink(), before, 'drawing survives removals');
  // The host goes quiet; the last guest takes over.
  await host.close();
  sqlite.prepare('UPDATE presence SET seen = 0 WHERE code = ?').run(code);
  await cy.reload(); await click(cy, 'Take over as host'); await yes(cy);
  await cy.getByRole('button', { name: 'Host: skip waiting' }).waitFor({ timeout: 8000 });
  await cy.getByText('Manage players').click();
  await click(cy, 'Remove Ann'); await yes(cy); // one player cannot carry on
  await cy.getByText(/Back to the lobby/).waitFor({ timeout: 8000 });
  await cy.screenshot({ path: '/tmp/restarted.png', fullPage: true });
  console.log('removing players: passed');
}
const solo = await phone();
await solo.goto(`${base}/draw.html`);
// The scoreboard starts at last round's totals and order, then climbs.
await solo.evaluate(async () => {
  const { climbing } = await import('/ui.js');
  const board = climbing([{ id: 'a', name: 'Ann', score: 1500 }, { id: 'b', name: 'Bo', score: 2000 }], { b: 1500 }, Date.now(), 0.5, () => false);
  board.id = 'probe'; document.body.append(board);
});
const rows = () => solo.locator('#probe li').evaluateAll(list => list.sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top).map(li => li.textContent));
await solo.waitForTimeout(200);
assert.deepEqual(await rows(), ['Ann: 1500', 'Bo: 500 (+1500)']);
await solo.waitForTimeout(2600);
assert.deepEqual(await rows(), ['Bo: 2000 (+1500)', 'Ann: 1500']);
await solo.locator('#probe').evaluate(n => n.remove());
// Pull to refresh, as the Home Screen app.
{
  const p = await phone();
  await p.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  const pull = (selector, distance) => p.evaluate(([selector, distance]) => {
    const target = document.querySelector(selector);
    const fire = (type, y) => target.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: 50, clientY: y })] }));
    fire('touchstart', 100); fire('touchmove', 100 + distance); window.seen = document.querySelector('.pull')?.textContent; fire('touchend');
  }, [selector, distance]);
  const marked = () => p.evaluate(() => window.mark === 1);
  await p.goto(`${base}/draw.html`); await p.evaluate(() => { window.mark = 1; });
  await p.getByRole('link', { name: '← All Games' }).waitFor();
  assert.ok(!(await p.locator('main').textContent()).includes('undefined'));
  await p.screenshot({ path: '/tmp/drawhome.png', fullPage: true });
  await pull('h1', 60); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.seen), 'Pull to refresh'); assert.ok(await marked(), 'a short pull does nothing');
  await Promise.all([p.waitForEvent('load'), pull('h1', 260)]); assert.ok(!await marked(), 'a long pull reloads');
  await click(p, 'Show my word'); await click(p, 'Start drawing (60s)'); await p.locator('canvas.pad').waitFor();
  await p.evaluate(() => { window.mark = 1; });
  await pull('canvas.pad', 260); await p.waitForTimeout(400); assert.ok(await marked()); assert.equal(await p.locator('.pull, dialog').count(), 0, 'drawing is left alone');
  await pull('h1', 260); await p.locator('dialog.ask').getByRole('button', { name: 'Cancel' }).click(); assert.ok(await marked(), 'asks before losing a drawing');
  await p.context().close();
}
const viewer = await phone();
await click(solo, 'Let others watch on their phones');
const watchCode = (await solo.locator('.code').textContent()).trim();
await viewer.goto(base);
assert.equal(await viewer.getByText('Watch Quick Draw').count(), 0);
await viewer.getByRole('link', { name: /^Quick Draw/ }).click(); await viewer.getByRole('link', { name: 'Watch a drawing' }).click();
await viewer.getByRole('link', { name: '← Quick Draw' }).waitFor(); await viewer.getByPlaceholder('Watch code').fill(watchCode.toLowerCase()); await click(viewer, 'Watch');
await viewer.getByText('Waiting for the next drawing').waitFor({ timeout: 8000 });
await click(solo, 'Show my word'); const word = await solo.locator('h1').textContent(); await click(solo, 'Start drawing (60s)');
await solo.locator('.countdown').waitFor(); await solo.waitForTimeout(400); await solo.screenshot({ path: '/tmp/countdown.png' });
await solo.locator('canvas.pad').waitFor();
const width = () => solo.evaluate(() => { const d = document.querySelector('canvas.pad').getContext('2d').getImageData(0, 0, 1000, 1000).data; return d.filter((v, i) => i % 4 === 3 && v > 128).length; });
await click(solo, 'Thin'); await scribble(solo); const thin = await width();
await click(solo, 'Clear'); await click(solo, 'Thick'); await scribble(solo);
assert.ok(await width() > thin * 3, 'thick lines are thicker');
await viewer.getByText('Shout your guesses!').waitFor({ timeout: 8000 });
await viewer.waitForFunction(() => document.querySelector('canvas')?.getContext('2d').getImageData(0, 0, 1000, 1000).data.some((v, i) => i % 4 === 3 && v), null, { timeout: 8000 });
assert.ok(!(await viewer.locator('main').textContent()).includes(word), 'watchers do not see the word');
await viewer.screenshot({ path: '/tmp/watch.png', fullPage: true });
await solo.screenshot({ path: '/tmp/quick.png', fullPage: true });
await click(solo, 'They got it!');
await viewer.getByText(`It was “${word}”`).waitFor({ timeout: 8000 }); await solo.getByRole('button', { name: 'Add 1', exact: true }).first().click();
assert.equal(await solo.locator('.team output').first().textContent(), '1');
await solo.goto(base); await solo.screenshot({ path: '/tmp/menu.png', fullPage: true });
assert.deepEqual(errors, []);
await browser.close(); server.close();
console.log('all room checks passed');
