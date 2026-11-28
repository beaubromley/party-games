// The Group Doodle screen: a shared canvas that fills up with everyone's lines as they draw them.
import { el } from './ui.js';
import { play } from './sound.js';
import { savePicture } from './save.js';
import { DOODLE_COLORS, picture, paintStroke } from './canvas.js';

const EVERY = 600; // how often lines are swapped between phones
const wait = ms => new Promise(done => setTimeout(done, ms));
export const legend = painters => el('p', { className: 'painters' }, painters.map(p => {
  const swatch = el('i'); swatch.style.background = DOODLE_COLORS[p.color];
  return el('span', {}, swatch, p.name);
}));

// Collects every stroke of a round, a page at a time.
export async function everything(fetchSince) {
  const all = [];
  for (let after = 0, more = true; more;) {
    const data = await fetchSince(after);
    all.push(...data.strokes); after = data.last; more = data.more;
  }
  return all;
}

export function groupDoodle({ send, ask, onOpen }) {
  const open = el('button', { className: 'big alt', onclick: () => begin() });
  const again = el('button', { className: 'big alt', onclick: () => { closed = 0; show(); } }, 'See the last doodle');
  const note = el('p', { className: 'fine', role: 'status' });
  const panel = el('section', { className: 'doodlecall', hidden: true }, open, note, again);
  const body = el('div');
  const box = el('div', { className: 'arcade doodle', role: 'dialog', ariaLabel: 'Group Doodle' },
    el('p', { className: 'bar' }, el('b', {}, 'Group Doodle'), el('button', { onclick: () => { closed = round?.n; close(); } }, 'Close')), body);
  let state, round, startAt = 0, endAt = 0, session = null, closed = 0, seen = null, over;
  function labels() {
    const running = Date.now() < endAt;
    open.textContent = running ? 'Join the Group Doodle' : 'Group Doodle: everyone draws';
    note.textContent = running ? `${round.by} started one.` : '';
    again.hidden = running;
  }

  async function begin() {
    closed = 0; note.textContent = '';
    if (round && Date.now() < endAt) return show();
    try { await send({ action: 'doodle-start' }); } catch (err) { note.textContent = err.message; }
  }
  function close() { session = null; box.remove(); document.body.classList.remove('playing'); }

  function show() {
    if (!round || session?.n === round.n) return;
    onOpen?.();
    const me = round.painters.find(p => p.id === state.you), n = round.n;
    const live = session = { n, queue: [], stroke: null };
    const canvas = el('canvas', { width: 1000, height: 1000, className: 'shared', ariaLabel: 'Everyone’s picture' });
    const ctx = canvas.getContext('2d');
    const clock = el('b', { className: 'doodleclock', role: 'timer' });
    const who = el('div'), foot = el('div');
    let width = 10;
    const sizes = el('div', { className: 'tools brushes', role: 'group', ariaLabel: 'Brush size' });
    sizes.append(...[['Thin', 10], ['Thick', 30]].map(([name, w], i) => el('button', { type: 'button', className: i ? '' : 'on', ariaPressed: !i,
      onclick: () => { width = w; [...sizes.children].forEach((b, j) => { b.classList.toggle('on', i === j); b.ariaPressed = i === j; }); } }, name)));
    const mine = el('p', { className: 'yourcolor' });
    if (me) { const swatch = el('i'); swatch.style.background = DOODLE_COLORS[me.color]; mine.append('Your color ', swatch); }
    body.replaceChildren(el('h2', {}, round.prompt), el('p', { className: 'doodlehud' }, mine, clock), canvas, foot, who);
    foot.append(sizes);
    who.append(legend(round.painters));
    if (!box.isConnected) document.body.append(box);
    document.body.classList.add('playing');

    const drawing = () => session === live && Date.now() >= startAt && Date.now() < endAt;
    const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top].map((v, i) => Math.max(0, Math.min(1000, Math.round(v / (i ? r.height : r.width) * 1000)))); };
    // A long line is passed on in pieces, so others see it grow.
    const cut = () => {
      const s = live.stroke;
      if (!s || s.points.length <= s.sent) return;
      live.queue.push([s.width, s.points.slice(Math.max(0, s.sent - 2), s.sent + 396)]);
      s.sent = Math.min(s.points.length, s.sent + 396);
    };
    canvas.onpointerdown = e => {
      if (!me || live.stroke || !drawing()) return;
      e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
      live.stroke = { id: e.pointerId, width, points: at(e), sent: 0 };
      paintStroke(ctx, [me.color, width, live.stroke.points], DOODLE_COLORS);
    };
    canvas.onpointermove = e => {
      const s = live.stroke;
      if (s?.id !== e.pointerId || !drawing()) return;
      const [x, y] = at(e), px = s.points.at(-2), py = s.points.at(-1);
      if (Math.hypot(x - px, y - py) < 6) return;
      paintStroke(ctx, [me.color, s.width, [px, py, x, y]], DOODLE_COLORS);
      s.points.push(x, y);
      if (s.points.length - s.sent >= 396) cut();
    };
    const lift = () => { while (live.stroke && live.stroke.points.length > live.stroke.sent) cut(); live.stroke = null; };
    canvas.onpointerup = canvas.onpointercancel = e => { if (live.stroke?.id === e.pointerId) lift(); };

    const tick = setInterval(() => {
      if (session !== live) return clearInterval(tick);
      const now = Date.now(), until = Math.ceil((startAt - now) / 1000), left = Math.max(0, Math.ceil((endAt - now) / 1000));
      clock.textContent = until > 0 ? `Starts in ${until}` : left ? `${left}s` : "Time's up!";
      if (now >= endAt) clearInterval(tick);
    }, 200);

    (async () => {
      let after = 0;
      while (session === live && Date.now() < endAt) {
        cut();
        const sending = live.queue.splice(0, 20);
        try {
          const data = await ask({ action: 'doodle-sync', n, after, strokes: sending });
          if (data.over) return;
          for (const s of data.strokes) paintStroke(ctx, s, DOODLE_COLORS);
          after = data.last;
        } catch { live.queue.unshift(...sending); }
        await wait(Date.now() < startAt ? Math.min(startAt - Date.now(), 1000) : window.doodleStep ?? EVERY);
      }
      if (session !== live) return;
      // Time: send what's left, give the slow phones a moment, then show everyone the same finished picture.
      lift(); foot.replaceChildren(el('p', {}, 'Collecting the last strokes...'));
      for (let tries = 0; tries < 4 && live.queue.length; tries++) {
        const sending = live.queue.splice(0, 20);
        try { await ask({ action: 'doodle-sync', n, after, strokes: sending }); } catch { live.queue.unshift(...sending); await wait(800); }
      }
      await wait(window.doodleStep ? 600 : 2500);
      let all;
      for (let tries = 0; !all && tries < 4 && session === live; tries++) {
        try { all = await everything(from => ask({ action: 'doodle-sync', n, after: from })); } catch { await wait(1200); }
      }
      if (session !== live) return;
      if (!all) return foot.replaceChildren(el('p', {}, 'Couldn’t fetch the finished picture.'));
      ctx.clearRect(0, 0, 1000, 1000); all.forEach(s => paintStroke(ctx, s, DOODLE_COLORS));
      play('fanfare');
      clock.textContent = 'Finished!'; mine.replaceChildren('The masterpiece');
      foot.replaceChildren(
        el('button', { className: 'big', onclick: () => savePicture([{ text: round.prompt, big: true }, { strokes: all, palette: DOODLE_COLORS }, { text: `By ${round.painters.map(p => p.name).join(', ')}` }], 'group-doodle') }, 'Save picture'),
        el('button', { className: 'big alt', onclick: () => { session = null; begin(); } }, 'Draw another'));
    })();
  }

  return {
    panel,
    update(next) {
      if (next === state) return;
      state = next;
      const allowed = ['lobby', 'done'].includes(next.phase);
      panel.hidden = !allowed;
      round = allowed ? next.doodle : undefined;
      clearTimeout(over);
      if (!round) { seen = null; open.textContent = 'Group Doodle: everyone draws'; note.textContent = ''; again.hidden = true; return close(); }
      startAt = Date.now() + round.startsIn; endAt = Date.now() + round.endsIn;
      const running = round.endsIn > 0;
      labels();
      if (running) over = setTimeout(labels, round.endsIn + 100);
      // A new one opens on every phone in the room.
      if (seen !== round.n) { seen = round.n; if (running && closed !== round.n) show(); }
    },
    reset() { state = round = undefined; seen = null; closed = 0; panel.hidden = true; close(); },
  };
}
