// Plays a round in a headless phone-sized browser, using synthetic tilt events.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { tiltDetector } from '../public/game.js';

const d = tiltDetector();
assert.equal(d(0, -20), null, 'ignored until held upright once');
assert.equal(d(0, 90), null);
assert.equal(d(180, 30), 'got', 'face down');
assert.equal(d(180, 20), null, 'no double count');
d(0, 90);
assert.equal(d(0, 20), 'pass', 'face up');

const { chromium, devices } = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png' };
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  try { const body = await readFile(new URL('../public' + path, import.meta.url)); res.writeHead(200, { 'content-type': types[path.split('.').pop()] || 'application/json' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.clock.install();
await page.goto(`http://localhost:${server.address().port}/`);
await page.getByRole('button', { name: /Animals/ }).waitFor();
await page.screenshot({ path: '/tmp/home.png' });
await page.getByRole('button', { name: /Animals/ }).click();
await page.getByText('Place on forehead').waitFor();
await page.clock.runFor(3500);
const tilt = (beta, gamma) => page.evaluate(([beta, gamma]) => dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma })), [beta, gamma]);
await tilt(0, 90); await tilt(180, 20);
assert.equal(await page.textContent('#card'), 'Got it!');
await page.clock.runFor(800);
await page.screenshot({ path: '/tmp/play.png' });
await page.click('#pass'); await page.clock.runFor(800);
await page.clock.runFor(61000);
assert.equal(await page.textContent('#score'), '1 correct');
assert.equal(await page.locator('#recap li').count(), 3);
await page.screenshot({ path: '/tmp/results.png' });
assert.deepEqual(errors, []);
await browser.close(); server.close();
console.log('all checks passed');
