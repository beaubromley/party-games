// Drawings are lists of strokes: [colorIndex, width, [x0, y0, x1, y1, ...]] on a 1000x1000 grid.
import { el } from './ui.js';
export const COLORS = ['#111111', '#e5383b', '#2b5cff', '#14a44d', '#ffb703', '#8b5a2b', '#ffffff'];
export const MAX_POINTS = 6000;
// One for each person on a Group Doodle.
export const DOODLE_COLORS = ['#111111', '#e5383b', '#2b5cff', '#14a44d', '#f77f00', '#8e44ad', '#00a6a6', '#e0489b', '#8b5a2b', '#d4a300', '#6b7a8f', '#7cb518'];
const BRUSHES = [['Thin', 5, 30], ['Medium', 12, 60], ['Thick', 30, 80]]; // name, pen width, eraser width

export function paintStroke(ctx, [color, width, p], palette = COLORS) {
  ctx.strokeStyle = palette[color]; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  if (p.length === 2) ctx.lineTo(p[0] + 0.1, p[1]);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  ctx.stroke();
}
export function picture(strokes, palette) {
  const c = el('canvas', { width: 1000, height: 1000 });
  for (const s of strokes) paintStroke(c.getContext('2d'), s, palette);
  return c;
}
export function sketchpad({ slot = false } = {}) {
  const canvas = el('canvas', { width: 1000, height: 1000, className: 'pad' });
  const ctx = canvas.getContext('2d');
  let strokes = [], color = 0, brush = 1, live = null, points = 0;
  const redraw = () => { ctx.clearRect(0, 0, 1000, 1000); strokes.forEach(s => paintStroke(ctx, s)); points = strokes.reduce((n, s) => n + s[2].length / 2, 0); };
  const at = e => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top].map((v, i) => Math.max(0, Math.min(1000, Math.round(v / (i ? r.height : r.width) * 1000))));
  };
  canvas.onpointerdown = e => {
    if (live || points >= MAX_POINTS) return; // one finger at a time
    canvas.setPointerCapture(e.pointerId);
    live = { id: e.pointerId, stroke: [color, BRUSHES[brush][color === 6 ? 2 : 1], at(e)] };
    strokes.push(live.stroke); points++; paintStroke(ctx, live.stroke);
  };
  canvas.onpointermove = e => {
    if (live?.id !== e.pointerId || points >= MAX_POINTS) return;
    const p = live.stroke[2], [x, y] = at(e);
    if (Math.hypot(x - p.at(-2), y - p.at(-1)) < 5) return;
    paintStroke(ctx, [live.stroke[0], live.stroke[1], [p.at(-2), p.at(-1), x, y]]);
    p.push(x, y); points++;
  };
  canvas.onpointerup = canvas.onpointercancel = e => { if (live?.id === e.pointerId) live = null; };
  const tools = el('div', { className: 'tools' });
  const swatches = COLORS.map((c, i) => el('button', {
    type: 'button', className: 'swatch' + (i ? '' : ' on'), textContent: i === 6 ? 'Erase' : '', ariaLabel: i === 6 ? 'Eraser' : `Color ${i + 1}`,
    onclick: () => { color = i; swatches.forEach((s, j) => s.classList.toggle('on', i === j)); },
  }));
  swatches.forEach((s, i) => { s.style.background = COLORS[i]; });
  tools.append(...swatches,
    el('button', { type: 'button', onclick: () => { strokes.pop(); live = null; redraw(); } }, 'Undo'),
    el('button', { type: 'button', onclick: () => { strokes = []; live = null; redraw(); } }, 'Clear'));
  const brushes = el('div', { className: 'tools brushes', role: 'group', ariaLabel: 'Brush size' });
  brushes.append(...BRUSHES.map(([name], i) => el('button', { type: 'button', className: i === brush ? 'on' : '', ariaPressed: i === brush,
    onclick: () => { brush = i; [...brushes.children].forEach((b, j) => { b.classList.toggle('on', i === j); b.ariaPressed = i === j; }); } },
    el('i', { className: `dot dot${i}` }), name)));
  // `slot` keeps space free for pop-ups, so they never land on the picture.
  return { nodes: [slot && el('div', { className: 'pokeslot' }), canvas, brushes, tools].filter(Boolean), strokes: () => strokes };
}
