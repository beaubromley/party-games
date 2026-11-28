// Ten 30-second games. Each is plain logic plus a drawing, on a 360 by 520 board.
// The course comes from a shared seed and the clock, so everyone playing a round gets the same one.
import { shade, poly, gem, block, beam, pine, gradient, sky, shadow, ridge, cloud, star, words, ease, pop, effects } from './lowpoly.js';
export const WIDTH = 360, HEIGHT = 520, SECONDS = 30;
const GOOD = '#1f7a4a', BAD = '#c43d2b', GREAT = '#1f5f9e';

export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hard = t => Math.min(1, Math.max(0, t / SECONDS)); // 0 at the start, 1 at the end
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const lerp = (a, b, u) => a + (b - a) * u;
const wrap = (v, size) => ((v % size) + size) % size;

// Shared bits: the score never drops below zero, and a short message says what just happened.
function base(extra) {
  return {
    score: 0, now: 0, fx: effects(),
    gain(points, text, color) { this.score = Math.max(0, this.score + points); if (text) this.fx.say(this.now, text, color ?? (points < 0 ? BAD : GOOD)); },
    ...extra,
  };
}

// Big, dark and heading left, wings beating.
function buzzard(c, x, y, beat) {
  const wing = Math.sin(beat);
  poly(c, '#4a3550', [[x - 2, y], [x + 8, y - 2 - wing * 22], [x + 24, y - 6 - wing * 16], [x + 14, y + 3]]);
  gem(c, '#5d4366', x, y + 2, 17, 10);
  poly(c, '#3d2c45', [[x + 12, y], [x + 28, y - 3], [x + 26, y + 8]]);
  gem(c, '#e8a090', x - 15, y - 3, 7, 7, { sides: 7 });
  poly(c, '#f2b23e', [[x - 20, y - 5], [x - 31, y + 1], [x - 19, y + 1]]);
  gem(c, '#1d2433', x - 17, y - 5, 1.8, 1.8, { sides: 6, depth: 0 });
  poly(c, '#6f5379', [[x - 6, y + 1], [x + 4, y - wing * 20], [x + 16, y - 3 - wing * 12], [x + 10, y + 5]]);
}
function cactus(rand) {
  const START = 255, GROW = 300 / SECONDS, GROUND = 400, X = 70, AIR = 0.69;
  const distance = t => START * t + GROW * t * t / 2;
  const speedAt = d => Math.sqrt(START ** 2 + 2 * GROW * d);
  const course = [];
  for (let d = 400; d < distance(SECONDS) + 500;) {
    const p = Math.min(1, d / distance(SECONDS)), speed = speedAt(d), last = course.at(-1);
    // A swooping buzzard: keep your feet on the ground until it has gone over.
    if (p > 0.15 && !last?.fly && rand() < 0.22) {
      course.push({ d: d + 0.1 * speed, w: 34, fly: true });
      d += 0.1 * speed + 34 + 0.5 * speed;
      continue;
    }
    const roll = rand(), count = roll < 0.28 * p ? 3 : roll < 0.2 + 0.5 * p ? 2 : 1;
    const w = count * 18, h = 30 + Math.floor(rand() * (14 + 10 * p));
    course.push({ d, w, h });
    d += w + AIR * speed * (1.08 - 0.08 * p + rand() * 0.5) + 14;
  }
  return base({
    course, hits: 0, y: 0, v: 0, wanted: -1, d: 0, landed: -1,
    update(dt, t) {
      this.now = t; this.d = distance(t);
      if (this.y === 0 && t - this.wanted < 0.12) { this.v = 620; this.wanted = -1; }
      if (this.v || this.y) { this.y += this.v * dt; this.v -= 1800 * dt; if (this.y <= 0) { this.y = this.v = 0; this.landed = t; this.fx.burst(t, X - 4, GROUND, ['#e9c98d', '#d9b070'], { n: 8, speed: 90, up: 30, life: 0.4 }); } }
      for (const o of course) {
        if (o.done) continue;
        const x = X + o.d - this.d;
        if (x > X + 14) break;
        const into = o.fly ? this.y > 22 : this.y < o.h - 3;
        if (x + o.w > X - 12 && into) { o.done = true; this.hits++; this.gain(-15, o.fly ? 'Stay down!' : 'Ouch!'); this.fx.shake(t); this.fx.burst(t, X, GROUND - this.y - 20, ['#2f7d5b', '#3f9a72', '#ffffff']); }
        else if (x + o.w < X - 12) { o.done = true; this.gain(10, '+10'); }
      }
    },
    down() { this.wanted = this.now; },
    draw(c) {
      sky(c, '#8fcbe8', '#fde7c4', GROUND);
      for (const [r, a] of [[62, 0.12], [48, 0.2]]) { c.fillStyle = `rgba(255,222,140,${a})`; c.beginPath(); c.arc(292, 82, r, 0, 7); c.fill(); }
      gem(c, '#ffd77a', 292, 82, 32, 32, { sides: 14, depth: 0.1 });
      for (let i = 0; i < 3; i++) cloud(c, wrap(i * 190 - this.d * 0.06, 520) - 70, 70 + i * 42, 1 - i * 0.18);
      ridge(c, '#d99a86', GROUND - 46, 120, this.d * 0.08, 150, GROUND);
      ridge(c, '#c9785a', GROUND - 14, 76, this.d * 0.2, 112, GROUND);
      for (let i = 0; i < 4; i++) {
        const x = wrap(i * 137 - this.d * 0.45, 548) - 60, h = 24 + (i % 3) * 7, color = '#8a8f66';
        beam(c, color, x, GROUND + 1, x, GROUND - h, 6, 5); beam(c, color, x, GROUND - h * 0.5, x + 8, GROUND - h * 0.55, 3); beam(c, color, x + 8, GROUND - h * 0.52, x + 8, GROUND - h * 0.82, 3);
      }
      c.fillStyle = gradient(c, GROUND, HEIGHT, '#efc77f', '#c98f52'); c.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
      c.fillStyle = '#f7dba2'; c.fillRect(0, GROUND, WIDTH, 5);
      for (let i = 0; i < 11; i++) {
        const x = wrap(i * 41 - this.d, 451) - 40, y = GROUND + 18 + (i * 37) % 90;
        poly(c, '#d9a561', [[x, y], [x + 11 + i % 4 * 3, y - 5], [x + 24 + i % 3 * 4, y + 1]]);
        poly(c, '#b87d45', [[x, y], [x + 24 + i % 3 * 4, y + 1], [x + 12, y + 4]]);
      }
      for (const o of course) {
        const x = X + o.d - this.d;
        if (x < -60 || x > WIDTH + 20) continue;
        if (o.fly) { buzzard(c, x + o.w / 2, GROUND - 76 + Math.sin(this.now * 7 + o.d) * 3, this.now * 11 + o.d); shadow(c, x + o.w / 2, GROUND + 3, 18, 4, 0.12); continue; }
        for (let k = 0; k < o.w; k += 18) {
          const mid = x + k + 9, h = o.h - (k ? 6 : 0), green = '#3c9468';
          c.save(); c.translate(mid, GROUND); c.scale(1.34, 1.14); c.translate(-mid, -GROUND);
          shadow(c, mid + 5, GROUND + 3, 15);
          beam(c, green, mid, GROUND + 2, mid, GROUND - h + 6, 12, 11); gem(c, green, mid, GROUND - h + 6, 5.6, 6, { sides: 7 });
          beam(c, green, mid - 4, GROUND - h * 0.5, mid - 11, GROUND - h * 0.55, 5); beam(c, green, mid - 11, GROUND - h * 0.52, mid - 11, GROUND - h * 0.8, 5.5, 4.5);
          beam(c, green, mid + 4, GROUND - h * 0.36, mid + 11, GROUND - h * 0.4, 5); beam(c, green, mid + 11, GROUND - h * 0.38, mid + 11, GROUND - h * 0.66, 5.5, 4.5);
          beam(c, '#58b083', mid - 2.5, GROUND - 3, mid - 2.5, GROUND - h + 9, 1.6);
          if (k === 0) star(c, '#f2708f', mid + 1, GROUND - h, 5, 0.4);
          c.restore();
        }
      }
      // A long-legged desert bird, with a little squash as it lands.
      const feet = GROUND - this.y, running = !this.y, phase = this.d / 15;
      const squash = running ? Math.max(0, 1 - (this.now - this.landed) / 0.16) : 0;
      const tilt = clamp(-this.v / 2600, -0.22, 0.22), bob = running ? Math.abs(Math.sin(phase)) * 2.5 - squash * 4 : 0;
      shadow(c, X, GROUND + 3, 28 - Math.min(16, this.y / 8));
      c.save(); c.translate(X, feet); c.scale(1.22, 1.22); c.translate(-X, -feet);
      for (const side of [0, Math.PI]) {
        const swing = running ? Math.sin(phase + side) : 0.5 - side / 5, lift = running ? Math.max(0, Math.cos(phase + side)) * 6 : 7;
        const fx = X + swing * 11, fy = feet - lift, kx = X + swing * 4 - 5, ky = feet - 11 - lift / 2;
        beam(c, '#e59b3a', X - 1, feet - 22, kx, ky, 4.5, 3.5); beam(c, '#e59b3a', kx, ky, fx, fy, 3.5, 3); beam(c, '#e59b3a', fx - 1, fy - 1, fx + 8, fy - 1, 3, 1.5);
      }
      c.save(); c.translate(X, feet - 28 - bob); c.rotate(tilt); c.scale(1 + squash * 0.1, 1 - squash * 0.14);
      for (let i = 0; i < 3; i++) poly(c, shade('#2f6f9f', i * 0.14 - 0.1), [[-10, -2 + i * 3], [-34 + i * 3, -20 + i * 11], [-8, 7]]);
      gem(c, '#3b86b8', -1, 0, 18, 13); gem(c, '#2f6f9f', -4, this.y ? -3 : 1, 10, 6.5, { sides: 6, turn: 0.1 });
      beam(c, '#3b86b8', 8, -2, 15, -16, 10, 8); gem(c, '#3b86b8', 16, -18, 10, 9.5);
      poly(c, '#f2b23e', [[23, -21], [38, -16.5], [23, -16]]); poly(c, '#d38a24', [[23, -16], [38, -16.5], [23, -12]]);
      poly(c, '#e8604c', [[12, -26], [10, -36], [17, -28], [20, -35], [21, -26]]);
      gem(c, '#ffffff', 19, -20, 3.8, 3.8, { sides: 10, depth: 0.05 }); gem(c, '#1d2433', 20.2, -20, 2, 2, { sides: 8, depth: 0 });
      c.restore(); c.restore();
    },
  });
}

function ski(rand) {
  const START = 170, GROW = 230 / SECONDS, Y = 140;
  const distance = t => START * t + GROW * t * t / 2, total = distance(SECONDS);
  const trees = [];
  let rows = 0;
  for (let y = 360; y < total + 600;) {
    const p = Math.min(1, y / total);
    // Every other tree stands in one of the lanes in turn, so there is nowhere to just sit.
    const lane = trees.length % 2 ? [180, 70, 290, 180, 125, 235][rows++ % 6] + rand() * 24 - 12 : 0;
    const x = lane || 18 + rand() * (WIDTH - 36);
    trees.push({ x, y });
    if (rand() < p * 0.7) trees.push({ x: (x + 100 + rand() * 150) % (WIDTH - 36) + 18, y: y + 12 });
    y += 88 - 44 * p + rand() * 28;
  }
  return base({
    trees, x: WIDTH / 2, target: WIDTH / 2, stunned: 0, d: 0, bank: 0, lean: 0, trail: [], clean: 0, times: 1,
    update(dt, t) {
      this.now = t;
      const moved = distance(t) - this.d; this.d += moved;
      const step = (230 + 150 * hard(t)) * dt;
      const slid = clamp(this.target - this.x, -step, step); this.x += slid;
      this.lean += (clamp(slid / dt / 260, -1, 1) - this.lean) * Math.min(1, dt * 12);
      if (!this.trail.length || this.d - this.trail.at(-1).d > 6) { this.trail.push({ x: this.x, d: this.d }); if (this.trail.length > 40) this.trail.shift(); }
      // A clean run pays more: double after five seconds, triple after ten.
      const times = 1 + Math.min(2, Math.floor((t - this.clean) / 5));
      if (times > this.times) this.fx.say(t, `Clean run x${times}`, GREAT);
      this.times = times;
      if (t >= this.stunned) { this.bank += moved / 40 * times; if (this.bank >= 1) { this.score += Math.floor(this.bank); this.bank %= 1; } }
      for (const tree of trees) {
        const dy = tree.y - this.d;
        if (!tree.hit && Math.abs(dy) < 18 && Math.abs(tree.x - this.x) < 20 && t >= this.stunned) { tree.hit = true; this.stunned = t + 1; this.clean = t + 1; this.times = 1; this.gain(-15, 'Tree!'); this.fx.shake(t, 8); this.fx.burst(t, tree.x, Y, ['#ffffff', '#cfe3f2', '#3d7a55'], { n: 18 }); }
      }
    },
    down(x) { this.target = x; }, move(x) { this.target = x; },
    draw(c) {
      c.fillStyle = gradient(c, 0, HEIGHT, '#eaf3fb', '#cfe0ef'); c.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 0; i < 5; i++) { const y = wrap(i * 190 - this.d * 0.9, 950) - 280; c.globalAlpha = 0.5; poly(c, i % 2 ? '#ffffff' : '#dceaf6', [[-20, y + 40], [380, y - 50], [380, y + 40], [-20, y + 150]]); c.globalAlpha = 1; }
      // Gentle rolls in the snow.
      for (let i = 0; i < 9; i++) {
        const x = (i * 131) % WIDTH, y = wrap(i * 119 - this.d, HEIGHT + 120) - 60, w = 55 + (i * 29) % 50;
        poly(c, '#c2d8eb', [[x - w, y], [x, y - 9], [x + w, y + 4]]); poly(c, '#ffffff', [[x - w, y], [x + w, y + 4], [x + 8, y + 12]]);
      }
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const side of [-7, 7]) {
        c.strokeStyle = 'rgba(120,160,195,.35)'; c.lineWidth = 3; c.beginPath();
        this.trail.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p.x + side, Y + 18 + p.d - this.d));
        c.lineTo(this.x + side, Y + 18); c.stroke();
      }
      for (let i = 0; i < 30; i++) { const y = wrap(i * 47 - this.d * 1.4, 705) - 90, x = wrap(i * 131, WIDTH); star(c, '#ffffff', x, y, 2.2, i + this.now * 2, 4); }
      const upright = tree => { const y = Y + tree.y - this.d; if (y > -60 && y < HEIGHT + 40) { shadow(c, tree.x + 9, y + 13, 21, 6, 0.14); pine(c, tree.x, y, 1.25, '#37765c', true); } };
      trees.filter(tr => tr.y - this.d < 6).forEach(upright);
      if (!(this.now < this.stunned && Math.floor(this.now * 12) % 2)) {
        const lean = this.lean, x = this.x;
        shadow(c, x + 7, Y + 18, 17, 5);
        if (Math.abs(lean) > 0.25) for (let i = 0; i < 6; i++) {
          const s = (this.now * 3.5 + i / 6) % 1, sx = x - lean * (14 + s * 26), sy = Y + 16 - s * 18 + (i % 3) * 4;
          c.globalAlpha = (1 - s) * Math.min(1, Math.abs(lean)); gem(c, '#cfe3f2', sx, sy, 2 + s * 4, 2 + s * 4, { sides: 6 }); c.globalAlpha = 1;
        }
        c.save(); c.translate(x, Y); c.rotate(-lean * 0.28); c.scale(1.28, 1.28);
        for (const side of [-8, 8]) { beam(c, '#2b3550', side, -14, side, 22, 5, 4); poly(c, '#2b3550', [[side - 2.5, 22], [side + 2.5, 22], [side, 29]]); }
        beam(c, '#364268', -7, 12, -4, 0, 7); beam(c, '#364268', 7, 12, 4, 0, 7);
        beam(c, '#6b7487', -10, -6, -21, 12, 2.2); beam(c, '#6b7487', 10, -6, 21, 12, 2.2);
        gem(c, '#e4572e', 0, -3, 12, 13, { sides: 8 });
        beam(c, '#e4572e', -8, -8, -14, 1, 6, 5); beam(c, '#e4572e', 8, -8, 14, 1, 6, 5);
        gem(c, '#f0c19c', 0, -18, 7.5); gem(c, '#f2b134', 0, -22, 8.5, 6.5, { sides: 8 }); gem(c, '#ffffff', 0, -29, 3, 3);
        poly(c, '#2b3550', [[-7, -19], [7, -19], [5, -15.5], [-5, -15.5]]);
        c.restore();
      }
      trees.filter(tr => tr.y - this.d >= 6).forEach(upright);
    },
  });
}

function turkey(rand) {
  const START = 125, GROW = 115 / SECONDS, X = 90;
  const distance = t => START * t + GROW * t * t / 2, total = distance(SECONDS);
  const gates = [];
  for (let d = 340, mid = 260; d < total + 500;) {
    const p = Math.min(1, d / total);
    mid = clamp(mid + (rand() * 2 - 1) * (90 + 50 * p), 130, 390);
    gates.push({ d, mid, gap: 170 - 55 * p });
    d += 215 - 35 * p + rand() * 25;
  }
  return base({
    gates, y: 250, v: 0, d: 0, safe: 0, flapped: -1,
    update(dt, t) {
      this.now = t; this.d = distance(t);
      this.v += 900 * dt; this.y += this.v * dt;
      if (this.y > HEIGHT - 40) { this.y = HEIGHT - 40; this.v = -300; this.gain(-3, 'Bonk!'); this.fx.burst(t, X, this.y + 10, ['#8fbf5a', '#6e9e45'], { n: 8 }); }
      if (this.y < 14) { this.y = 14; this.v = 0; }
      for (const g of gates) {
        if (g.done) continue;
        const x = X + g.d - this.d;
        if (x > X + 14) break;
        if (x + 46 < X - 12) { g.done = true; if (!g.hit) this.gain(10, '+10'); }
        else if (!g.hit && t >= this.safe && Math.abs(this.y - g.mid) > g.gap / 2 - 12) { g.hit = true; this.safe = t + 0.8; this.gain(-5, 'Ouch!'); this.fx.shake(t); this.fx.burst(t, X, this.y, ['#a8673a', '#e0763a', '#f2c14e'], { n: 16, gravity: 200 }); }
      }
    },
    down() { this.v = -300; this.flapped = this.now; this.fx.burst(this.now, X - 18, this.y + 6, ['#a8673a', '#e0a050'], { n: 3, speed: 60, up: 0, gravity: 160, size: 4, life: 0.5 }); },
    draw(c) {
      sky(c, '#7fbfe6', '#ffe9c2');
      for (let i = 0; i < 3; i++) cloud(c, wrap(i * 180 - this.d * 0.08, 520) - 70, 74 + i * 55, 0.95 - i * 0.14);
      ridge(c, '#b9a7c4', HEIGHT - 90, 130, this.d * 0.1, 150, HEIGHT);
      ridge(c, '#c98a55', HEIGHT - 50, 82, this.d * 0.25, 100, HEIGHT);
      for (let i = 0; i < 7; i++) pine(c, wrap(i * 67 - this.d * 0.45, 469) - 40, HEIGHT - 34 - (i % 3) * 6, 0.9, i % 2 ? '#c4682f' : '#d99a2b');
      for (const g of gates) {
        const x = X + g.d - this.d;
        if (x < -70 || x > WIDTH + 20) continue;
        const color = g.hit ? '#c25a45' : '#a86f45', floor = HEIGHT - 20;
        for (const [top, bottom, cap] of [[-10, g.mid - g.gap / 2, g.mid - g.gap / 2 - 18], [g.mid + g.gap / 2, floor, g.mid + g.gap / 2]]) {
          // A stout log: three lit faces and a cap at the mouth of the gap.
          poly(c, shade(color, 0.18), [[x + 2, top], [x + 15, top], [x + 15, bottom], [x + 2, bottom]]);
          poly(c, color, [[x + 15, top], [x + 32, top], [x + 32, bottom], [x + 15, bottom]]);
          poly(c, shade(color, -0.22), [[x + 32, top], [x + 44, top], [x + 44, bottom], [x + 32, bottom]]);
          for (let y = top + 24; y < bottom - 20; y += 38) poly(c, shade(color, -0.34), [[x + 17, y], [x + 22, y + 13], [x + 18, y + 22]]);
          block(c, g.hit ? '#d8745e' : '#c18a58', x - 4, cap, 50, 18, 6);
        }
      }
      c.fillStyle = gradient(c, HEIGHT - 22, HEIGHT, '#8fbf5a', '#5f8f3c'); c.fillRect(0, HEIGHT - 22, WIDTH, 22);
      for (let i = 0; i < 14; i++) { const x = wrap(i * 30 - this.d, 420) - 30; poly(c, '#a8d472', [[x, HEIGHT - 22], [x + 15, HEIGHT - 22], [x + 6, HEIGHT - 14]]); }
      if (this.now < this.safe && Math.floor(this.now * 12) % 2) return;
      const flap = this.now - this.flapped, wing = flap < 0.24 ? Math.sin(flap / 0.24 * Math.PI * 2) : Math.sin(this.now * 7) * 0.2;
      c.save(); c.translate(X, this.y); c.rotate(clamp(this.v / 1100, -0.35, 0.45)); c.scale(1.12, 1.12);
      ['#b8442f', '#e0763a', '#f2c14e', '#e0763a', '#b8442f'].forEach((color, i) => {
        const a = Math.PI + (i - 2) * 0.42;
        poly(c, color, [[-6, -2], [-6 + Math.cos(a - 0.2) * 27, -2 + Math.sin(a - 0.2) * 27], [-6 + Math.cos(a) * 32, -2 + Math.sin(a) * 32], [-6 + Math.cos(a + 0.2) * 27, -2 + Math.sin(a + 0.2) * 27]]);
      });
      beam(c, '#e59b3a', -2, 11, -5, 19, 3); beam(c, '#e59b3a', 5, 11, 4, 19, 3);
      gem(c, '#8f5a38', 0, 0, 17, 14);
      beam(c, '#8f5a38', 8, -3, 13, -12, 10, 8); gem(c, '#a8704a', 14, -15, 9, 9);
      poly(c, '#f2b23e', [[20, -18], [31, -13.5], [20, -13]]); poly(c, '#d38a24', [[20, -13], [31, -13.5], [20, -9.5]]);
      gem(c, '#d6453a', 20, -7, 3.2, 5.5, { sides: 6 });
      gem(c, '#ffffff', 16.5, -17.5, 3.6, 3.6, { sides: 10, depth: 0.05 }); gem(c, '#1d2433', 17.6, -17.5, 1.9, 1.9, { sides: 8, depth: 0 });
      poly(c, '#6f4229', [[4, -3], [-12, -3 - wing * 17], [-15, 6 - wing * 11], [-2, 8]]); poly(c, '#7d4c30', [[4, -3], [-2, 8], [8, 4]]);
      c.restore();
    },
  });
}

function hoops() {
  const BX = 180, BY = 455, HY = 140, FLIGHT = 0.7;
  const hoopX = t => BX + Math.min(1, Math.max(0, t - 3) / 8) * lerp(70, 130, hard(t)) * Math.sin(0.9 * t + 1.1 * t * t / SECONDS);
  return base({
    hoopX, shot: null,
    update(dt, t) {
      this.now = t;
      const s = this.shot;
      if (s && !s.done && t >= s.at + FLIGHT) {
        s.done = true;
        const off = Math.abs(s.to - hoopX(t)), room = 32 - 10 * hard(t);
        if (off < room * 0.45) { this.gain(15, 'Swish!'); s.in = true; this.fx.burst(t, s.to, HY + 18, ['#ffffff', '#ffd45c', '#ff8a3c'], { n: 18 }); }
        else if (off < room) { this.gain(10, 'Bucket!'); s.in = true; this.fx.burst(t, s.to, HY + 12, ['#ffffff', '#ff8a3c'], { n: 8 }); }
        else { this.gain(0, off < room + 14 ? 'Rimmed out' : 'Miss', BAD); if (off < room + 14) { this.fx.shake(t, 3); this.fx.burst(t, s.to, HY, ['#ff8a3c', '#ffd45c'], { n: 6 }); } }
      }
      if (s && t >= s.at + FLIGHT + 0.2) this.shot = null;
    },
    up(x, y, from) {
      if (this.shot) return;
      const flick = from.y - y > 25;
      this.shot = { at: this.now, to: flick ? clamp(BX + (x - from.x) / (from.y - y) * (BY - HY), 0, WIDTH) : x };
    },
    draw(c) {
      const hx = hoopX(this.now), s = this.shot;
      c.fillStyle = gradient(c, 0, 360, '#2c3e63', '#51698f'); c.fillRect(0, 0, WIDTH, 360);
      for (let i = 0; i < 8; i++) poly(c, i % 2 ? '#3b5078' : '#344870', [[i * 52 - 30, 0], [i * 52 + 26, 0], [i * 52 - 4, 356]]);
      for (const x of [40, 320]) { c.globalAlpha = 0.1; poly(c, '#fff6cf', [[x - 8, 0], [x + 8, 0], [x + 70, 356], [x - 70, 356]]); c.globalAlpha = 1; gem(c, '#fff1b8', x, 8, 14, 9, { sides: 8, depth: 0.1 }); }
      // Bleachers.
      for (let row = 0; row < 4; row++) {
        const top = 258 + row * 24, cheer = s?.in && s.done;
        block(c, ['#2a3a5c', '#2e4064', '#32466c', '#364b73'][row], -10, top + 8, 374, 18, 6);
        for (let i = 0; i < 19; i++) {
          const x = i * 20 + (row % 2) * 10, y = top - (cheer ? Math.abs(Math.sin(this.now * 15 + i * 1.3 + row)) * 7 : Math.sin(this.now * 2 + i * 2.1 + row) * 0.8);
          const color = ['#c25a48', '#d6a944', '#c9d2e0', '#5a97bd', '#8a73b0'][(i * 7 + row * 3) % 5];
          gem(c, color, x, y + 7, 7, 8, { sides: 6, depth: 0.22 }); gem(c, ['#e8b58e', '#c98d66', '#8f5f44'][(i + row) % 3], x, y - 3, 4.5, 5, { sides: 7, depth: 0.2 });
        }
      }
      c.fillStyle = 'rgba(30,44,72,.42)'; c.fillRect(0, 240, WIDTH, 116);
      // Wooden floor in perspective.
      const planks = ['#d89b5c', '#cf9153', '#e0a666', '#c9894d'];
      for (let i = -5; i < 6; i++) poly(c, planks[(i + 8) % 4], [[180 + i * 34, 356], [180 + (i + 1) * 34, 356], [180 + (i + 1) * 104, HEIGHT], [180 + i * 104, HEIGHT]]);
      c.fillStyle = '#b97c46'; c.fillRect(0, 352, WIDTH, 6);
      c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 3; c.beginPath(); c.ellipse(180, 430, 120, 38, 0, Math.PI, 0); c.stroke();
      // Stand, backboard, rim.
      shadow(c, hx, 362, 44, 9);
      beam(c, '#8b95a8', hx, 360, hx, HY - 8, 13, 9); block(c, '#5b6579', hx - 24, 352, 48, 11, 7);
      block(c, '#eef3f8', hx - 52, HY - 72, 104, 66, 7);
      c.strokeStyle = '#d9482f'; c.lineWidth = 3; c.strokeRect(hx - 20, HY - 40, 40, 30);
      const since = s?.in && s.done ? this.now - s.at - FLIGHT : 1, ripple = since < 0.35 ? Math.sin(since / 0.35 * Math.PI) * 9 : 0;
      c.strokeStyle = '#c4402c'; c.lineWidth = 4; c.beginPath(); c.ellipse(hx, HY, 28, 7, 0, Math.PI, 0); c.stroke();
      let x = BX, y = BY, r = 23, spin = Math.sin(this.now * 2) * 0.06;
      if (s) {
        const u = Math.min(1, (this.now - s.at) / FLIGHT);
        x = lerp(BX, s.to, u); y = lerp(BY, HY, u) - Math.sin(Math.PI * u) * 90; r = lerp(23, 14, u); spin = u * 9;
        if (s.done) { const k = this.now - s.at - FLIGHT; y = HY + k * 200 + k * k * 500; if (!s.in) x += (s.to - hx >= 0 ? 1 : -1) * k * 260; }
      }
      const ball = () => {
        c.save(); c.translate(x, y); gem(c, '#e8742c', 0, 0, r, r, { sides: 14, depth: 0.3 }); c.rotate(spin);
        c.strokeStyle = '#6b2f12'; c.lineWidth = r / 12; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke();
        for (const k of [-1, 1]) { c.beginPath(); c.ellipse(k * r * 1.2, 0, r * 0.75, r * 0.82, 0, k > 0 ? 2.2 : -0.95, k > 0 ? 4.1 : 0.95); c.stroke(); }
        c.restore();
      };
      const through = s?.done && s.in;
      if (!s) shadow(c, BX, BY + 27, 24, 6, 0.25); else if (!s.done) shadow(c, x, lerp(BY + 27, 366, Math.min(1, (this.now - s.at) / FLIGHT)), r, r / 4);
      if (through) ball();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; c.beginPath();
      for (let i = -3; i <= 3; i++) { c.moveTo(hx + i * 9, HY + 5); c.lineTo(hx + i * 5.5, HY + 32 + ripple); }
      for (const [k, w] of [[14, 23], [24, 19], [32, 16]]) { c.moveTo(hx - w, HY + k + ripple * k / 32); c.lineTo(hx + w, HY + k + ripple * k / 32); }
      c.stroke();
      c.strokeStyle = '#f05a35'; c.lineWidth = 5; c.beginPath(); c.ellipse(hx, HY, 28, 7, 0, 0, Math.PI); c.stroke();
      if (!through) ball();
      if (!s) words(c, 'Flick up toward the hoop', BX, 508, 15, '#ffffff', '#8a5a2e');
    },
  });
}

function stack() {
  const H = 24, FIRST = 180;
  const COLORS = ['#e4572e', '#f29e38', '#f2c94c', '#6bb26a', '#3fa7a3', '#4a82c4', '#7a6ac0', '#c4609a'];
  const swing = t => { const turns = 0.45 * t + 0.5 * t * t / SECONDS, u = turns % 1; return u < 0.5 ? u * 4 - 1 : 3 - u * 4; };
  return base({
    tower: [{ x: 180, w: FIRST }], w: FIRST, ready: 0, x: 0, cuts: [], lift: 0, landed: -1,
    screenY(level) { return 470 - level * H + this.lift; },
    position(t) { return 180 + (180 - this.w / 2) * swing(t); },
    update(dt, t) {
      this.now = t; this.x = this.position(t);
      this.lift += (Math.max(0, this.tower.length - 11) * H - this.lift) * Math.min(1, dt * 8); // the view climbs smoothly
      if (this.cuts.length && t - this.cuts[0].t > 1.2) this.cuts.shift();
    },
    down() {
      if (this.now < this.ready) return;
      const top = this.tower.at(-1), x = this.position(this.now), left = Math.max(x - this.w / 2, top.x - top.w / 2), right = Math.min(x + this.w / 2, top.x + top.w / 2);
      this.ready = this.now + 0.18;
      const level = this.tower.length, color = level % COLORS.length;
      // Starting over costs points, whether the block missed or the tower got too thin to build on.
      const restart = why => { this.gain(-10, `${why} -10`); this.fx.shake(this.now); this.w = 120; this.tower.push({ x: 180, w: 120, fresh: true }); this.landed = this.now; };
      if (right - left <= 0) { this.cuts.push({ t: this.now, x, w: this.w, level, color }); return restart('Missed!'); }
      if (Math.abs(x - top.x) < 7) { this.tower.push({ x: top.x, w: this.w }); this.landed = this.now; this.gain(15, 'Perfect! +15', GREAT); this.fx.burst(this.now, top.x, this.screenY(level) + H / 2, ['#ffffff', '#ffe27a'], { n: 18, speed: 230, up: 20 }); return; }
      // The overhanging piece breaks off and falls.
      const over = this.w - (right - left);
      this.cuts.push({ t: this.now, x: x > top.x ? right + over / 2 : left - over / 2, w: over, level, color });
      this.landed = this.now;
      this.w = right - left;
      this.tower.push({ x: (left + right) / 2, w: this.w });
      if (this.w < 16) return restart('Too thin!');
      this.gain(10, '+10');
    },
    draw(c) {
      const height = Math.min(1, this.lift / (H * 14));
      const mix = (a, b, u) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), u)).toString(16).padStart(2, '0')).join('');
      const dusk = Math.min(1, height * 2), night = Math.max(0, height * 2 - 1);
      sky(c, mix(mix('#7fbfe6', '#4a5aa0', dusk), '#111a38', night), mix(mix('#ffe6c7', '#f29a8a', dusk), '#35426e', night));
      for (let i = 0; i < 14; i++) { const y = wrap(i * 83 + this.lift * 0.25, HEIGHT) - 10; if (height > 0.25) star(c, '#ffffff', (i * 97) % WIDTH, y * 0.75, 1.5 + i % 3, i + this.now); }
      for (let i = 0; i < 3; i++) { c.globalAlpha = 1 - dusk * 0.4 - night * 0.55; cloud(c, wrap(i * 170 + this.now * (6 + i * 3), 500) - 70, 150 + i * 90 + this.lift * 0.35, 0.9 - i * 0.15); c.globalAlpha = 1; }
      ridge(c, '#8fa8c8', 450 + this.lift * 0.5, 130, 40, 150, HEIGHT + this.lift);
      ridge(c, '#6f9a72', 490 + this.lift * 0.8, 76, 110, 110, HEIGHT + this.lift);
      const slab = (x, w, y, i, fresh) => block(c, fresh ? '#8a93a6' : COLORS[i % COLORS.length], x - w / 2, y, w, H, 12);
      if (this.screenY(0) < HEIGHT + 20) block(c, '#8a7f76', 66, this.screenY(0) + H, 228, 40, 14);
      this.tower.forEach((b, i) => {
        const squash = i === this.tower.length - 1 && i ? Math.max(0, 1 - (this.now - this.landed) / 0.15) : 0, y = this.screenY(i);
        if (y < HEIGHT + 20) slab(b.x, b.w + squash * 6, y + squash * 2, i, b.fresh);
      });
      for (const cut of this.cuts) {
        const k = this.now - cut.t;
        c.save(); c.globalAlpha = Math.max(0, 1 - k / 1.1); c.translate(cut.x, this.screenY(cut.level) + H / 2 + k * k * 620); c.rotate(k * (cut.x < 180 ? -2.5 : 2.5));
        block(c, COLORS[cut.color], -cut.w / 2, -H / 2, cut.w, H, 12); c.restore();
      }
      const y = this.screenY(this.tower.length) - 8, drop = pop((this.now - this.ready + 0.18) / 0.22);
      shadow(c, this.x + 6, y + H + 4, this.w / 2, 3, 0.14);
      c.globalAlpha = Math.min(1, drop + 0.2); slab(this.x, this.w, y - (1 - drop) * 10, this.tower.length); c.globalAlpha = 1;
      // The rules, always in view.
      c.fillStyle = 'rgba(18,26,50,.7)'; c.beginPath(); c.roundRect(22, 10, 316, 30, 8); c.fill();
      words(c, 'Land +10   Perfect +15   Start over -10', 180, 31, 14, '#ffffff');
    },
  });
}

// Every pie shares a tin and a crust. The bad ones are given away by a black filling and smoke, or a lit fuse.
function pie(c, kind, t) {
  const burnt = kind === 'burnt', gold = kind === 'gold';
  if (gold) { c.fillStyle = 'rgba(255,220,90,.35)'; c.beginPath(); c.arc(0, -1, 29, 0, 7); c.fill(); }
  poly(c, '#d3dae4', [[-23, -1], [23, -1], [15, 13], [-15, 13]]); poly(c, '#aeb8c8', [[4, -1], [23, -1], [15, 13], [2, 13]]);
  gem(c, burnt ? '#2b1d18' : gold ? '#f2a51e' : '#c9304a', 0, -3, 18, 8, { sides: 10 });
  const crust = burnt ? '#6b4630' : gold ? '#ffe27a' : '#f2c473';
  for (const k of [-12, -4, 4, 12]) beam(c, crust, k - 6, -10 + Math.abs(k) / 4, k + 6, 2 - Math.abs(k) / 4, 4);
  beam(c, burnt ? '#5a3a28' : gold ? '#f7c948' : '#e8ad5c', -22, -2, 0, 2, 5); beam(c, burnt ? '#4a2f20' : gold ? '#f7c948' : '#e8ad5c', 0, 2, 22, -2, 5);
  if (burnt) for (let k = 0; k < 3; k++) { const u = (t * 1.3 + k / 3) % 1; c.globalAlpha = 0.55 * (1 - u); gem(c, '#8a8580', -9 + k * 9 + Math.sin(u * 6) * 3, -12 - u * 22, 3 + u * 5, 3 + u * 5, { sides: 7 }); c.globalAlpha = 1; }
  if (kind === 'fuse') { beam(c, '#2b2b30', 2, -7, 6, -17, 2.6); beam(c, '#2b2b30', 6, -17, 12, -20, 2.6); star(c, '#ff8a1e', 13, -21, 7 + Math.sin(t * 30) * 2, t * 9); star(c, '#fff1a8', 13, -21, 3.5, -t * 12); }
  if (gold) star(c, '#ffffff', -10 + Math.sin(t * 3) * 6, -9, 4, t * 4, 4);
}
function pies(rand) {
  const FLOOR = 482, items = [];
  const arrives = q => q.at + FLOOR / q.speed;
  for (let at = 0.4; at < SECONDS - 0.5;) {
    const p = hard(at), storm = at > 23, roll = rand();
    const kind = roll < 0.2 + 0.18 * p ? (rand() < 0.5 ? 'burnt' : 'fuse') : roll > 0.94 ? 'gold' : 'pie';
    const speed = (210 + 190 * p + rand() * 60) * (kind === 'gold' ? 1.25 : 1);
    const item = { at, kind, bad: kind === 'burnt' || kind === 'fuse', speed, x: 40 + rand() * (WIDTH - 80), sway: p > 0.3 && rand() < 0.35 ? 16 + 26 * p : 0, phase: rand() * 6 };
    // Never put a bad pie right on top of a good one: there must always be a way to take one and leave the other.
    for (let tries = 0; tries < 12 && items.some(o => o.bad !== item.bad && Math.abs(arrives(o) - arrives(item)) < 0.3 && Math.abs(o.x - item.x) < 130); tries++) item.x = 40 + rand() * (WIDTH - 80);
    items.push(item);
    at += storm ? 0.26 : 0.62 - 0.26 * p;
  }
  const height = (i, t) => -20 + i.speed * (t - i.at);
  const across = (i, t) => clamp(i.x + i.sway * Math.sin((t - arrives(i)) * 4) , 28, WIDTH - 28);
  return base({
    items, x: 180, shown: 180, landed: -1, streak: 0, stormed: false, across, arrives,
    times() { return 1 + Math.min(2, Math.floor(this.streak / 5)); },
    update(dt, t) {
      this.now = t; this.shown += (this.x - this.shown) * Math.min(1, dt * 30);
      if (t > 23 && !this.stormed) { this.stormed = true; this.fx.say(t, 'Pie storm!', GREAT); this.fx.shake(t, 4); }
      for (const i of items) {
        if (i.done || t < i.at) continue;
        const y = height(i, t), x = across(i, t);
        if (y > 452 && y < 492 && Math.abs(x - this.x) < 40) {
          i.done = i.caught = true; this.landed = t;
          if (i.bad) { this.streak = 0; this.gain(-20, i.kind === 'fuse' ? 'Kaboom! -20' : 'Burnt! -20'); this.fx.shake(t, 9); this.fx.burst(t, x, 462, i.kind === 'fuse' ? ['#ffd45c', '#ff8a3c', '#ffffff'] : ['#3a2a22', '#6a5a52', '#9a8a82'], { n: 20 }); }
          else {
            const times = this.times(), points = (i.kind === 'gold' ? 30 : 10) * times; this.streak++;
            this.gain(points, this.times() > times ? `Streak x${this.times()}!` : `+${points}`, i.kind === 'gold' ? '#b57a00' : GOOD);
            this.fx.burst(t, x, 462, i.kind === 'gold' ? ['#ffe27a', '#ffffff', '#f2b134'] : ['#c9304a', '#f2c473', '#ffffff'], { n: i.kind === 'gold' ? 22 : 10, speed: 130, up: 110 });
          }
        } else if (y >= 492) { i.done = true; if (!i.bad) this.streak = 0; this.fx.burst(t, x, 496, i.bad ? ['#6a5a52', '#8d7a63'] : ['#c9304a', '#f2c473', '#d99a45'], { n: i.bad ? 8 : 14, speed: 140, up: 40, life: 0.5 }); }
      }
    },
    down(x) { this.x = clamp(x, 36, WIDTH - 36); }, move(x) { this.down(x); },
    draw(c) {
      c.fillStyle = gradient(c, 0, 496, '#ffeedb', '#f3c49b'); c.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 0; i < 8; i++) poly(c, 'rgba(255,255,255,.2)', [[i * 50 - 14, 0], [i * 50 + 12, 0], [i * 50 + 12, 496], [i * 50 - 14, 496]]);
      // Kitchen window, a shelf of jars and bunting.
      block(c, '#b9784c', 96, 118, 164, 128, 10); c.fillStyle = gradient(c, 128, 236, '#8fcbe8', '#e7f4f8'); c.fillRect(106, 128, 144, 108);
      cloud(c, 140, 158, 0.55);
      poly(c, '#8fb573', [[106, 236], [106, 212], [150, 190], [196, 222], [190, 236]]); poly(c, '#79a064', [[150, 236], [214, 196], [250, 214], [250, 236]]);
      block(c, '#b9784c', 175, 128, 6, 108, 3); block(c, '#a5663d', 88, 236, 180, 10, 10);
      block(c, '#a5663d', 22, 330, 96, 8, 9); block(c, '#a5663d', 246, 366, 92, 8, 9);
      [['#e4572e', 34, 330], ['#3fa7a3', 66, 330], ['#f2b134', 92, 330], ['#7a6ac0', 262, 366], ['#6bb26a', 298, 366]].forEach(([color, x, y]) => { gem(c, color, x + 8, y - 14, 12, 14, { sides: 8, depth: 0.22 }); block(c, '#c9d2e0', x + 1, y - 33, 14, 6, 4); });
      for (let i = 0; i < 9; i++) poly(c, ['#e4572e', '#f2b134', '#3fa7a3'][i % 3], [[i * 40, 8 + Math.sin(i * 0.7) * 4], [i * 40 + 36, 8 + Math.sin(i * 0.7 + 0.7) * 4], [i * 40 + 18, 36]]);
      c.fillStyle = '#9c6238'; c.fillRect(0, 496, WIDTH, 24);
      for (let i = 0; i < 12; i++) poly(c, i % 2 ? '#c99263' : '#b57a4b', [[i * 32, 496], [i * 32 + 32, 496], [i * 32 + 26, HEIGHT], [i * 32 - 6, HEIGHT]]);
      const basket = () => {
        const x = this.shown, squash = Math.max(0, 1 - (this.now - this.landed) / 0.18) * 4;
        shadow(c, x, 502, 40, 7, 0.25);
        const rim = 465 + squash;
        poly(c, '#7a4a28', [[x - 38, rim], [x - 32, rim - 6], [x + 32, rim - 6], [x + 38, rim]]);
        for (let k = 0; k < 6; k++) {
          const a = k / 6, b = (k + 1) / 6;
          poly(c, shade('#c8894e', 0.18 - k * 0.09), [[x - 39 - squash + (78 + 2 * squash) * a, rim], [x - 39 - squash + (78 + 2 * squash) * b, rim], [x - 28 + 56 * b, 501], [x - 28 + 56 * a, 501]]);
        }
        for (const y of [476, 488]) beam(c, '#a96d3a', x - 36 + (y - rim) * 0.3, y, x + 36 - (y - rim) * 0.3, y, 3.5);
        beam(c, '#e0a868', x - 42 - squash, rim, x + 42 + squash, rim, 8);
      };
      basket();
      for (const i of items) {
        const y = height(i, this.now);
        if (this.now < i.at || y > HEIGHT + 20 || i.done) continue;
        const x = across(i, this.now), near = clamp(y / 500, 0, 1);
        shadow(c, x, 502, 8 + 14 * near, 4, 0.06 + 0.14 * near);
        c.save(); c.translate(x, y); c.scale(1.18, 1.18); c.rotate(Math.sin(this.now * 4 + i.x) * 0.16);
        pie(c, i.kind, this.now + i.phase);
        c.restore();
      }
      if (this.streak >= 5) words(c, `Streak x${this.times()}`, 180, 66, 17, '#ffffff', '#b9502f');
    },
  });
}

function bonk(rand) {
  const holes = Array.from({ length: 9 }, (_, i) => ({ x: 62 + (i % 3) * 118, y: 170 + Math.floor(i / 3) * 125 }));
  const pops = [], busy = Array(9).fill(0);
  for (let at = 0.4; at < SECONDS;) {
    const p = hard(at), open = holes.map((_, i) => i).filter(i => busy[i] <= at);
    if (open.length) {
      const hole = open[Math.floor(rand() * open.length)], stay = 1.2 - 0.65 * p;
      pops.push({ at, until: at + stay, hole, bunny: rand() < 0.18 + 0.12 * p });
      busy[hole] = at + stay + 0.15;
    }
    at += 0.7 - 0.42 * p;
  }
  const up = (m, t) => t >= m.at && t < (m.hit ? Math.max(m.until, m.hit + 0.32) : m.until);
  return base({
    pops, holes, swing: null,
    update(dt, t) { this.now = t; },
    down(x, y) {
      this.swing = { t: this.now, x, y };
      const m = pops.find(m => !m.hit && up(m, this.now) && Math.hypot(holes[m.hole].x - x, holes[m.hole].y - 24 - y) < 55);
      if (!m) return;
      m.hit = this.now;
      const h = holes[m.hole];
      if (m.bunny) { this.gain(-15, 'Not the bunny!'); this.fx.shake(this.now); this.fx.burst(this.now, h.x, h.y - 40, ['#ffffff', '#f0a8b8'], { n: 10 }); }
      else { this.gain(10, 'Bonk! +10'); this.fx.shake(this.now, 3); this.fx.burst(this.now, h.x, h.y - 40, ['#ffd45c', '#ffffff', '#ff8a3c'], { n: 12 }); }
    },
    draw(c) {
      sky(c, '#8fcbe8', '#e7f4ea', 120);
      cloud(c, wrap(this.now * 8 + 60, 460) - 50, 44, 0.8);
      ridge(c, '#7fae8a', 110, 54, 60, 90);
      c.fillStyle = gradient(c, 104, HEIGHT, '#a9d176', '#6fa34e'); c.fillRect(0, 104, WIDTH, HEIGHT - 104);
      for (let i = 0; i < 40; i++) { const x = (i * 89) % WIDTH, y = 116 + (i * 61) % 396; poly(c, i % 2 ? '#bde08a' : '#82b45c', [[x, y], [x + 4, y - 9], [x + 7, y], [x + 11, y - 6], [x + 13, y]]); }
      holes.forEach((h, i) => {
        gem(c, '#a87a4f', h.x, h.y + 4, 53, 21, { sides: 11 });
        gem(c, '#3c281c', h.x, h.y, 41, 13.5, { sides: 11, depth: 0.15 });
        const m = pops.findLast(m => m.hole === i && up(m, this.now));
        if (m) {
          const rise = m.hit ? 1 - ease((this.now - m.hit) / 0.32) : Math.min(pop((this.now - m.at) / 0.16), ease((m.until - this.now) / 0.12));
          const squash = m.hit ? Math.max(0, 1 - (this.now - m.hit) / 0.2) : 0;
          c.save(); c.beginPath(); c.rect(h.x - 60, h.y - 140, 120, 140); c.ellipse(h.x, h.y, 41, 13.5, 0, 0, Math.PI); c.clip();
          c.translate(h.x, h.y + 40 - 68 * rise); c.scale(1 + squash * 0.2, 1 - squash * 0.2);
          const fur = m.bunny ? '#eef0f5' : '#a8714a', y = 0;
          if (m.bunny) for (const k of [-1, 1]) { c.save(); c.translate(k * 10, y - 20); c.rotate(k * 0.14); gem(c, fur, 0, -17, 7.5, 21, { sides: 8 }); gem(c, '#f0a8b8', 0, -16, 3.2, 14, { sides: 6, depth: 0.15 }); c.restore(); }
          else for (const k of [-1, 1]) { gem(c, fur, k * 21, y - 17, 8, 8, { sides: 7 }); gem(c, '#e0a98a', k * 21, y - 17, 3.5, 3.5, { sides: 6 }); }
          gem(c, fur, 0, y + 34, 27, 38, { sides: 10 });
          gem(c, fur, 0, y - 2, 26, 24, { sides: 11 });
          gem(c, m.bunny ? '#ffffff' : '#e8c29a', 0, y + 8, 14, 10, { sides: 8, depth: 0.2 });
          for (const k of [-1, 1]) {
            if (m.hit) { c.strokeStyle = '#1d2433'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(k * 10 - 4, y - 12); c.lineTo(k * 10 + 4, y - 4); c.moveTo(k * 10 + 4, y - 12); c.lineTo(k * 10 - 4, y - 4); c.stroke(); }
            else { gem(c, '#1d2433', k * 10, y - 8, 3.6, 4.2, { sides: 8, depth: 0 }); gem(c, '#ffffff', k * 10 - 1.2, y - 9.6, 1.3, 1.3, { sides: 6, depth: 0 }); }
          }
          gem(c, m.bunny ? '#e9899f' : '#4a2c22', 0, y + 3, 5, 3.8, { sides: 7 });
          if (!m.bunny) { poly(c, '#ffffff', [[-6, y + 11], [-0.7, y + 11], [-1.2, y + 19], [-5.5, y + 18]]); poly(c, '#ffffff', [[0.7, y + 11], [6, y + 11], [5.5, y + 18], [1.2, y + 19]]); }
          c.restore();
          if (m.hit && !m.bunny) for (let k = 0; k < 3; k++) { const a = this.now * 9 + k * 2.1; star(c, '#ffd45c', h.x + Math.cos(a) * 30, h.y - 66 + Math.sin(a) * 8, 7, a); }
        }
        // The front lip of the mound.
        poly(c, '#b8875a', [[h.x - 53, h.y + 4], [h.x - 38, h.y + 5], [h.x - 20, h.y + 15], [h.x - 31, h.y + 21]]);
        poly(c, '#a87a4f', [[h.x - 20, h.y + 15], [h.x + 20, h.y + 15], [h.x + 31, h.y + 21], [h.x, h.y + 26], [h.x - 31, h.y + 21]]);
        poly(c, '#8c623d', [[h.x + 20, h.y + 15], [h.x + 38, h.y + 5], [h.x + 53, h.y + 4], [h.x + 31, h.y + 21]]);
      });
      // A mallet swings wherever you tap.
      const w = this.swing, k = w ? this.now - w.t : 1;
      if (k < 0.22) {
        c.save(); c.globalAlpha = Math.min(1, (0.22 - k) / 0.08); c.translate(w.x + 34, w.y + 10); c.rotate(lerp(0.5, -0.9, ease(k / 0.09)));
        beam(c, '#c98a4b', 8, 8, -14, -34, 8, 7);
        c.translate(-17, -40); c.rotate(-0.48);
        beam(c, '#e4572e', -24, 0, 24, 0, 28); gem(c, '#f2b134', -24, 0, 6, 15, { sides: 8 }); gem(c, '#f7c65a', 24, 0, 6, 15, { sides: 8 });
        c.restore();
      }
    },
  });
}

function copycat(rand) {
  const stream = Array.from({ length: 240 }, () => Math.floor(rand() * 4));
  const pads = [{ x: 20, y: 150, on: '#ff7a5c', off: '#a8453a' }, { x: 188, y: 150, on: '#5cb4ff', off: '#2f5f93' },
    { x: 20, y: 318, on: '#ffe066', off: '#a8862e' }, { x: 188, y: 318, on: '#6fe08f', off: '#33784f' }];
  return base({
    stream, length: 2, tries: 0, seq: [], from: 0, at: 0, pressed: null,
    deal(t) {
      const start = (this.tries++ * 13) % 200;
      this.seq = stream.slice(start, start + this.length); this.from = t + 0.5; this.at = 0;
    },
    restart(t) { this.deal(t); },
    timing() { const p = hard(this.from); return { on: 0.46 - 0.26 * p, gap: 0.14 - 0.07 * p }; },
    showing(t = this.now) { const { on, gap } = this.timing(); return t < this.from + this.seq.length * (on + gap); },
    lit(t = this.now) {
      if (this.pressed && t < this.pressed.until) return this.pressed.pad;
      const { on, gap } = this.timing(), i = Math.floor((t - this.from) / (on + gap));
      return i >= 0 && i < this.seq.length && (t - this.from) % (on + gap) < on ? this.seq[i] : -1;
    },
    update(dt, t) { this.now = t; if (!this.seq.length) this.deal(t); },
    down(x, y) {
      const pad = pads.findIndex(p => x >= p.x && x <= p.x + 152 && y >= p.y && y <= p.y + 152);
      if (pad < 0 || this.showing()) return;
      this.pressed = { pad, until: this.now + 0.16 };
      if (pad !== this.seq[this.at]) { this.length = Math.max(2, this.length - 1); this.gain(0, 'Oops!', BAD); this.fx.shake(this.now, 7); return this.deal(this.now); }
      this.at++;
      if (this.at < this.seq.length) return this.gain(2);
      this.gain(2 + this.length * 5, `Nice! +${this.length * 5}`);
      this.fx.burst(this.now, WIDTH / 2, 300, pads.map(p => p.on), { n: 24, speed: 260, up: 40 });
      this.length++; this.deal(this.now);
    },
    draw(c) {
      c.fillStyle = gradient(c, 0, HEIGHT, '#2a3356', '#4a3f6b'); c.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 0; i < 10; i++) { c.globalAlpha = 0.07; poly(c, '#ffffff', [[(i * 97) % 360, (i * 143) % 520], [(i * 97 + 90) % 420, (i * 143 + 20) % 520], [(i * 97 + 30) % 380, (i * 143 + 90) % 560]]); c.globalAlpha = 1; }
      const on = this.lit();
      // The cat watches, and looks at whichever pad is lit.
      const look = on < 0 ? [0, 0] : [on % 2 ? 2.4 : -2.4, on > 1 ? 2 : -0.5], blink = this.now % 3.2 < 0.12;
      for (const k of [-1, 1]) { poly(c, '#e8964a', [[180 + k * 40, 66], [180 + k * 36, 22], [180 + k * 8, 46]]); poly(c, '#f0a8b8', [[180 + k * 33, 54], [180 + k * 32, 33], [180 + k * 18, 46]]); }
      gem(c, '#e8964a', 180, 76, 44, 36, { sides: 12 }); gem(c, '#fbe6cc', 180, 90, 20, 14, { sides: 8, depth: 0.2 });
      for (const k of [-1, 1]) {
        if (blink) beam(c, '#1d2433', 180 + k * 16 - 6, 71, 180 + k * 16 + 6, 71, 2.5);
        else { gem(c, '#ffffff', 180 + k * 16, 70, 8, 9, { sides: 10, depth: 0.08 }); gem(c, '#1d2433', 180 + k * 16 + look[0], 71 + look[1], 4, 5.5, { sides: 8, depth: 0 }); }
        for (const w of [-4, 5]) beam(c, '#fbe6cc', 180 + k * 22, 90, 180 + k * 54, 88 + w, 1.4);
      }
      poly(c, '#d9607a', [[175, 83], [185, 83], [180, 89]]);
      pads.forEach((p, i) => {
        const lit = on === i, color = lit ? p.on : p.off, push = lit ? 5 : 0, x = p.x, y = p.y + push, m = 18;
        shadow(c, x + 76, p.y + 160, 74, 8, 0.3);
        poly(c, shade(color, -0.45), [[x + 10, p.y + 156], [x + 142, p.y + 156], [x + 152, p.y + 144], [x + 152, p.y + 20], [x, p.y + 20], [x, p.y + 144]]);
        if (lit) { c.save(); c.shadowColor = p.on; c.shadowBlur = 34; poly(c, color, [[x + 8, y], [x + 144, y], [x + 152, y + 10], [x + 152, y + 138], [x + 144, y + 148], [x + 8, y + 148], [x, y + 138], [x, y + 10]]); c.restore(); }
        poly(c, shade(color, 0.3), [[x, y + 10], [x + 8, y], [x + 144, y], [x + 152, y + 10], [x + 152 - m, y + m + 4], [x + m, y + m + 4]]);
        poly(c, shade(color, 0.1), [[x, y + 10], [x + m, y + m + 4], [x + m, y + 148 - m - 4], [x, y + 138]]);
        poly(c, shade(color, -0.14), [[x + 152, y + 10], [x + 152, y + 138], [x + 152 - m, y + 148 - m - 4], [x + 152 - m, y + m + 4]]);
        poly(c, shade(color, -0.24), [[x, y + 138], [x + m, y + 126], [x + 152 - m, y + 126], [x + 152, y + 138], [x + 144, y + 148], [x + 8, y + 148]]);
        c.fillStyle = gradient(c, y + m, y + 148 - m, shade(color, 0.12), color); c.fillRect(x + m, y + m + 3, 152 - 2 * m, 148 - 2 * m - 6);
        // A different shape on each pad, so color isn't the only clue.
        const cx = x + 76, cy = y + 74, mark = lit ? '#ffffff' : shade(color, 0.28);
        if (i === 0) { c.fillStyle = mark; c.beginPath(); c.arc(cx, cy, 20, 0, 7); c.fill(); }
        if (i === 1) poly(c, mark, [[cx, cy - 22], [cx + 22, cy + 17], [cx - 22, cy + 17]]);
        if (i === 2) star(c, mark, cx, cy, 24);
        if (i === 3) poly(c, mark, [[cx, cy - 23], [cx + 22, cy], [cx, cy + 23], [cx - 22, cy]]);
      });
      words(c, this.showing() ? 'Watch...' : `Your turn: ${this.at} of ${this.seq.length}`, WIDTH / 2, 138, 19, '#ffffff');
    },
  });
}

function derby(rand) {
  const FROM = 150, PLATE = 420;
  const pitches = [];
  // How each pitch travels: u is how far along it is (0 to 1 at the plate), x its sideways break, y its loft.
  const KINDS = {
    fastball: { name: 'Fastball', time: p => 0.9 - 0.42 * p, u: s => s, x: () => 0, y: s => 14 * Math.sin(Math.PI * s) },
    changeup: { name: 'Changeup', time: p => 1.35 - 0.45 * p, u: s => s < 1 ? 1 - (1 - s) ** 1.9 * 0.85 - 0.15 * (1 - s) : 1 + (s - 1) * 0.15, x: () => 0, y: s => 22 * Math.sin(Math.PI * s) },
    curve: { name: 'Curveball', time: p => 1.25 - 0.45 * p, u: s => 0.45 * s + 0.55 * s ** 3, x: (s, side) => side * 95 * Math.sin(Math.PI * Math.min(1, s) ** 1.6), y: s => 30 * Math.sin(Math.PI * s) },
    slow: { name: 'Slow lob', time: p => 1.9 - 0.45 * p, u: s => s, x: () => 0, y: s => 150 * Math.sin(Math.PI * s) },
  };
  for (let at = 0.8; at < SECONDS - 0.5;) {
    const p = hard(at), roll = rand(), mix = pitches.length < 2 ? 0 : 0.38 + 0.34 * p;
    const kind = roll >= mix ? 'fastball' : roll < mix * 0.42 ? 'curve' : roll < mix * 0.76 ? 'changeup' : 'slow';
    const flight = KINDS[kind].time(p) * (0.94 + rand() * 0.12);
    pitches.push({ at, flight, kind, side: rand() < 0.5 ? -1 : 1 });
    at += flight + 0.55 - 0.28 * p;
  }
  // Where the ball is, s being the share of the flight gone by.
  const spot = (q, s) => {
    const k = KINDS[q.kind], u = k.u(s);
    return { x: 180 + k.x(s, q.side), y: lerp(FROM, PLATE, u) - (s < 1 ? k.y(s) : 0), u };
  };
  return base({
    pitches, spot, swung: -1, hit: null,
    current(t) { return pitches.find(q => t >= q.at && t < q.at + q.flight + 0.3); },
    update(dt, t) { this.now = t; },
    down() {
      if (this.now < this.swung + 0.35) return;
      this.swung = this.now;
      const q = this.current(this.now);
      if (!q || q.swung) return;
      q.swung = true;
      const early = q.at + q.flight - this.now, off = Math.abs(early);
      if (off < 0.032) { this.fx.shake(this.now, 7); this.fx.burst(this.now, 180, PLATE, ['#ffffff', '#ffd45c', '#ff8a3c'], { n: 24, speed: 260 }); this.gain(15, 'HOME RUN!', BAD); this.hit = { at: this.now, up: 520, side: -early * 900 }; q.gone = true; }
      else if (off < 0.065) { this.fx.burst(this.now, 180, PLATE, ['#ffffff', '#ffd45c'], { n: 12 }); this.gain(8, 'Double! +8'); this.hit = { at: this.now, up: 340, side: -early * 1500 }; q.gone = true; }
      else if (off < 0.105) { this.fx.burst(this.now, 180, PLATE, ['#ffffff'], { n: 7 }); this.gain(3, 'Single +3'); this.hit = { at: this.now, up: 200, side: -early * 1500 }; q.gone = true; }
      else this.gain(-3, `${KINDS[q.kind].name}: ${early > 0 ? 'too early' : 'too late'}`, BAD);
    },
    draw(c) {
      sky(c, '#7ab8e6', '#d9eef8', 130);
      cloud(c, wrap(this.now * 6 + 40, 460) - 50, 40, 0.7); cloud(c, wrap(this.now * 4 + 270, 460) - 50, 62, 0.5);
      // Stands with a crowd that jumps for a home run.
      const cheer = this.hit?.up > 500 && this.now - this.hit.at < 1.2;
      poly(c, '#46587c', [[0, 78], [180, 60], [360, 78], [360, 138], [0, 138]]);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 30; i++) {
        const x = i * 12.5 + (row % 2) * 6, y = 84 + row * 14 - Math.sin(x / 360 * Math.PI) * 14 - (cheer ? Math.abs(Math.sin(this.now * 14 + i + row)) * 5 : 0);
        gem(c, ['#e4572e', '#f2c14e', '#ffffff', '#6fb7e0', '#c4609a'][(i * 7 + row * 3) % 5], x, y, 4, 4.5, { sides: 6 });
      }
      block(c, '#2f6a52', -8, 126, 372, 20, 7);
      c.fillStyle = gradient(c, 144, HEIGHT, '#6fae55', '#4f9040'); c.fillRect(0, 144, WIDTH, HEIGHT - 144);
      for (let i = -4; i < 5; i += 2) poly(c, 'rgba(255,255,255,.07)', [[180 + i * 22, 144], [180 + (i + 1) * 22, 144], [180 + (i + 1) * 100, HEIGHT], [180 + i * 100, HEIGHT]]);
      poly(c, '#dba96e', [[180, 146], [306, 258], [180, 400], [54, 258]]); poly(c, '#74b35a', [[180, 180], [264, 256], [180, 350], [96, 256]]);
      gem(c, '#d29a5f', 180, FROM + 38, 30, 10, { sides: 10 }); gem(c, '#dba96e', 180, 452, 118, 56, { sides: 14, depth: 0.12 });
      for (const k of [-1, 1]) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5; c.strokeRect(180 + k * 54 - 20, PLATE - 8, 40, 58); }
      poly(c, '#ffffff', [[160, PLATE + 10], [200, PLATE + 10], [200, PLATE + 20], [180, PLATE + 32], [160, PLATE + 20]]);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.setLineDash([5, 6]); c.beginPath(); c.ellipse(180, PLATE, 22, 13, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      // Pitcher winds up before each throw.
      const next = pitches.find(q => q.at > this.now), wind = next && next.at - this.now < 0.4 ? 1 - (next.at - this.now) / 0.4 : 0;
      const q = this.current(this.now), thrown = q ? clamp((this.now - q.at) / 0.18, 0, 1) : 1;
      c.save(); c.translate(180, FROM + 38); c.scale(1.35, 1.35); c.translate(-180, -FROM - 38);
      shadow(c, 180, FROM + 38, 16, 5);
      beam(c, '#e9edf3', 175, FROM + 36, 177, FROM + 18, 6); beam(c, '#e9edf3', 186, FROM + 36 - wind * 12, 183, FROM + 18, 6);
      gem(c, '#c43d4b', 180, FROM + 9, 10, 13, { sides: 8 });
      const arm = wind ? lerp(0.6, -2.4, ease(wind)) : lerp(-2.4, 0.9, ease(thrown));
      beam(c, '#c43d4b', 187, FROM + 3, 187 + Math.cos(arm) * 15, FROM + 3 + Math.sin(arm) * 15, 5, 4);
      gem(c, '#e8b58e', 180, FROM - 8, 7, 7.5); gem(c, '#2b3550', 180, FROM - 13, 7.5, 4.5, { sides: 8 });
      c.restore();
      if (q && !q.gone) {
        const s = (this.now - q.at) / q.flight, at = spot(q, s), r = 4 + 9 * clamp(at.u, 0, 1.15);
        shadow(c, at.x, lerp(FROM + 38, PLATE + 22, at.u), r, r / 3, 0.18);
        c.save(); c.translate(at.x, at.y); gem(c, '#ffffff', 0, 0, r, r, { sides: 11, depth: 0.2 });
        // The seams spin: fast and sideways on a curve.
        c.rotate(this.now * (q.kind === 'curve' ? 22 * q.side : q.kind === 'fastball' ? 9 : 2.5));
        c.strokeStyle = '#d6453a'; c.lineWidth = r / 6;
        for (const k of [-1, 1]) { c.beginPath(); c.arc(k * r * 1.25, 0, r * 0.8, k > 0 ? 2.4 : -0.75, k > 0 ? 3.9 : 0.75); c.stroke(); }
        c.restore();
      }
      // Batter and bat. From a stance with the bat up behind him, it drops back, cuts across the plate
      // (about 0.07s after the tap) and finishes up toward the pitcher.
      const since = this.swung >= 0 ? this.now - this.swung : 1;
      const REST = -1.15, CONTACT = Math.PI, END = 4.45;
      const angle = since < 0.07 ? lerp(REST, CONTACT, since / 0.07) : since < 0.17 ? lerp(CONTACT, END, ease((since - 0.07) / 0.1))
        : since < 0.34 ? END : since < 0.5 ? lerp(END, REST + Math.PI * 2, ease((since - 0.34) / 0.16)) : REST;
      const turn = since < 0.12 ? ease(since / 0.12) : since < 0.34 ? 1 : since < 0.5 ? 1 - ease((since - 0.34) / 0.16) : 0;
      const bx = 268, hand = [lerp(bx + 2, bx - 28, turn), lerp(PLATE - 26, PLATE - 6, Math.min(1, since < 0.34 ? since / 0.07 : turn))];
      const tipAt = a => [hand[0] + Math.cos(a) * 82, hand[1] + Math.sin(a) * (Math.sin(a) < 0 ? 72 : 42)];
      const bat = () => {
        const tip = tipAt(angle);
        beam(c, '#c98a4b', hand[0], hand[1], tip[0], tip[1], 5, 13); gem(c, '#c98a4b', tip[0], tip[1], 6.5, 6.5, { sides: 8 });
      };
      shadow(c, bx, PLATE + 52, 30, 8);
      // The stretch of the swing behind him is drawn before the body.
      const behind = since >= 0.5 || since < 0.02;
      if (behind) bat();
      beam(c, '#e9edf3', bx - 14 - turn * 5, PLATE + 50, bx - 4, PLATE + 20, 12, 13); beam(c, '#e9edf3', bx + 16, PLATE + 48, bx + 6, PLATE + 20, 12, 13);
      gem(c, '#3b6fb8', bx - turn * 4, PLATE - 2, 20 - turn * 3, 28, { sides: 9 });
      const hx = bx - 4 - turn * 5;
      gem(c, '#e8b58e', hx, PLATE - 38, 13, 14); gem(c, '#2b4f8c', hx + 1, PLATE - 45, 15, 10, { sides: 9 });
      poly(c, '#2b4f8c', [[hx - 10, PLATE - 44], [hx - 25, PLATE - 39], [hx - 9, PLATE - 38]]);
      // A white streak follows the barrel through the zone.
      if (since > 0.02 && since < 0.24) {
        const tail = Math.max(REST + 0.8, angle - 1.9);
        c.globalAlpha = 0.45 * (since < 0.1 ? 1 : (0.24 - since) / 0.14);
        poly(c, '#ffffff', [hand, ...Array.from({ length: 8 }, (_, i) => tipAt(lerp(tail, angle, i / 7)))]); c.globalAlpha = 1;
      }
      if (!behind) bat();
      beam(c, '#3b6fb8', bx - 8 - turn * 4, PLATE - 14, hand[0], hand[1], 11, 8); gem(c, '#e8b58e', hand[0], hand[1], 6.5, 6.5);
      if (this.hit && this.now - this.hit.at < 0.9) {
        const k = this.now - this.hit.at;
        for (let i = 3; i >= 0; i--) {
          const s = Math.max(0, k - i * 0.035), r = Math.max(2.5, 13 - 10 * s);
          c.globalAlpha = i ? 0.28 - i * 0.06 : 1; gem(c, '#ffffff', 180 + this.hit.side * s, PLATE - this.hit.up * s + 90 * s * s, r, r, { sides: 10, depth: 0.2 });
        }
        c.globalAlpha = 1;
      }
      words(c, 'Tap as the ball reaches the plate', 180, 508, 14, '#ffffff', '#5a3d22');
    },
  });
}

function fieldgoal(rand) {
  const BX = 180, BY = 440, GY = 160, FLIGHT = 0.8;
  const winds = Array.from({ length: 60 }, () => (rand() * 2 - 1));
  const post = t => BX + Math.max(0, hard(t) - 0.3) * 120 * Math.sin(t * 1.1);
  const half = t => 68 - 36 * hard(t);
  return base({
    winds, post, half, kicks: 0, kick: null, fanX: 52, spin: 0,
    update(dt, t) {
      this.now = t;
      // The fan slides to whichever side the next wind comes from, and spins as hard as it blows.
      const wind = this.kick?.wind ?? this.windNow ?? 0;
      this.fanX += ((wind >= 0 ? 52 : WIDTH - 52) - this.fanX) * Math.min(1, dt * 14);
      this.spin += dt * (8 + Math.abs(wind) * 0.22);
      const k = this.kick;
      if (k && !k.done && t >= k.at + FLIGHT) {
        k.done = true;
        const off = Math.abs(k.to + k.wind - post(t));
        k.good = off < half(t);
        if (k.good) { this.gain(off < half(t) * 0.35 ? 15 : 10, off < half(t) * 0.35 ? 'Nothing but trash!' : "It's in!"); this.fx.burst(t, k.to + k.wind, GY, ['#ffffff', '#ffd45c', '#e4572e', '#6fb7e0'], { n: off < half(t) * 0.35 ? 28 : 14, speed: 230 }); }
        else { this.gain(0, off < half(t) + 9 ? 'Off the rim!' : 'Missed', BAD); if (off < half(t) + 9) { this.fx.shake(t, 6); this.fx.burst(t, k.to + k.wind, GY, ['#ffd45c'], { n: 8 }); } }
      }
      if (k && t >= k.at + FLIGHT + 0.3) { this.kick = null; this.kicks++; }
      // The next gust is set the moment the paper is back in hand.
      if (!this.kick) this.windNow = winds[this.kicks % 60] * (25 + 110 * hard(t));
    },
    up(x, y, from) {
      if (this.kick) return;
      const flick = from.y - y > 25;
      this.kick = { at: this.now, wind: this.windNow ?? 0, to: flick ? clamp(BX + (x - from.x) / (from.y - y) * (BY - GY), -60, WIDTH + 60) : x };
    },
    draw(c) {
      const g = post(this.now), w = half(this.now), RIM = 178;
      const wind = this.kick?.wind ?? this.windNow ?? 0, way = wind >= 0 ? 1 : -1, force = Math.min(1, Math.abs(wind) / 135);
      // The office: wall, window with blinds, a clock, and a wooden floor.
      c.fillStyle = gradient(c, 0, 222, '#7d93ad', '#a9bccd'); c.fillRect(0, 0, WIDTH, 222);
      for (let n = 0; n < 9; n++) poly(c, 'rgba(255,255,255,.07)', [[n * 44 - 6, 0], [n * 44 + 16, 0], [n * 44 + 16, 222], [n * 44 - 6, 222]]);
      block(c, '#e9edf3', 20, 20, 96, 82, 7); c.fillStyle = gradient(c, 27, 95, '#8fcbe8', '#e2f1f8'); c.fillRect(27, 27, 82, 68);
      poly(c, '#7f9bb8', [[27, 95], [27, 72], [44, 72], [44, 60], [62, 60], [62, 80], [80, 80], [80, 54], [96, 54], [96, 70], [109, 70], [109, 95]]);
      for (let y = 30; y < 56; y += 7) block(c, '#f4f6f9', 27, y, 82, 2.5, 3);
      gem(c, '#2b3550', 290, 54, 25, 25, { sides: 14, depth: 0.2 }); gem(c, '#f4f6f9', 290, 54, 20, 20, { sides: 14, depth: 0.06 });
      beam(c, '#2b3550', 290, 54, 290, 40, 3); beam(c, '#c4402c', 290, 54, 290 + Math.cos(this.now * 0.9) * 15, 54 + Math.sin(this.now * 0.9) * 15, 2);
      block(c, '#5f7490', -8, 214, 372, 12, 6);
      const planks = ['#c9915c', '#bd8450', '#d49d68', '#b57d4a'];
      for (let n = -6; n < 7; n++) poly(c, planks[(n + 8) % 4], [[180 + n * 30, 224], [180 + (n + 1) * 30, 224], [180 + (n + 1) * 112, HEIGHT], [180 + n * 112, HEIGHT]]);
      poly(c, 'rgba(52,70,110,.55)', [[112, 270], [248, 270], [300, 430], [60, 430]]); poly(c, 'rgba(240,244,250,.16)', [[124, 278], [236, 278], [280, 420], [80, 420]]);

      // Wind gauge.
      c.fillStyle = 'rgba(20,30,55,.68)'; c.beginPath(); c.roundRect(118, 322, 124, 52, 10); c.fill();
      words(c, `Wind ${(Math.abs(wind) / 25).toFixed(1)}`, BX, 344, 17, '#ffffff');
      const size = force * 62 + 10;
      beam(c, '#ffd45c', BX - way * size / 2, 360, BX + way * size / 2, 360, 6);
      poly(c, '#ffd45c', [[BX + way * (size / 2 + 12), 360], [BX + way * size / 2, 351], [BX + way * size / 2, 369]]);

      // Air streaming off the fan, faster and brighter in a stronger wind.
      for (let n = 0; n < 9; n++) {
        const u = (this.now * (0.35 + force * 1.3) + n * 0.37) % 1, x = this.fanX + way * (30 + u * 290), y = 232 + (n * 41) % 180 + Math.sin(u * 9 + n) * 5, long = 12 + force * 34;
        c.globalAlpha = Math.sin(u * Math.PI) * (0.25 + force * 0.55); beam(c, '#ffffff', x, y, x - way * long, y, 2.5, 0.5); c.globalAlpha = 1;
      }

      // The wastebasket: far rim and dark inside first, then the paper if it's going in, then the front.
      const tall = 48 + w * 0.75, low = w * 0.74, foot = RIM + tall, lip = w * 0.24;
      shadow(c, g + 6, foot + 4, low + 16, 9, 0.3);
      c.fillStyle = '#1f2636'; c.beginPath(); c.ellipse(g, RIM, w, lip, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#7f8ba3'; c.lineWidth = 5; c.beginPath(); c.ellipse(g, RIM, w, lip, 0, Math.PI, 0); c.stroke();
      const front = () => {
        const rim = a => [g + Math.cos(a) * w, RIM + Math.sin(a) * lip], base = a => [g + Math.cos(a) * low, foot + Math.sin(a) * lip * 0.7];
        for (let n = 0; n < 7; n++) {
          const a = Math.PI - n * Math.PI / 7, z = a - Math.PI / 7;
          poly(c, shade('#5b6784', 0.28 - n * 0.095), [rim(a), rim(z), base(z), base(a)]);
        }
        c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.2; c.beginPath();
        for (let n = 1; n < 14; n++) { const a = Math.PI - n * Math.PI / 14; c.moveTo(...rim(a)); c.lineTo(...base(a)); }
        c.stroke();
        c.strokeStyle = '#c3ccdd'; c.lineWidth = 5; c.beginPath(); c.ellipse(g, RIM, w, lip, 0, 0, Math.PI); c.stroke();
      };

      let x = BX, y = BY, r = 25, turn = 0, inside = false;
      if (this.kick) {
        const k = this.kick, u = Math.min(1, (this.now - k.at) / FLIGHT), over = Math.max(0, this.now - k.at - FLIGHT);
        x = lerp(BX, k.to, u) + k.wind * u * u; y = lerp(BY, RIM - 6, u) - Math.sin(Math.PI * u) * 105; r = lerp(25, 13, u); turn = (this.now - k.at) * 9 * (k.to < BX ? -1 : 1);
        if (over > 0 && k.good) { inside = true; y = RIM - 6 + over * over * 700; x = lerp(x, g, Math.min(1, over * 5)); }
        if (over > 0 && !k.good) {
          // It glances away and drops to the floor.
          const side = k.to + k.wind >= g ? 1 : -1, rimmed = Math.abs(k.to + k.wind - g) < w + 9;
          x += side * over * (rimmed ? 230 : 90); y = Math.min(foot + 8, RIM - 6 - (rimmed ? over * 260 : 0) + over * over * 1100);
        }
        shadow(c, x, Math.max(y + r, lerp(BY + 28, foot + 6, u)), r * 0.9, r / 4, inside ? 0 : 0.2);
      } else shadow(c, BX, BY + 27, 24, 6);
      const ball = () => {
        c.save(); c.translate(x, y); c.rotate(turn);
        gem(c, '#eef0f4', 0, 0, r, r * 0.93, { sides: 9, turn: 0.1, depth: 0.3 });
        // Creases.
        poly(c, '#d5dae4', [[-r * 0.65, -r * 0.2], [-r * 0.05, r * 0.05], [-r * 0.45, r * 0.5]]);
        poly(c, '#ffffff', [[-r * 0.1, -r * 0.7], [r * 0.45, -r * 0.25], [-r * 0.05, r * 0.05]]);
        poly(c, '#c3cad8', [[r * 0.1, r * 0.15], [r * 0.7, r * 0.1], [r * 0.25, r * 0.65]]);
        c.strokeStyle = 'rgba(60,72,100,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-r * 0.65, -r * 0.2); c.lineTo(-r * 0.05, r * 0.05); c.lineTo(r * 0.45, -r * 0.25); c.moveTo(-r * 0.05, r * 0.05); c.lineTo(r * 0.25, r * 0.65); c.stroke();
        c.restore();
      };
      if (inside) { c.save(); c.beginPath(); c.rect(0, 0, WIDTH, RIM); c.ellipse(g, RIM, w, lip, 0, 0, Math.PI); c.clip(); ball(); c.restore(); }
      front();

      // The desk fan.
      const fx = this.fanX, fy = 300;
      shadow(c, fx, 372, 30, 7, 0.3);
      block(c, '#3a4258', fx - 22, 360, 44, 10, 7); beam(c, '#59627a', fx, 362, fx, fy + 20, 9, 7);
      c.save(); c.translate(fx, fy); c.scale(0.86, 1);
      gem(c, '#aab4c8', 0, 0, 37, 37, { sides: 14, depth: 0.2 }); gem(c, '#2f374b', 0, 0, 32, 32, { sides: 14, depth: 0.12 });
      for (let n = 0; n < 3; n++) {
        const a = this.spin + n * 2.094;
        poly(c, '#6fb7e0', [[0, 0], [Math.cos(a - 0.5) * 29, Math.sin(a - 0.5) * 29], [Math.cos(a) * 30, Math.sin(a) * 30]]);
        poly(c, '#3f8fc0', [[0, 0], [Math.cos(a) * 30, Math.sin(a) * 30], [Math.cos(a + 0.45) * 25, Math.sin(a + 0.45) * 25]]);
      }
      c.strokeStyle = 'rgba(220,228,242,.55)'; c.lineWidth = 1.3; c.beginPath();
      for (let n = 0; n < 8; n++) { c.moveTo(0, 0); c.lineTo(Math.cos(n * 0.785) * 34, Math.sin(n * 0.785) * 34); }
      c.stroke(); c.beginPath(); c.arc(0, 0, 21, 0, Math.PI * 2); c.stroke();
      gem(c, '#e4572e', 0, 0, 7.5, 7.5, { sides: 9 }); c.restore();
      // Ribbons tied to the cage point downwind.
      for (const k of [-14, 12]) {
        const tip = 16 + force * 26, wave = Math.sin(this.now * (8 + force * 14) + k) * 4;
        poly(c, '#ffd45c', [[fx + way * 30, fy + k - 3], [fx + way * (30 + tip), fy + k + wave + (1 - force) * 12], [fx + way * 30, fy + k + 3]]);
      }

      if (!inside) ball();
      if (!this.kick) words(c, 'Flick the paper in. Mind the fan.', BX, 508, 15, '#ffffff', '#6a4527');
    },
  });
}

export const GAMES = {
  cactus: { title: 'Cactus Hop', how: 'Jump cactuses. Stay down for buzzards.', make: cactus },
  ski: { title: 'Downhill Dash', how: 'Drag to steer. Clean runs score more.', make: ski },
  turkey: { title: 'Flappy Turkey', how: 'Tap to flap through the gaps.', make: turkey },
  hoops: { title: 'Hot Shot', how: 'Flick the ball at the moving hoop.', make: hoops },
  stack: { title: 'Stack Up', how: 'Tap to stack. A miss or too thin costs 10.', make: stack },
  pies: { title: 'Pie Catch', how: 'Catch pies. Dodge burnt ones and lit fuses.', make: pies },
  bonk: { title: 'Critter Bonk', how: 'Tap the gophers. Spare the bunnies.', make: bonk },
  copycat: { title: 'Copy Cat', how: 'Watch the pattern, then tap it back.', make: copycat },
  derby: { title: 'Home Run Derby', how: 'Tap to swing as the ball arrives.', make: derby },
  // Began life as a field goal; the id stays so phones already in a party don't trip over a new one.
  fieldgoal: { title: 'Wastebasket Toss', how: 'Flick paper into the bin. Mind the fan.', make: fieldgoal },
};
export const STEP = 1 / 120;
// A game ready to play, optionally joined part way through (earlier points don't count).
export function create(id, seed, from = 0) {
  const game = GAMES[id].make(random(seed));
  let time = 0;
  game.advance = to => { while (time < Math.min(to, SECONDS)) { time += STEP; game.update(STEP, time); } };
  // The board, shaken if something just hit, with flying bits and messages on top.
  game.paint = c => { c.save(); c.translate(...game.fx.offset(game.now)); game.draw(c); game.fx.draw(c, game.now); c.restore(); };
  if (from > 0) { game.advance(from); game.score = 0; game.fx.clear(); if (id === 'ski') { game.stunned = 0; game.clean = from; game.times = 1; } if (id === 'turkey') { game.y = 250; game.v = 0; } game.restart?.(from); }
  return game;
}
