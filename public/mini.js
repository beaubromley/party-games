// Practice: any mini game on its own, or all ten in a row. No room needed, nothing saved but your best.
import { el, homeLink } from './ui.js';
import { play } from './sound.js';
import { keepAwake } from './wake.js';
import { count, covered, stopCount } from './count.js';
import { GAMES } from './minigames.js';
import { player, seconds } from './mini-player.js';

const app = document.getElementById('app');
const IDS = Object.keys(GAMES);
let running, timer;
const best = id => { try { return Number(localStorage.getItem(`best:${id}`)) || 0; } catch { return 0; } };

function stop() { running?.stop(); running = null; clearTimeout(timer); clearInterval(timer); stopCount(); document.body.classList.remove('playing'); }
function menu() {
  stop();
  app.replaceChildren(homeLink(), el('h1', {}, 'Mini Games'), el('p', {}, `Practice on this phone. Every game lasts ${seconds()} seconds.`),
    el('button', { className: 'big', onclick: () => start(IDS[0], true) }, 'Play all 10 in a row'),
    ...IDS.map(id => el('button', { className: 'big alt pickmini', onclick: () => start(id) }, GAMES[id].title, el('small', {}, `${GAMES[id].how}${best(id) ? ` Best: ${best(id)}` : ''}`))));
}
function start(id, row = false) {
  stop();
  keepAwake();
  count(GAMES[id].title);
  const wait = covered();
  document.body.classList.add('playing');
  const screen = el('div', { className: 'arcade' }, el('p', { className: 'bar' }, el('b', {}, GAMES[id].how), el('button', { onclick: menu }, 'Close')));
  app.replaceChildren(screen);
  running = player({ id, seed: Math.floor(Math.random() * 2 ** 31), startAt: Date.now() + wait, onEnd: points => over(id, points, row) });
  screen.append(running.node);
}
function over(id, points, row) {
  const record = points > best(id);
  if (record) try { localStorage.setItem(`best:${id}`, points); } catch {}
  play('ding');
  stop();
  const next = IDS[(IDS.indexOf(id) + 1) % IDS.length], last = row && next === IDS[0];
  const countdown = el('p', { role: 'status' });
  app.replaceChildren(el('h1', {}, GAMES[id].title), el('p', { className: 'ready' }, `Score: ${points}`), el('p', {}, record ? 'A new best!' : `Your best: ${best(id)}`),
    row && !last && countdown,
    el('button', { className: 'big', onclick: () => start(next, row && !last) }, `Next: ${GAMES[next].title}`),
    el('button', { className: 'big alt', onclick: () => start(id, row) }, 'Play again'),
    el('button', { className: 'big alt', onclick: menu }, 'All mini games'));
  if (row && !last) {
    let left = 10;
    const tick = () => { countdown.textContent = `Next game in ${left}s`; if (!left--) { clearInterval(timer); start(next, true); } };
    tick(); timer = setInterval(tick, 1000);
  }
}
menu();
