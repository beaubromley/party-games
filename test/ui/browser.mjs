// A local copy of the app and phone-sized browsers to play it on.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { handle } from '../../lib/rooms.js';
import * as rules from '../../lib/rules.js';
import { query, ask } from '../harness.mjs';

export const yes = p => p.locator('dialog.ask .yes').click();
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
  try { const b = await readFile(new URL('../../public' + path, import.meta.url)); res.writeHead(200, { 'content-type': types[path.split('.').pop()] || 'application/json' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
export const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(), errors = [];
// The app polls every 1.5s; tests don't need to wait that long.
const quicken = () => { const later = window.setTimeout; window.setTimeout = (fn, ms, ...rest) => later(fn, ms === 1500 ? 300 : ms, ...rest); };
export async function phone(options = {}) {
  const context = await browser.newContext({ ...devices['iPhone 13'], ...options });
  await context.addInitScript(quicken);
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  return p;
}
export async function screenPage(options) {
  const context = await browser.newContext(options);
  await context.addInitScript(quicken);
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  return p;
}
export const click = (p, name) => p.getByRole('button', { name, exact: true }).click({ timeout: 8000 });
export const scribble = async p => {
  const box = await p.locator('canvas.pad').boundingBox();
  await p.mouse.move(box.x + 40, box.y + 40); await p.mouse.down(); await p.mouse.move(box.x + 200, box.y + 180, { steps: 8 }); await p.mouse.up();
};

// Every browser test ends here: no page may have thrown.
export async function finish() {
  assert.deepEqual(errors, []);
  await browser.close(); server.close();
}
