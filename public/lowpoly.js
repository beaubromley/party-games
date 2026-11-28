// A small low-poly drawing kit: flat facets lit from the upper left, soft gradients and simple effects.
const LIGHT = [-0.55, -0.83];
const cache = new Map();

// Lighten (amount > 0) or darken a #rrggbb color.
export function shade(color, amount) {
  const key = color + amount.toFixed(2);
  let out = cache.get(key);
  if (!out) {
    const to = amount > 0 ? 255 : 0, a = Math.min(1, Math.abs(amount));
    out = `rgb(${[1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).map(v => Math.round(v + (to - v) * a)).join(',')})`;
    cache.set(key, out);
  }
  return out;
}
export function poly(c, color, points) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < points.length; i++) i ? c.lineTo(points[i][0], points[i][1]) : c.moveTo(points[i][0], points[i][1]);
  c.closePath(); c.fill();
  // A hairline of the same color hides the seams between neighbouring facets.
  c.strokeStyle = color; c.lineWidth = 0.6; c.lineJoin = 'round'; c.stroke();
}
// A faceted rounded body: triangles from a raised middle out to the rim, each lit by which way it faces.
export function gem(c, color, x, y, rx, ry = rx, { sides = 9, turn = 0.3, depth = 0.34 } = {}) {
  const rim = Array.from({ length: sides }, (_, i) => {
    const a = turn + i / sides * Math.PI * 2;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
  });
  const mid = [x + LIGHT[0] * rx * 0.28, y + LIGHT[1] * ry * 0.28];
  rim.forEach((p, i) => {
    const q = rim[(i + 1) % sides], a = turn + (i + 0.5) / sides * Math.PI * 2;
    poly(c, shade(color, (Math.cos(a) * LIGHT[0] + Math.sin(a) * LIGHT[1]) * depth), [mid, p, q]);
  });
}
// A block seen slightly from above and the right.
export function block(c, color, x, y, w, h, d = 10) {
  poly(c, shade(color, 0.24), [[x, y], [x + d, y - d * 0.7], [x + w + d, y - d * 0.7], [x + w, y]]);
  poly(c, shade(color, -0.28), [[x + w, y], [x + w + d, y - d * 0.7], [x + w + d, y + h - d * 0.7], [x + w, y + h]]);
  poly(c, color, [[x, y], [x + w, y], [x + w, y + h]]);
  poly(c, shade(color, 0.06), [[x, y], [x + w, y + h], [x, y + h]]);
}
// A tapered limb or post from one point to another, lit along one side.
export function beam(c, color, x1, y1, x2, y2, w1, w2 = w1) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }
  poly(c, shade(color, 0.14), [[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2, y2], [x1, y1]]);
  poly(c, shade(color, -0.18), [[x1, y1], [x2, y2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]]);
}
export function pine(c, x, y, s, color = '#3d7a55', snow = false) {
  beam(c, '#7a5236', x, y + 12 * s, x, y - 2 * s, 7 * s);
  for (let k = 0; k < 3; k++) {
    const base = y + 3 * s - k * 12 * s, w = (19 - k * 4) * s, top = base - 22 * s;
    poly(c, shade(color, 0.14 + k * 0.05), [[x, top], [x - w, base], [x + 1, base - 4 * s]]);
    poly(c, shade(color, -0.2 + k * 0.05), [[x, top], [x + 1, base - 4 * s], [x + w, base]]);
    if (snow) {
      poly(c, '#ffffff', [[x, top], [x - w * 0.42, top + 10 * s], [x - w * 0.1, top + 8 * s]]);
      poly(c, '#dbe8f2', [[x, top], [x - w * 0.1, top + 8 * s], [x + w * 0.38, top + 9 * s]]);
    }
  }
}
export function gradient(c, y1, y2, ...colors) {
  const g = c.createLinearGradient(0, y1, 0, y2);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
  return g;
}
export function sky(c, top, bottom, height = 520) { c.fillStyle = gradient(c, 0, height, top, bottom); c.fillRect(0, 0, 360, height); }
// A soft contact shadow.
export function shadow(c, x, y, rx, ry = rx * 0.25, strength = 0.2) {
  c.fillStyle = `rgba(20,24,40,${strength})`; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fill();
}
// A row of peaks that repeats as it scrolls.
export function ridge(c, color, base, height, scroll, span = 130, bottom = base) {
  const shift = ((scroll % (span * 4)) + span * 4) % (span * 4);
  for (let i = -1; i < 8; i++) {
    const x = i * span - shift, k = ((i % 4) + 4) % 4, h = height * [1, 0.62, 0.86, 0.5][k], peak = x + span * [0.5, 0.4, 0.62, 0.55][k];
    if (x > 360 || x + span * 1.5 < 0) continue;
    poly(c, shade(color, 0.1), [[x - span * 0.25, base], [peak, base - h], [peak + span * 0.08, base]]);
    poly(c, shade(color, -0.08), [[peak, base - h], [x + span * 1.25, base], [peak + span * 0.08, base]]);
  }
  if (bottom > base) { c.fillStyle = shade(color, -0.01); c.fillRect(0, base - 0.5, 360, bottom - base + 0.5); }
}
export function cloud(c, x, y, s) {
  poly(c, '#ffffff', [[x - 34 * s, y + 8 * s], [x - 22 * s, y - 5 * s], [x - 6 * s, y - 3 * s], [x + 4 * s, y - 15 * s], [x + 20 * s, y - 4 * s], [x + 36 * s, y + 8 * s]]);
  poly(c, '#dfeaf2', [[x - 34 * s, y + 8 * s], [x - 8 * s, y + 2 * s], [x + 36 * s, y + 8 * s]]);
}
export function star(c, color, x, y, r, turn = 0, points = 5) {
  poly(c, color, Array.from({ length: points * 2 }, (_, i) => {
    const a = turn - Math.PI / 2 + i * Math.PI / points, d = i % 2 ? r * 0.45 : r;
    return [x + Math.cos(a) * d, y + Math.sin(a) * d];
  }));
}
export function words(c, text, x, y, size = 22, color = '#1d2433', edge) {
  c.font = `800 ${size}px "Avenir Next", system-ui, sans-serif`; c.textAlign = 'center';
  if (edge) { c.strokeStyle = edge; c.lineWidth = size / 5; c.lineJoin = 'round'; c.strokeText(text, x, y); }
  c.fillStyle = color; c.fillText(text, x, y);
}
export const ease = u => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;
// Overshoots a little before settling, for things that pop up.
export const pop = u => { const v = Math.min(1, Math.max(0, u)) - 1; return 1 + 2.7 * v ** 3 + 1.7 * v ** 2; };

// Bits that fly about, messages and screen shake. All driven by the game's clock.
export function effects() {
  let bits = [], note = null, shaking = -1, power = 0;
  let spin = 7;
  const next = () => (spin = (spin * 16807) % 2147483647) / 2147483647;
  return {
    burst(t, x, y, colors, { n = 12, speed = 170, gravity = 420, size = 6, life = 0.7, up = 60 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = next() * Math.PI * 2, v = speed * (0.35 + next() * 0.65);
        bits.push({ t, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, gravity, size: size * (0.5 + next()), life: life * (0.6 + next() * 0.4), turn: next() * 6, color: colors[i % colors.length] });
      }
      if (bits.length > 160) bits = bits.slice(-160);
    },
    say(t, text, color) { note = { t, text, color }; },
    shake(t, strength = 6) { shaking = t; power = strength; },
    clear() { bits = []; note = null; shaking = -1; },
    // Offset the whole board while shaking.
    offset(t) { const left = 1 - (t - shaking) / 0.3; return shaking < 0 || left <= 0 || left > 1 ? [0, 0] : [Math.sin(t * 90) * power * left, Math.cos(t * 70) * power * left * 0.6]; },
    draw(c, t) {
      bits = bits.filter(b => t - b.t < b.life);
      for (const b of bits) {
        const s = Math.max(0, t - b.t), x = b.x + b.vx * s, y = b.y + b.vy * s + b.gravity * s * s / 2, r = b.size * (1 - s / b.life), a = b.turn + s * 8;
        c.globalAlpha = Math.min(1, 2 * (1 - s / b.life));
        poly(c, b.color, [0, 2.1, 4.2].map(k => [x + Math.cos(a + k) * r, y + Math.sin(a + k) * r]));
      }
      if (note && t - note.t < 0.85) {
        const s = t - note.t;
        c.globalAlpha = Math.min(1, (0.85 - s) / 0.25);
        words(c, note.text, 180, 82 - ease(s / 0.5) * 12, 20 + 12 * pop(s / 0.22), note.color, '#ffffff');
      }
      c.globalAlpha = 1;
    },
  };
}
