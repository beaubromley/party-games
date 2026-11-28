// Mini games: practice on one phone, then played together while waiting.
import assert from 'node:assert/strict';
import { sqlite } from '../harness.mjs';
import { base, phone, screenPage, click, finish } from './browser.mjs';

// Practice: every game runs to its score screen.
{
  const p = await phone();
  await p.addInitScript(() => { window.miniSeconds = 2; });
  await p.goto(base);
  await p.getByRole('link', { name: /Mini Games/ }).click();
  await p.locator('.pickmini').nth(9).waitFor(); await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/mini-menu.png', fullPage: true });
  const titles = await p.locator('.pickmini').evaluateAll(list => list.map(b => b.firstChild.textContent));
  assert.equal(titles.length, 10);
  for (const [i, title] of titles.entries()) {
    await p.locator('.pickmini').nth(i).click();
    await p.locator('canvas.mini').waitFor();
    await p.locator('.count3').waitFor({ state: 'detached' });
    const box = await p.locator('canvas.mini').boundingBox(), view = p.viewportSize();
    assert.ok(box.y >= 0 && box.y + box.height <= view.height + 1 && box.width > 280, `${title} fits the screen: ${JSON.stringify(box)}`);
    await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5, { steps: 4 }); await p.mouse.up();
    if (i === 0) await p.screenshot({ path: '/tmp/mini-phone.png' });
    await p.getByText(/^Score: \d+$/).waitFor({ timeout: 8000 });
    await click(p, 'All mini games');
  }
  await click(p, 'Play all 10 in a row');
  await p.getByText(/Next game in \d+s/).waitFor({ timeout: 8000 });
  await click(p, 'All mini games');
}

// Together: practice in the lobby, then while waiting during a real game.
{
  const host = await phone(), bo = await phone();
  await host.goto(`${base}/play.html?game=faceoff`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  await bo.goto(`${base}/play.html?game=faceoff&code=${code}`);
  await bo.getByPlaceholder('Your name').fill('Bo'); await click(bo, 'Join room');
  await host.locator('#recap li').nth(1).waitFor({ timeout: 8000 });
  await click(host, 'Play mini games together'); await click(bo, 'Play mini games together');
  await host.getByText('Next up').waitFor({ timeout: 8000 });
  await host.screenshot({ path: '/tmp/mini-next.png' });
  for (const p of [host, bo]) await p.locator('.arcade canvas.mini').waitFor({ timeout: 8000 });
  await bo.screenshot({ path: '/tmp/mini-playing.png' });
  // Both scores show up on both phones once the half minute is over.
  for (const p of [host, bo]) await p.locator('.miniscores li').nth(1).waitFor({ timeout: 45000 });
  await host.screenshot({ path: '/tmp/mini-results.png' });
  await bo.locator('.arcade canvas.mini').waitFor({ timeout: 20000 }); // the next one starts by itself
  // The real game interrupts, and that round is thrown away.
  await click(bo, 'Close');
  await click(host, 'Close');
  await click(host, 'Start: 1 round');
  await host.getByPlaceholder('Make them laugh').first().waitFor({ timeout: 8000 });
  assert.equal(await host.getByRole('button', { name: /Play mini games/ }).isVisible(), false, 'not while it is your turn');
  const answer = async (p, text) => {
    await p.locator('.count3').waitFor({ state: 'detached' });
    while (await p.getByPlaceholder('Make them laugh').count()) {
      const before = await p.locator('#app').innerText();
      await p.getByPlaceholder('Make them laugh').first().fill(`${text} ${Math.random()}`.slice(0, 20)); await click(p, 'Send');
      await p.waitForFunction(old => document.querySelector('#app').innerText !== old, before);
    }
  };
  await answer(host, 'Ann');
  await click(host, 'Play mini games while you wait');
  await host.locator('.arcade').waitFor();
  await host.locator('.arcade canvas.mini').waitFor({ timeout: 10000 });
  await answer(bo, 'Bo');
  await host.locator('.arcade').waitFor({ state: 'detached', timeout: 8000 });
  const room = JSON.parse(sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(code).state);
  assert.equal(room.mini.rounds.at(-1).void, true);
  await host.screenshot({ path: '/tmp/mini-interrupted.png' });
}
// Group Doodle: it opens on every phone, lines cross between them and the TV, and all end with the same picture.
{
  const host = await phone(), bo = await phone(), tv = await screenPage({ viewport: { width: 1280, height: 720 } });
  await host.goto(`${base}/play.html?game=bluff`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  await bo.goto(`${base}/play.html?game=bluff&code=${code}`);
  await bo.getByPlaceholder('Your name').fill('Bo'); await click(bo, 'Join room');
  await tv.goto(`${base}/tv.html?code=${code}`);
  await tv.getByPlaceholder('Room code').fill(code).catch(() => {});
  await tv.getByRole('button', { name: 'Show this party' }).click({ timeout: 2000 }).catch(() => {});
  await host.locator('#recap li').nth(1).waitFor({ timeout: 8000 });
  await click(host, 'Group Doodle: everyone draws');
  for (const p of [host, bo]) await p.locator('canvas.shared').waitFor({ timeout: 8000 });
  await tv.locator('.mural canvas').waitFor({ timeout: 8000 });
  // Skip most of the clock: enough left to draw, then it ends.
  const shift = ms => { const row = sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(code), r = JSON.parse(row.state); r.doodle.start -= ms; r.doodle.end -= ms; sqlite.prepare('UPDATE rooms SET state = ?, version = version + 1 WHERE code = ?').run(JSON.stringify(r), code); };
  shift(52000);
  await host.waitForTimeout(900);
  const line = async (p, y) => { const b = await p.locator('canvas.shared').boundingBox(); await p.mouse.move(b.x + 30, b.y + b.height * y); await p.mouse.down(); await p.mouse.move(b.x + b.width - 30, b.y + b.height * (y + 0.2), { steps: 15 }); await p.mouse.up(); };
  await line(host, 0.2); await line(bo, 0.6);
  const colors = (p, selector) => p.locator(selector).evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, 1000, 1000).data, out = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) out.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return ['17,17,17', '229,56,59'].filter(k => out.has(k)).length; });
  for (const [p, selector] of [[host, 'canvas.shared'], [bo, 'canvas.shared'], [tv, '.mural canvas']]) {
    await p.waitForTimeout(700);
    assert.equal(await colors(p, selector), 2, 'both colors arrive');
  }
  await host.screenshot({ path: '/tmp/doodle-phone.png' }); await tv.screenshot({ path: '/tmp/doodle-tv.png' });
  for (const p of [host, bo]) await p.getByRole('button', { name: 'Save picture' }).waitFor({ timeout: 20000 });
  assert.equal(await colors(bo, 'canvas.shared'), 2);
  await bo.screenshot({ path: '/tmp/doodle-done.png' });
  await click(host, 'Close');
  await click(host, 'See the last doodle'); await host.getByRole('button', { name: 'Save picture' }).waitFor({ timeout: 12000 });
  await click(host, 'Draw another');
  await bo.getByText('Starts in').waitFor({ timeout: 8000 });
}
await finish();
console.log('mini checks passed');
