// Bluff and Doodle Bluff, full games.
import assert from 'node:assert/strict';
import { base, phone, click, scribble, finish } from './browser.mjs';

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
    for (const p of phones) await p.locator('#face').setInputFiles(new URL('../../public/apple-touch-icon.png', import.meta.url).pathname);
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
    await host.waitForTimeout(700);
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
      if (i === writers.length - 1) await p.waitForTimeout(700); // typed text must survive a poll
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
      await host.waitForTimeout(3000); await host.screenshot({ path: `/tmp/${game}-climbing.png`, fullPage: true });
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
  await host.waitForTimeout(700); // stays open while the screen updates
  assert.ok(await host.locator('.reel .answer').count() >= 3, 'one per round');
  await host.screenshot({ path: `/tmp/reel-${game}.png`, fullPage: true });
  // Choosing another game from the menu starts fresh instead of reopening this room.
  await guests[1].goto(`${base}/play.html?game=majority`); await guests[1].getByPlaceholder('Room code').waitFor();
  console.log(`${game}: full game passed on 3 browsers`);
}
await finish();
