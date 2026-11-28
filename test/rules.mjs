// Game rules and the server handler, with no browser. Takes seconds.
import assert from 'node:assert/strict';
import { handle } from '../lib/rooms.js';
import * as rules from '../lib/rules.js';
import { screen } from '../lib/screen.js';
import { suitable } from '../scripts/filter.mjs';
import { sqlite, query, ask, room, move, deals } from './harness.mjs';

assert.equal(suitable({ question: 'Which of these is a fish?', correct_answer: 'Cod' }), false);
assert.equal(suitable({ question: 'What is in beer?', correct_answer: 'Hops' }), false);
assert.equal(suitable({ question: 'What is the largest ocean?', correct_answer: 'Pacific' }), true);

const { tooClose } = await import('../lib/match.js');
for (const [fake, truth] of [['wall', 'The city walls'], ['City wall', 'The city walls'], ['3', 'Three'], ['Hezekia', 'Hezekiah'], ['the fallen city walls', 'The city walls'], ['flamboyence', 'A flamboyance']])
  assert.equal(tooClose(fake, truth), true, `${fake} should match ${truth}`);
for (const [fake, truth] of [['The gates', 'The city walls'], ['Paul', 'Saul'], ['1961', '1960'], ['City towers', 'The city walls'], ['A murder', 'A parliament']])
  assert.equal(tooClose(fake, truth), false, `${fake} should not match ${truth}`);
assert.equal(tooClose('A cat', 'A cat running a lemonade stand', { loose: true }), false);
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
  const games = [...rules.GAMES];
  const begin = (game, n, about) => {
    const r = room(game, n);
    rules.start(r, deals[game] ? deals[game](n) : game === 'bluff' ? Array.from({ length: 4 }, (_, i) => about ? { question: 'q' + i, subject: 'p' + (i % n) } : { question: 'q' + i, answer: 'truth ' + i })
      : game === 'doodle' ? r.players.map(p => 'prompt ' + p.id)
      : game === 'faceoff' ? { sets: 2, prompts: Array.from({ length: 2 * n }, (_, i) => 'f' + i) }
      : game === 'majority' ? { prompts: ['a', 'b', 'c'] } : {});
    return r;
  };
  // One legal move, or the host moving things along.
  const act = (r, random) => {
    const waiting = rules.waitingOn(r);
    if (!waiting.length || random() < 0.05) return rules.advance(r, random);
    move(r, waiting[Math.floor(random() * waiting.length)], random);
  };
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let carried = 0, restarted = 0;
  for (let run = 0; run < 4400; run++) {
    const game = games[run % games.length], least = game === 'snack' ? 4 : ['oddone', 'split', 'whosaid'].includes(game) ? 3 : 2;
    const n = least + (Math.floor(run / games.length) % 6);
    const r = begin(game, n, game === 'bluff' && run % 2 === 0);
    const log = `${game} ${n} players, run ${run}`;
    for (let guard = 0; !['done', 'lobby'].includes(r.phase); guard++) {
      assert.ok(guard < 1500, 'stuck: ' + log);
      if (r.players.length > 1 && random() < 0.08) {
        const target = r.players[Math.floor(random() * r.players.length)].id;
        rules.remove(r, target);
        if (r.phase === 'lobby') { restarted++; assert.ok(r.players.length < (['oddone', 'split', 'whosaid', 'snack'].includes(game) ? 3 : 2) && r.notice, log); } else carried++;
      } else if (r.players.length < 10 && random() < 0.05) {
        // Someone new, or someone coming back.
        const gone = Object.keys(r.left ?? {});
        rules.join(r, { id: 'n' + r.step + '-' + guard, secret: 's', name: gone.length && random() < 0.6 ? gone[0] : `N${run}-${guard}` }, { prompt: 'late', prompts: ['l' + guard, 'm' + guard] });
      } else act(r, random);
      // Nobody may be left staring at a screen that waits for no one.
      if (['writing', 'drawing', 'voting'].includes(r.phase)) assert.ok(rules.waitingOn(r).length, `idle in ${r.phase}: ${log}`);
      // The TV never gets anything private.
      const tv = screen(r), flat = JSON.stringify(tv);
      assert.ok(!/"(secret|you|mine|nudge|yours|likeables|hint|role|roleId|peeks|partners|prompt_|faking|clue|bluffedBy|sittingOut|starters|prev)":/.test(flat), `TV leak: ${log} ${flat.slice(0, 300)}`);
      if (r.phase !== 'reveal' && r.phase !== 'done') assert.ok(!/"(truth|voters|authorIds|authorId_|faker|fakerId|cast|entries)":/.test(flat), `TV spoils: ${log} ${r.phase}`);
      if (r.phase !== 'done') assert.ok(!('cast' in tv) && !/Pie Thief|Watchdog/.test(r.phase === 'reveal' ? '' : flat), log);
      if (game === 'oddone' && r.phase === 'writing') assert.ok(!flat.includes(r.prompts[r.index].split('|')[0]), 'TV shows the faker the prompt');
      if (r.phase === 'drawing') assert.ok(!('question' in tv) && !flat.includes('prompt '), log);
      if (r.phase === 'voting' && game === 'whosaid') assert.ok(tv.answers.every(a => !('author' in a)));
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
  const step = (r, g) => {
    const id = rules.waitingOn(r)[0];
    if (!id) rules.advance(r);
    else move(r, id, Math.random, line, `w${id}${g}`);
  };
  const finish = r => {
    for (let g = 0; r.phase !== 'done'; g++) {
      assert.ok(g < 600, `${r.game} stuck in ${r.phase}`);
      step(r, g);
    }
  };
  const deal = { bluff: [{ question: 'q1', answer: 'a' }, { question: 'q2', answer: 'b' }], doodle: ['x', 'y', 'z'], faceoff: { sets: 2, prompts: 'abcdef'.split('') }, majority: { prompts: ['q', 'r'] }, telephone: {} };
  for (const game of rules.GAMES) {
    // Join at every possible moment of a game.
    const n = game === 'snack' ? 5 : 3;
    for (let when = 0; ; when++) {
      assert.ok(when < 600);
      const r = room(game, n);
      rules.start(r, structuredClone(deals[game]?.(n) ?? deal[game]));
      for (let g = 0; g < when && r.phase !== 'done'; g++) step(r, g);
      const over = r.phase === 'done';
      rules.join(r, { id: 'late', secret: 's', name: 'Late' }, { prompt: 'p', prompts: ['g|h', 'i|j'] });
      const v = rules.view(r, 'late');
      if (r.phase === 'drawing' && game === 'doodle') assert.equal(v.prompt, 'p');
      if (game === 'telephone' && ['writing', 'drawing'].includes(r.phase)) { assert.ok(v.sittingOut); assert.ok(!v.progress.some(p => p.name === 'Late')); }
      finish(r);
      assert.ok(rules.view(r, 'late').players.length === n + 1);
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
// The new games: scoring, secrets and endings.
{
  const go = (r, id, text) => rules.submitFake(r, id, text);
  const o = room('oddone', 4);
  assert.throws(() => rules.start(room('oddone', 2), deals.oddone()), /at least 3/);
  rules.start(o, deals.oddone());
  const faker = o.faker, others = o.players.map(p => p.id).filter(id => id !== faker);
  assert.equal(rules.view(o, faker).question, "You're the faker!");
  assert.ok(!JSON.stringify(rules.view(o, faker)).includes(o.prompts[0].split('|')[0]), 'faker never sees the prompt');
  assert.equal(rules.view(o, others[0]).clue, undefined);
  for (const p of o.players) go(o, p.id, 'answer ' + p.id);
  assert.ok(!('fakerId' in rules.view(o, others[0])));
  assert.throws(() => rules.vote(o, faker, faker), /another/);
  for (const id of others) rules.vote(o, id, faker);
  rules.vote(o, faker, others[0]);
  assert.equal(o.caught, true);
  assert.deepEqual(o.players.map(p => p.score), o.players.map(p => p.id === faker ? 0 : 500));
  rules.like(o, others[0], others[1]);
  rules.advance(o);
  rules.remove(o, o.faker);
  assert.equal(o.index, 2, 'a missing faker skips the round');

  const s = room('split', 5);
  rules.start(s, deals.split());
  for (const p of s.players) go(s, p.id, 'it rains');
  const author = s.scenarios[0].author, voters = s.players.map(p => p.id).filter(id => id !== author);
  assert.throws(() => rules.vote(s, author, 'yes'), /yours/);
  voters.forEach((id, i) => rules.vote(s, id, i < 2 ? 'yes' : 'no'));
  assert.equal(s.players.find(p => p.id === author).score, 1250, 'even split');
  rules.advance(s);
  for (const id of s.players.map(p => p.id).filter(id => id !== s.scenarios[1].author)) rules.vote(s, id, 'yes');
  assert.equal(s.players.find(p => p.id === s.scenarios[1].author).score, s.scenarios[1].author === author ? 1250 : 0);

  const w = room('whosaid', 3);
  rules.start(w, deals.whosaid());
  for (const p of w.players) go(w, p.id, 'said by ' + p.id);
  assert.ok(rules.view(w, 'p0').answers.every(a => !('author' in a) && !('authorId' in a)), 'authors hidden');
  assert.throws(() => rules.vote(w, 'p0', {}), /every/);
  const truth = id => Object.fromEntries(w.list.filter(a => a.author !== id).map(a => [a.n, a.author]));
  rules.vote(w, 'p0', truth('p0')); rules.vote(w, 'p1', truth('p1'));
  const wrong = Object.fromEntries(w.list.filter(a => a.author !== 'p2').map(a => [a.n, a.author === 'p0' ? 'p1' : 'p0']));
  rules.vote(w, 'p2', wrong);
  assert.deepEqual(w.players.map(p => p.score), [1200, 1200, 0]);

  assert.throws(() => rules.start(room('snack', 3), {}), /at least 4/);
  for (const n of [4, 5, 7, 10, 12]) {
    const m = room('snack', n);
    rules.start(m, {});
    const by = role => Object.keys(m.roles).filter(id => m.roles[id] === role);
    assert.equal(by('thief').length, n >= 10 ? 3 : n >= 7 ? 2 : 1);
    assert.equal(by('dog').length, 1); assert.equal(by('grandma').length, n >= 5 ? 1 : 0);
    for (const id of by('family')) {
      const v = rules.view(m, id);
      assert.ok(!v.partners && !v.peeks && v.roleId === 'family' && v.targets.length === n);
    }
    // The family finds every thief.
    for (let g = 0; m.phase !== 'done'; g++) {
      assert.ok(g < 60);
      if (m.phase === 'reveal') { rules.advance(m); continue; }
      const thief = by('thief').find(id => m.alive.includes(id));
      for (const id of rules.waitingOn(m)) {
        if (m.phase === 'writing') move(m, id);
        else if (m.phase === 'voting') rules.vote(m, id, id === thief ? 'skip' : thief);
      }
    }
    const done = rules.view(m, 'p0');
    assert.match(done.headline, /wins/); assert.equal(done.cast.length, n);
  }
  // Night picks that make no sense are refused.
  const n6 = room('snack', 7);
  rules.start(n6, {});
  const [t1, t2] = Object.keys(n6.roles).filter(id => n6.roles[id] === 'thief');
  assert.throws(() => rules.vote(n6, t1, t2), /not a thief/);
  const dog = Object.keys(n6.roles).find(id => n6.roles[id] === 'dog');
  assert.throws(() => rules.vote(n6, dog, dog), /someone else/);
  // Grandma's guard saves the target.
  const g = room('snack', 6);
  rules.start(g, {});
  const role = r => Object.keys(g.roles).find(id => g.roles[id] === r);
  const target = role('family');
  for (const id of rules.waitingOn(g)) rules.vote(g, id, ['thief', 'grandma'].includes(g.roles[id]) ? target : rules.view(g, id).targets.find(t => !t.mine && g.roles[t.id] !== 'thief').id);
  assert.equal(g.news.saved, true); assert.equal(g.alive.length, 6);
  assert.equal(rules.view(g, role('dog')).peeks.length, 1);

  const v = room('survival', 3);
  rules.start(v, deals.survival());
  rules.vote(v, 'p0', v.quiz.right); rules.vote(v, 'p1', (v.quiz.right + 1) % 4); rules.vote(v, 'p2', v.quiz.right);
  assert.deepEqual(v.danger, ['p1']);
  rules.advance(v, () => 0);
  assert.equal(v.stage, 'danger');
  assert.throws(() => rules.vote(v, 'p0', 0), /safe/);
  rules.vote(v, 'p1', v.quiz.right);
  assert.deepEqual(v.alive, ['p0', 'p2']);
  rules.advance(v);
  for (const id of ['p0', 'p1', 'p2']) rules.vote(v, id, id === 'p2' ? (v.quiz.right + 1) % 4 : v.quiz.right);
  assert.equal(v.players[1].score, 500, 'ghosts still score');
  rules.advance(v, () => 0); rules.vote(v, 'p2', v.quiz.right ?? 0);
  rules.advance(v);
  assert.equal(v.phase, 'done');
  assert.ok(v.players[0].score > 10000 && rules.view(v, 'p0').headline.includes('P0'));

  const rr = room('rap', 3);
  rules.start(rr, deals.rap(3));
  assert.equal(rules.view(rr, 'p0').starters.length, 2);
  assert.throws(() => rules.submitFake(rr, 'p0', ['only one', ''], rules.view(rr, 'p0').item), /both/);
  assert.throws(() => rules.reserveHint(rr, 'p0'), /only for/);
  for (let g = 0; rr.phase === 'writing'; g++) { const id = rules.waitingOn(rr)[0]; move(rr, id, Math.random, undefined, 'line ' + g); }
  assert.equal(rr.options[0].text.split('\n').length, 4);
  assert.equal(rules.waitingOn(rr).length, 1);
  // Through the server, every new game deals and starts.
  for (const game of ['rap', ...Object.keys(deals).filter(k => k !== 'rap')]) {
    const h = await handle(query, { action: 'create', game, name: 'A' });
    for (const name of ['B', 'C', 'D']) await handle(query, { action: 'join', code: h.code, name });
    const started = await handle(query, { action: 'start', code: h.code, playerId: h.playerId, secret: h.secret, step: 0, rounds: 0 });
    assert.ok(['writing', 'voting'].includes(started.state.phase), game);
    assert.ok(started.state.question);
    await handle(query, { action: 'join', code: h.code, name: 'E' });
  }
}
// Pokes: only from finished players, only to those still going, private, and gone once the screen changes.
{
  const r = room('faceoff', 3);
  rules.start(r, { sets: 1, prompts: ['a', 'b', 'c'] });
  assert.throws(() => rules.poke(r, 'p0', 'p1', ''), /your own turn/);
  assert.equal(rules.view(r, 'p0').nudge, undefined);
  for (let k = 0; k < 2; k++) rules.submitFake(r, 'p0', 'x' + k, rules.view(r, 'p0').item);
  assert.deepEqual(rules.view(r, 'p0').nudge.map(t => t.id), ['p1', 'p2']);
  rules.poke(r, 'p0', 'p1', '  Hurry   up ', 1000);
  assert.deepEqual(rules.view(r, 'p1').pokes, [{ n: 1, from: 'P0', text: 'Hurry up' }]);
  assert.deepEqual(rules.view(r, 'p2').pokes, []);
  assert.throws(() => rules.poke(r, 'p0', 'all', '', 50000), /done now/, 'no sending to everyone');
  assert.throws(() => rules.poke(r, 'p0', 'p2', '', 2000), /Wait 9 more seconds/, 'one poke per sender, whoever it is for');
  rules.poke(r, 'p0', 'p2', 'y'.repeat(90), 21000);
  assert.equal(rules.view(r, 'p2').pokes[0].text.length, 60);
  for (let k = 0; k < 2; k++) rules.submitFake(r, 'p1', 'z' + k, rules.view(r, 'p1').item);
  if (r.phase === 'writing') {
    assert.throws(() => rules.poke(r, 'p1', 'p2', '', 22000), /just poked/, 'the receiver gets a breather too');
    rules.poke(r, 'p1', 'p2', '', 31000);
  }
  assert.throws(() => rules.poke(r, 'p0', 'p0', '', 90000), /done now/);
  for (let g = 0; g < 100; g++) rules.poke(r, 'p0', 'p2', '', 100000 + g * 20000);
  assert.ok(r.pokes.length <= 40);
  rules.setPokes(r, false);
  assert.equal(rules.view(r, 'p0').nudge, undefined);
  assert.deepEqual(rules.view(r, 'p2').pokes, [], 'switching off clears pop-ups');
  assert.throws(() => rules.poke(r, 'p0', 'p2', '', 9e6), /turned pestering off/);
  rules.setPokes(r, true);
  assert.ok(rules.view(r, 'p0').nudge);
  rules.advance(r);
  assert.deepEqual(rules.view(r, 'p2').pokes ?? [], [], 'old pokes vanish');
  while (r.phase !== 'reveal') rules.advance(r);
  assert.throws(() => rules.poke(r, 'p0', 'p1', ''), /your own turn/);
  const s = room('snack', 5);
  rules.start(s, {});
  move(s, 'p0');
  assert.equal(rules.view(s, 'p0').canNote, false);
  assert.throws(() => rules.poke(s, 'p0', 'p1', 'psst it is Bo'), /just pokes/);
  rules.poke(s, 'p0', 'p1', '');
  s.alive = s.alive.filter(id => id !== 'p0');
  assert.throws(() => rules.poke(s, 'p0', 'p2', ''), /your own turn/);
  const h = await handle(query, { action: 'create', game: 'majority', name: 'A' });
  const j = await handle(query, { action: 'join', code: h.code, name: 'B' });
  const [a, b] = [h, j].map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  const go = await handle(query, { action: 'start', ...a, step: 0 });
  await handle(query, { action: 'fake', ...a, step: go.state.step, text: 'cake' });
  await assert.rejects(handle(query, { action: 'poke', ...a, secret: 'no', to: b.playerId }), /not in this room/);
  await assert.rejects(handle(query, { action: 'pokes', ...b, on: false }), /Only the host/);
  assert.equal((await handle(query, { action: 'pokes', ...a, on: false })).state.pokesOff, true);
  await assert.rejects(handle(query, { action: 'poke', ...a, to: b.playerId }), /turned pestering off/);
  await handle(query, { action: 'pokes', ...a, on: true });
  await handle(query, { action: 'poke', ...a, to: b.playerId, text: 'go' });
  assert.equal((await handle(query, { action: 'poll', ...b })).state.pokes[0].from, 'A');
}
// Likes: toggled on results, not your own, no points, and counted for an award.
{
  const m = room('majority', 4);
  rules.start(m, { prompts: ['q'] });
  assert.throws(() => rules.like(m, 'p0', 'p1'), /once you have voted|results/i);
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
// AI help sees what others sent, never repeats itself, and stays away from the real answer.
{
  const { leans } = await import('../lib/match.js');
  const { message } = await import('../lib/hint.js');
  assert.ok(leans('The walls of Jericho', 'the city walls', 'What fell?'));
  assert.ok(leans('A wooden boat', 'a boat', 'What did he build?'));
  assert.ok(!leans('A giant sandwich', 'the city walls', 'What fell?'));
  assert.ok(!leans('A city of tents', 'the city walls', 'What fell around the city?'), 'words from the question are fine');
  assert.ok(message({ question: 'q', avoid: ['one\ntwo'] }, 'x').includes('- one / two'));
  const h = await handle(query, { action: 'create', game: 'faceoff', name: 'A' });
  const ps = [h];
  for (const name of ['B', 'C']) ps.push(await handle(query, { action: 'join', code: h.code, name }));
  const who = ps.map(p => ({ code: h.code, playerId: p.playerId, secret: p.secret }));
  await handle(query, { action: 'start', ...who[0], step: 0, rounds: 1 });
  const at = async p => (await handle(query, { action: 'poll', ...p })).state;
  // Everyone but the asker answers first, so the shared prompt has an answer to see.
  for (const p of who.slice(1)) for (let k = 0; k < 2; k++) { const x = await at(p); if (x.phase === 'writing' && !x.sent) await handle(query, { action: 'fake', ...p, step: x.step, item: x.item, text: `Purple walrus ${p.playerId.slice(0, 3)} ${k}` }); }
  const seen = [], ideas = ['Same old joke', 'Same old joke', 'A brand new one'];
  const ask = async q => { seen.push(q); return ideas.shift(); };
  let v = await at(who[0]);
  await handle(query, { action: 'hint', ...who[0], step: v.step }, { ask });
  assert.equal(seen[0].avoid.length, 1);
  assert.match(seen[0].avoid[0], /Purple walrus/);
  v = await at(who[0]);
  await handle(query, { action: 'fake', ...who[0], step: v.step, item: v.item, text: 'Something of mine' });
  v = await at(who[0]);
  await handle(query, { action: 'hint', ...who[0], step: v.step }, { ask });
  assert.equal((await at(who[0])).hint, 'A brand new one', 'a repeat is thrown out and asked again');
  assert.ok(seen.at(-1).avoid.includes('Same old joke'));
  const bluff = await handle(query, { action: 'create', game: 'bluff', name: 'A' });
  await handle(query, { action: 'join', code: bluff.code, name: 'B' });
  const a = { code: bluff.code, playerId: bluff.playerId, secret: bluff.secret };
  const go = await handle(query, { action: 'start', ...a, step: 0, topic: 'bible', rounds: 3 });
  let real, tries = 0;
  await assert.rejects(handle(query, { action: 'hint', ...a, step: go.state.step }, { ask: async q => { tries++; real = q.answer; return `${real} indeed`; } }), /new one/);
  assert.equal(tries, 3);
  assert.equal((await handle(query, { action: 'poll', ...a })).state.canHint, true, 'nothing charged');
}
// What you sent stays in view, and likes can start once you have voted.
{
  const r = room('bluff', 4);
  rules.start(r, [{ question: 'q', answer: 'truth' }]);
  rules.submitFake(r, 'p0', 'first fake');
  assert.deepEqual(rules.view(r, 'p0').yours, [{ label: 'Your answer', text: 'first fake' }]);
  assert.equal(rules.view(r, 'p1').yours, undefined);
  for (const [i, id] of ['p1', 'p2', 'p3'].entries()) rules.submitFake(r, id, ['second', 'third', 'fourth'][i]);
  const pick = text => r.options.findIndex(o => o.text === text);
  assert.equal(rules.view(r, 'p0').likeables, undefined);
  assert.throws(() => rules.like(r, 'p0', pick('second')), /once you have voted/);
  rules.vote(r, 'p0', pick('truth'));
  assert.deepEqual(rules.view(r, 'p0').yours.map(y => y.text), ['first fake', 'truth']);
  const list = rules.view(r, 'p0').likeables;
  assert.equal(list.length, 5);
  assert.ok(list.every(o => !o.authors && !o.by && !('truth' in o)), 'nothing gives the answer away');
  rules.like(r, 'p0', pick('second')); rules.like(r, 'p0', pick('truth'));
  assert.throws(() => rules.like(r, 'p0', pick('first fake')), /yours/);
  assert.equal(rules.view(r, 'p0').likes, undefined, 'counts wait for the results');
  assert.equal(rules.view(r, 'p0').likeables.filter(o => o.liked).length, 2);
  rules.advance(r);
  assert.deepEqual(rules.view(r, 'p2').likes.p1, ['p0'], 'likes carry into the results');
  assert.equal(rules.view(r, 'p0').mostLiked, undefined, 'the list waits for the end');
  rules.advance(r);
  assert.deepEqual(rules.view(r, 'p0').mostLiked.map(l => [l.text, l.by]).sort(), [['second', 'P1'], ['truth', '']]);
  for (const game of ['faceoff', 'rap', 'oddone', 'split', 'whosaid']) {
    const g = room(game, 4);
    rules.start(g, deals[game]?.(4) ?? { sets: 1, prompts: ['a', 'b', 'c', 'd'] });
    for (let n = 0; g.phase !== 'voting' && n < 40; n++) move(g, rules.waitingOn(g)[0], Math.random, undefined, 'answer ' + n);
    const voter = rules.waitingOn(g)[0];
    assert.ok(rules.view(g, voter).yours || game !== 'oddone', game);
    move(g, voter);
    const targets = rules.view(g, voter).likeables, other = targets.find(t => !t.mine);
    assert.ok(other, game);
    rules.like(g, voter, other.ref);
    assert.equal(rules.view(g, voter).likeables.find(t => t.ref === other.ref).liked, true, game);
    rules.advance(g);
    assert.equal(Object.values(g.likes).flat().length, 1, `${game} keeps likes`);
    rules.advance(g);
    assert.deepEqual(g.likes, {}, `${game} clears them next screen`);
    while (g.phase !== 'done') rules.advance(g);
    const best = rules.view(g, voter).mostLiked;
    assert.equal(best.length, 1, game);
    assert.ok(best[0].text && best[0].by && best[0].likes === 1, game);
  }
}
// New names between rounds, and votes for the next game.
{
  const r = room('majority', 3);
  rules.want(r, 'p1', 'rap'); rules.want(r, 'p2', 'rap'); rules.want(r, 'p2', 'rap');
  assert.deepEqual(rules.view(r, 'p0').wants, [{ id: 'p1', name: 'P1', game: 'rap' }]);
  assert.throws(() => rules.want(r, 'p1', 'chess'), /Unknown/);
  r.night = { p1: { name: 'P1', points: 3, wins: 1 } };
  assert.throws(() => rules.rename(r, 'p1', ' p0 '), /taken/);
  rules.rename(r, 'p1', 'Zed');
  assert.deepEqual(r.night, { zed: { name: 'Zed', points: 3, wins: 1 } });
  rules.rename(r, 'p1', 'ZED');
  assert.equal(r.players[1].name, 'ZED');
  rules.start(r, { prompts: ['q', 'r'] });
  assert.deepEqual(r.wants, {});
  assert.throws(() => rules.rename(r, 'p1', 'Mid'), /between rounds/);
  assert.throws(() => rules.want(r, 'p1', 'rap'), /between games/);
  rules.advance(r);
  rules.rename(r, 'p1', 'Later');
}
// Last One Standing ramps up.
{
  const { SURVIVAL } = await import('../lib/more-content.js');
  const all = Object.values(SURVIVAL).flat();
  assert.equal(new Set(all.map(q => q.split('|')[0])).size, all.length, 'no repeated questions');
  assert.ok(all.every(q => { const [, ...a] = q.split('|'); return a.length === 4 && new Set(a).size === 4; }));
  const h = await handle(query, { action: 'create', game: 'survival', name: 'A' });
  await handle(query, { action: 'join', code: h.code, name: 'B' });
  const a = { code: h.code, playerId: h.playerId, secret: h.secret };
  await handle(query, { action: 'start', ...a, step: 0, rounds: 12 });
  const dealt = JSON.parse((await query('SELECT state FROM rooms WHERE code = ?', [h.code]))[ 'rows'][0].state).questions;
  assert.deepEqual(dealt.map(q => Object.keys(SURVIVAL).find(k => SURVIVAL[k].includes(q))), ['easy', 'easy', ...Array(5).fill('medium'), ...Array(5).fill('hard')]);
  const v = room('survival', 3);
  rules.start(v, deals.survival());
  v.index = 6;
  rules.vote(v, 'p0', v.quiz.right); rules.vote(v, 'p1', (v.quiz.right + 1) % 4); rules.vote(v, 'p2', v.quiz.right);
  rules.advance(v);
  assert.equal(v.kind, 'pie'); assert.equal(v.quiz.hot.length, 2);
  rules.vote(v, 'p1', v.quiz.hot[1]);
  assert.deepEqual(v.alive, ['p0', 'p2']);
  assert.match(rules.view(v, 'p0').answer, /pies\./);
}
console.log('rules checks passed');
