// Face-Off, Majority Rules and Telephone Doodle, full games.
import assert from 'node:assert/strict';
import { base, phone, click, yes, scribble, finish } from './browser.mjs';

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
    await p.locator('input').fill(text); await p.waitForTimeout(700); // survives a poll
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
        await p.waitForTimeout(700);
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
    const wide = await host.evaluate(() => { scrollTo(500, scrollY); const x = scrollX; scrollTo(0, scrollY); return x; });
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
    await click(guests[0], `Rejoin party ${code}`); await guests[0].getByRole('button', { name: 'Leave party' }).waitFor({ timeout: 8000 });
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
await finish();
