// Runs one mini game on a canvas against the clock, and turns touches into the game's moves.
import { el } from './ui.js';
import { create, GAMES, WIDTH, HEIGHT, SECONDS } from './minigames.js';

export const seconds = () => window.miniSeconds ?? SECONDS; // tests shorten it

export function player({ id, seed, startAt, onEnd }) {
  const scale = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
  const canvas = el('canvas', { className: 'mini', width: WIDTH * scale, height: HEIGHT * scale, ariaLabel: GAMES[id].title });
  const score = el('b', {}, '0'), clock = el('b', {}, String(SECONDS));
  const node = el('div', { className: 'stage' }, el('p', { className: 'hud' }, el('span', {}, 'Score ', score), el('span', {}, GAMES[id].title), el('span', {}, 'Time ', clock)), canvas);
  const game = create(id, seed, Math.max(0, (Date.now() - startAt) / 1000));
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  let frame, done = false, from = null;
  const at = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * WIDTH, y: (e.clientY - r.top) / r.height * HEIGHT }; };
  canvas.onpointerdown = e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); from = at(e); if (!done) game.down?.(from.x, from.y); };
  canvas.onpointermove = e => { if (from && !done) { const p = at(e); game.move?.(p.x, p.y); } };
  canvas.onpointerup = e => { if (from && !done) { const p = at(e); game.up?.(p.x, p.y, from); } from = null; };
  canvas.onpointercancel = () => { from = null; };
  function tick() {
    const t = Math.max(0, (Date.now() - startAt) / 1000), length = seconds();
    game.advance(Math.min(t, length));
    c.fillStyle = '#1d2433'; c.fillRect(0, 0, WIDTH, HEIGHT);
    game.paint(c);
    score.textContent = game.score; clock.textContent = Math.max(0, Math.ceil(length - t));
    if (t >= length) { done = true; return onEnd(game.score); }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return { node, game, stop() { done = true; cancelAnimationFrame(frame); } };
}
