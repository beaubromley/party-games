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
for (const topic of ['bible', 'words', 'about']) {
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
    for (const p of phones) await p.locator('#face').setInputFiles(new URL('../public/icon-180.png', import.meta.url).pathname);
    for (const p of phones) await p.waitForFunction(() => document.querySelectorAll('li img.face').length === 3, null, { timeout: 8000 });
    await host.screenshot({ path: '/tmp/lobby.png', fullPage: true });
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
      await p.locator('button.big:not(.alt):enabled').first().click();
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
  for (const p of phones) await p.getByText(/wins!/).waitFor({ timeout: 8000 });
  console.log(`${game}: full game passed on 3 browsers`);
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
