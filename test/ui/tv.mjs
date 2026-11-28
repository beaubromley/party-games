// The TV page through every kind of screen, in every game.
import assert from 'node:assert/strict';
import * as rules from '../../lib/rules.js';
import { sqlite, move, deals } from '../harness.mjs';
import { base, screenPage, click, finish } from './browser.mjs';

// The TV page through every kind of screen, in every game.
{
  const tv = await screenPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    await tv.goto(`${base}/tv.html`);
  await tv.getByPlaceholder('Room code').fill('QQQQ'); await click(tv, 'Show this party');
  await tv.getByText('No party has that code.').waitFor({ timeout: 8000 });
  const names = ['Ann', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou'];
  let seed = 11;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const more = { bluff: [{ question: 'Which planet is closest to the sun?', answer: 'Mercury' }, { question: 'What do bees make?', answer: 'Honey' }], doodle: names.map(n => `a ${n} sandwich`),
    faceoff: { sets: 1, prompts: names.map(n => `A bad name for ${n}'s boat`) }, majority: { prompts: ['Name a pizza topping'] }, telephone: {} };
  const line = [[0, 12, [100, 100, 800, 700, 200, 800]]];
  for (const game of rules.GAMES) {
    const n = game === 'telephone' ? 4 : 12;
    const r = rules.newRoom(game);
    names.slice(0, n).forEach((name, i) => rules.join(r, { id: 'p' + i, secret: 's', name }));
    const code = 'TV' + String(rules.GAMES.indexOf(game) + 10);
    let v = 0;
    const save = () => sqlite.prepare('INSERT OR REPLACE INTO rooms (code, version, state, updated) VALUES (?, ?, ?, ?)').run(code, ++v, JSON.stringify(r), Date.now());
    const seen = new Set();
    const look = async () => {
      const label = r.phase + (r.stage && game === 'survival' ? r.stage : game === 'snack' ? r.news?.stage ?? '' : '');
      if (seen.has(label)) return;
      seen.add(label); save();
      await tv.waitForTimeout(800); // a couple of polls
      const text = await tv.locator('main').textContent();
      assert.ok(!/undefined|NaN|\[object/.test(text), `${game} ${label}: ${text}`);
      const spill = await tv.evaluate(() => { const room = document.querySelector('.room').getBoundingClientRect(), fit = document.querySelector('.fit').getBoundingClientRect(); return [fit.bottom - room.bottom, fit.right - room.right]; });
      assert.ok(spill.every(x => x < 8), `${game} ${label} does not fit: ${spill}`);
      await tv.screenshot({ path: `/tmp/tv-${game}-${label}.png` });
    };
    save();
    if (await tv.getByRole('button', { name: 'Change room' }).count()) await click(tv, 'Change room');
    await tv.getByPlaceholder('Room code').fill(code.toLowerCase()); await click(tv, 'Show this party');
    await look();
    rules.start(r, deals[game]?.(n) ?? more[game]);
    for (let g = 0; ; g++) {
      assert.ok(g < 2000, game);
      await look();
      if (r.phase === 'done') break;
      const waiting = rules.waitingOn(r);
      if (!waiting.length) { rules.advance(r, random); continue; }
      // Leave the last person slow, so there is someone to pester on screen.
      if (r.phase === 'writing' && waiting.length === 1 && !r.pokes?.length) { rules.poke(r, r.players.find(p => !waiting.includes(p.id) && (game !== 'snack' || r.alive.includes(p.id)))?.id, waiting[0], game === 'snack' ? '' : 'Any day now!'); save(); await tv.getByText('Pokes and notes').waitFor({ timeout: 8000 }); assert.ok(await tv.evaluate(() => document.querySelector('.feed li').getBoundingClientRect().bottom <= document.querySelector('aside').getBoundingClientRect().bottom + 0.5), `${game}: pokes off screen`); await tv.screenshot({ path: `/tmp/tv-${game}-poke.png` }); }
      const id = waiting[0];
      move(r, id, random, line, ['Soda', 'a very silly answer that is quite long indeed ok', 'Tacos', 'Grandma'][g % 4] + (game === 'majority' ? '' : ' ' + g));
    }
    console.log(`tv: ${game} showed ${[...seen].join(', ')}`);
  }
  await tv.reload(); assert.equal(await tv.getByPlaceholder('Room code').inputValue(), 'TV20');
  await tv.context().close();
}
await finish();
