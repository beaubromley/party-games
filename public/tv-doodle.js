// The Group Doodle on the big screen: the picture grows as the room draws.
import { el } from './ui.js';
import { DOODLE_COLORS, paintStroke } from './canvas.js';
import { legend } from './doodle.js';

const LINGER = 30000; // how long the finished picture stays up
export function mural(ask) {
  let box, running = null, timer;
  function stop() { running = null; clearTimeout(timer); box?.remove(); box = undefined; }
  return {
    update(round) {
      if (!round || round.endsIn < -LINGER) return stop();
      const startAt = Date.now() + round.startsIn, endAt = Date.now() + round.endsIn;
      clearTimeout(timer); timer = setTimeout(stop, round.endsIn + LINGER);
      if (running?.n === round.n) return running.who.replaceChildren(legend(round.painters));
      box?.remove();
      const canvas = el('canvas', { width: 1000, height: 1000, ariaLabel: 'Everyone’s picture' }), ctx = canvas.getContext('2d');
      const clock = el('p', { className: 'clock', role: 'timer' }), who = el('div', {}, legend(round.painters));
      box = el('div', { className: 'mural' }, canvas, el('div', {}, el('h2', {}, 'Group Doodle'), el('p', { className: 'question' }, round.prompt), clock, who,
        el('button', { onclick: () => box.remove() }, 'Back to the party')));
      document.body.append(box);
      const mine = running = { n: round.n, who };
      (async () => {
        let after = 0, last = false;
        while (running === mine && !last) {
          const now = Date.now(), until = Math.ceil((startAt - now) / 1000), left = Math.ceil((endAt - now) / 1000);
          clock.textContent = until > 0 ? `Starts in ${until}` : left > 0 ? `${left}s` : 'Finished!';
          last = now > endAt + 5000; // late strokes have landed by now
          try {
            if (last) { after = 0; }
            for (let more = true; more && running === mine;) {
              const data = await ask({ n: round.n, after });
              if (data.over) return;
              if (last && after === 0) ctx.clearRect(0, 0, 1000, 1000); // repaint in the order everyone else sees
              for (const s of data.strokes) paintStroke(ctx, s, DOODLE_COLORS);
              after = data.last; more = data.more;
            }
          } catch { last = false; }
          await new Promise(done => setTimeout(done, window.doodleStep ?? 700));
        }
      })();
    },
  };
}
