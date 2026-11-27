// Removing players, pokes, the scoreboard, pull to refresh and Quick Draw watching.
import assert from 'node:assert/strict';
import { sqlite } from '../harness.mjs';
import { base, phone, click, yes, scribble, finish } from './browser.mjs';

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
  await click(host, 'Remove Bo'); await host.waitForTimeout(700); // stays open while the screen updates
  await host.screenshot({ path: '/tmp/ask-remove.png' }); await yes(host);
  await bo.getByText('You are no longer in that room.').waitFor({ timeout: 8000 });
  await click(di, 'Leave party'); await yes(di); await di.getByPlaceholder('Room code').waitFor();
  await host.getByRole('button', { name: 'Remove Di' }).waitFor({ state: 'detached', timeout: 8000 });
  await cy.waitForTimeout(700);
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
// Pokes in the browser: the note arrives without wiping what the other person is typing.
{
  const phones = [await phone(), await phone(), await phone()];
  const [host, bo, cy] = phones;
  await host.goto(`${base}/play.html?game=majority`);
  await host.getByPlaceholder('Your name').fill('Ann'); await click(host, 'Create a room');
  const code = (await host.locator('.code').textContent()).trim();
  for (const [p, name] of [[bo, 'Bo'], [cy, 'Cy']]) { await p.goto(`${base}/play.html?game=majority&code=${code}`); await p.getByPlaceholder('Your name').fill(name); await click(p, 'Join room'); }
  await host.locator('#recap li').nth(2).waitFor({ timeout: 8000 });
  await click(host, 'Start: 5 questions');
  await bo.locator('input').fill('half typed');
  assert.equal(await bo.locator('.nudge:visible').count(), 0, 'no pestering before you finish');
  await host.locator('input').fill('cake'); await click(host, 'Send');
  await host.locator('.nudge').waitFor({ timeout: 8000 });
  await click(host, 'Bo'); await click(host, 'Write a note');
  const box = host.getByPlaceholder('Your note');
  await box.fill('Any day now, Bo');
  await cy.locator('input').fill('pie'); await click(cy, 'Send'); // the list changes while Ann types
  await host.locator('.nudge').getByRole('button', { name: 'Cy', exact: true }).waitFor({ state: 'detached', timeout: 8000 });
  assert.equal(await box.inputValue(), 'Any day now, Bo');
  assert.ok(await box.evaluate(n => n === document.activeElement), 'still typing');
  await host.screenshot({ path: '/tmp/nudge.png', fullPage: true });
  await click(host, 'Send note'); await host.getByText('Sent to Bo.').waitFor({ timeout: 8000 });
  await bo.locator('.popup').getByText('Any day now, Bo').waitFor({ timeout: 8000 });
  await bo.waitForTimeout(800); await bo.screenshot({ path: '/tmp/popup.png' });
  assert.equal(await bo.locator('input').inputValue(), 'half typed');
  await bo.locator('.popup').click(); assert.equal(await bo.locator('.popup').count(), 0);
  await click(cy, 'Poke'); await bo.getByText('Cy poked you!').waitFor({ timeout: 8000 });
  await bo.locator('input').fill('cake'); await click(bo, 'Send'); await host.locator('.answer.winner').waitFor({ timeout: 8000 });
  await bo.locator('.popup').waitFor({ state: 'detached', timeout: 8000 });
  await host.locator('.nudge').waitFor({ state: 'hidden' });
  for (const p of phones) await p.context().close();
  console.log('pokes: passed');
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
// A two-place podium puts the winner off to one side; its sunburst must not widen the page.
await solo.evaluate(async () => {
  const { podium } = await import('/ui.js');
  const board = podium([{ name: 'Ann', score: 1000 }, { name: 'Cy', score: 1000 }, { name: 'Bo', score: 500 }], Date.now() - 20000);
  board.id = 'tie'; document.querySelector('main').append(board);
});
await solo.waitForTimeout(300);
assert.equal(await solo.evaluate(() => { scrollTo(500, 0); return scrollX; }), 0, 'no sideways scrolling');
await solo.locator('#tie').evaluate(n => n.remove());
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
await finish();
