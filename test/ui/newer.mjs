// The six newer games, start to finish on four phones.
import assert from 'node:assert/strict';
import * as rules from '../../lib/rules.js';
import { sqlite } from '../harness.mjs';
import { base, phone, click, finish } from './browser.mjs';

// The newer games, start to finish on four phones.
for (const game of ['rap', 'oddone', 'split', 'whosaid', 'snack', 'survival']) {
  const still = { reducedMotion: 'reduce' };
  const phones = [await phone(still), await phone(still), await phone(still), await phone(still)];
  const [host, ...guests] = phones;
  await host.goto(`${base}/play.html?game=${game}`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [i, g] of guests.entries()) {
    await g.goto(`${base}/play.html?game=${game}&code=${code}`);
    await g.getByPlaceholder('Your name').fill(['Bo', 'Cy', 'Di'][i]); await click(g, 'Join room');
  }
  await host.locator('#recap li').nth(3).waitFor({ timeout: 8000 });
  await host.screenshot({ path: `/tmp/new-${game}-0lobby.png`, fullPage: true });
  await click(host, { rap: 'Start: 1 round', oddone: 'Start: 3 rounds', split: 'Start: 1 round', whosaid: 'Start: 3 questions', snack: 'Start the first night', survival: 'Start: 8 questions' }[game]);
  const stored = () => JSON.parse(sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(code).state);
  const shots = new Set();
  const shot = async (p, label) => { if (!shots.has(label)) { shots.add(label); await p.waitForTimeout(200); await p.screenshot({ path: `/tmp/new-${game}-${label}.png`, fullPage: true }); } };
  const ids = [];
  for (const p of phones) ids.push(await p.evaluate(() => JSON.parse(localStorage.getItem('room')).playerId));
  let last = '';
  for (let turn = 0; ; turn++) {
    assert.ok(turn < 300, `${game} stuck at ${last}`);
    const r = stored();
    if (r.phase === 'done') break;
    last = `${r.phase} ${r.step}`;
    const waiting = rules.waitingOn(r);
    if (!waiting.length) {
      const next = host.getByRole('button', { name: /^(Next|Next round|Next question|Final scores|Open the vote|Night falls|See who won|Start the danger round)$/ });
      await next.waitFor({ timeout: 8000 });
      await shot(host, `reveal${r.stage ?? r.news?.stage ?? ''}`);
      await next.click();
    } else {
      const i = ids.indexOf(waiting[0]), p = phones[i], v = rules.view(r, ids[i]);
      // Wait for this phone to catch up to the current screen.
      if (r.phase === 'writing' && game === 'rap') {
        await p.getByText(v.starters[0], { exact: true }).waitFor({ timeout: 8000 });
        const boxes = p.getByPlaceholder('Your rhyme');
        await boxes.nth(0).fill(`my rhyme number ${turn}`); await boxes.nth(1).fill('and that is how we do');
        await p.waitForTimeout(700); assert.equal(await boxes.nth(1).inputValue(), 'and that is how we do');
        await shot(p, 'write'); await click(p, 'Send');
        if (!shots.has('edit')) { shots.add('edit'); await click(p, 'Edit sent verse 1'); await p.waitForFunction(want => document.querySelector('input')?.value === want, `my rhyme number ${turn}`, { timeout: 8000 }); await click(p, 'Send'); }
      } else if (r.phase === 'writing' && game !== 'snack') {
        const box = p.locator('input');
        await p.getByText(v.question, { exact: false }).first().waitFor({ timeout: 8000 }); await box.waitFor({ timeout: 8000 });
        await box.fill(`reply ${turn}`); await p.waitForTimeout(700); assert.equal(await box.inputValue(), `reply ${turn}`);
        await shot(p, v.faking ? 'faker' : 'write'); await click(p, 'Send');
        if (!shots.has('edit') && stored().phase === 'writing') { shots.add('edit'); await click(p, 'Edit my answer'); await box.waitFor(); assert.equal(await box.inputValue(), `reply ${turn}`); await click(p, 'Send'); }
      } else if (game === 'snack') {
        await p.getByText(v.question, { exact: true }).waitFor({ timeout: 8000 });
        assert.ok(!(await p.locator('main').textContent()).includes('You are:'), 'role starts covered');
        if (!shots.has('peek')) { await click(p, 'Peek at my role'); await p.getByText(`You are: ${v.role}`).waitFor(); await shot(p, 'peek'); await click(p, 'Hide my role'); }
        await shot(p, r.phase === 'writing' ? 'night' : 'day');
        const thief = Object.keys(r.roles).find(id => r.roles[id] === 'thief');
        const want = r.phase === 'voting' && ids[i] !== thief ? thief : v.targets.find(t => !t.mine && t.id !== thief)?.id ?? v.targets[0].id;
        const t = v.targets.find(t => t.id === want);
        await click(p, t.mine ? `${t.name} (you)` : t.name);
      } else if (game === 'whosaid') {
        await p.locator('select').first().waitFor({ timeout: 8000 });
        const selects = p.locator('select');
        for (let k = 0; k < await selects.count(); k++) await selects.nth(k).selectOption({ index: 1 + k });
        await p.waitForTimeout(700); assert.notEqual(await selects.first().inputValue(), '', 'picks survive a poll');
        await shot(p, 'vote'); await click(p, 'Lock in my guesses');
      } else {
        const text = game === 'split' ? 'Yes' : game === 'survival' ? v.choices[i === 0 ? r.quiz.right ?? 0 : 0] : null;
        const target = game === 'oddone' ? p.locator('button.big:enabled').filter({ hasText: 'reply' }).first()
          : game === 'rap' ? p.locator('button.verse:enabled').first() : p.getByRole('button', { name: text, exact: true });
        await p.getByText(v.question, { exact: false }).first().waitFor({ timeout: 8000 });
        await target.waitFor({ timeout: 8000 }); await shot(p, v.stage === 'danger' ? 'danger' : 'vote'); await target.click();
      }
    }
    // Let the move reach the room.
    for (let k = 0; k < 80; k++) { const now = stored(); if (now.step !== r.step || JSON.stringify(now) !== JSON.stringify(r)) break; await host.waitForTimeout(50); }
  }
  for (const p of phones) await p.getByRole('heading', { name: 'Final scores' }).waitFor({ timeout: 8000 });
  await shot(host, 'final');
  assert.ok(!(await host.locator('main').textContent()).includes('undefined'));
  for (const p of phones) await p.context().close();
  console.log(`${game}: full game passed on 4 browsers`);
}
await finish();
