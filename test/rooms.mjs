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
await Promise.all(all.map((p, i) => handle(query, { action: 'fake', ...p, step: r.state.step, text: 'lie ' + i })));
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
  assert.ok(carried > 500 && restarted > 100, `${carried} carried on, ${restarted} restarted`);
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
    if (round === 0) await host.screenshot({ path: `/tmp/${game}-reveal.png`, fullPage: true });
    if (round === 1) { await guests[0].reload(); await guests[0].getByText(/REAL:/).waitFor({ timeout: 8000 }); } // rejoin
    await click(host, round === 2 ? 'Final scores' : 'Next round');
  }
  for (const p of phones) await p.getByText(/wins!|for the win!/).waitFor({ timeout: 8000 });
  await host.locator('.podium').waitFor();
  await host.getByRole('heading', { name: 'Play again' }).waitFor();
  await host.screenshot({ path: `/tmp/${game}-final.png`, fullPage: true });
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
  await host.locator('li').nth(2).waitFor({ timeout: 8000 });
  await host.screenshot({ path: `/tmp/${game}-lobby.png`, fullPage: true });
  await click(host, { faceoff: 'Start: 1 round', majority: 'Start: 5 questions', telephone: 'Start passing' }[game]);
  const say = async (p, text) => {
    await p.locator('input').fill(text); await p.waitForTimeout(1700); // survives a poll
    assert.equal(await p.locator('input').inputValue(), text);
    await click(p, 'Send');
  };
  if (game === 'faceoff') {
    for (const [i, p] of phones.entries()) {
      for (const n of [1, 2]) { await p.getByText(`Your prompt ${n} of 2`).waitFor({ timeout: 8000 }); await say(p, `joke ${i} ${n}`); }
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
      await guests[0].locator('.page').nth(page - 1).waitFor({ timeout: 8000 });
      if (book === 1 && page === 3) await host.screenshot({ path: '/tmp/telephone-reveal.png', fullPage: true });
      await click(host, page < 3 ? 'Show next page' : book < 3 ? 'Next book' : 'Finish');
    }
  }
  for (const p of phones) await p.getByText(game === 'telephone' ? 'Every book has been read.' : /wins!|for the win!/).waitFor({ timeout: 8000 });
  assert.equal(await host.locator('.podium').count(), game === 'telephone' ? 0 : 1);
  await host.getByRole('heading', { name: 'Play again' }).waitFor();
  if (game !== 'telephone') await host.screenshot({ path: `/tmp/${game}-final.png`, fullPage: true });
  await click(guests[0], 'All games'); await guests[0].locator('.menu').waitFor();
  assert.equal(await guests[0].evaluate(() => localStorage.getItem('room')), null);
  console.log(`${game}: full game passed on 3 browsers`);
}
// In the browser: removing someone mid-drawing leaves the other drawings alone.
{
  const phones = [await phone(), await phone(), await phone(), await phone()];
  const [host, ...guests] = phones;
  for (const p of phones) p.on('dialog', d => d.accept());
  await host.goto(`${base}/play.html?game=doodle`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`${base}/play.html?game=doodle&code=${code}`);
    await g.getByPlaceholder('Your name').fill(['Bo', 'Cy', 'Di'][i]); await click(g, 'Join room');
  }
  await host.locator('li').nth(3).waitFor({ timeout: 8000 });
  await click(host, 'Start drawing');
  const [bo, cy, di] = guests;
  await cy.locator('canvas.pad').waitFor(); await scribble(cy);
  const ink = () => cy.evaluate(() => document.querySelector('canvas.pad').getContext('2d').getImageData(0, 0, 1000, 1000).data.filter((v, i) => i % 4 === 3 && v).length);
  const before = await ink(); assert.ok(before > 0);
  await host.getByText('Manage players').click();
  await host.screenshot({ path: '/tmp/manage.png', fullPage: true });
  await click(host, 'Remove Bo');
  await bo.getByText('You are no longer in that room.').waitFor({ timeout: 8000 });
  await click(di, 'Leave game'); await di.getByPlaceholder('Room code').waitFor();
  await host.getByRole('button', { name: 'Remove Di' }).waitFor({ state: 'detached', timeout: 8000 });
  await cy.waitForTimeout(1700);
  assert.equal(await ink(), before, 'drawing survives removals');
  // The host goes quiet; the last guest takes over.
  await host.close();
  sqlite.prepare('UPDATE presence SET seen = 0 WHERE code = ?').run(code);
  await cy.reload(); await click(cy, 'Take over as host');
  await cy.getByRole('button', { name: 'Host: skip waiting' }).waitFor({ timeout: 8000 });
  await cy.getByText('Manage players').click();
  await click(cy, 'Remove Ann'); // one player cannot carry on
  await cy.getByText(/Back to the lobby/).waitFor({ timeout: 8000 });
  await cy.screenshot({ path: '/tmp/restarted.png', fullPage: true });
  console.log('removing players: passed');
}
const solo = await phone();
await solo.goto(`${base}/draw.html`);
await click(solo, 'Show my word'); await click(solo, 'Start drawing (60s)'); await scribble(solo);
await solo.screenshot({ path: '/tmp/quick.png', fullPage: true });
await click(solo, 'They got it!'); await solo.getByRole('button', { name: 'Add 1', exact: true }).first().click();
assert.equal(await solo.locator('.team output').first().textContent(), '1');
await solo.goto(base); await solo.screenshot({ path: '/tmp/menu.png', fullPage: true });
assert.deepEqual(errors, []);
await browser.close(); server.close();
console.log('all room checks passed');
