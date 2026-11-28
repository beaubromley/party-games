// A 3, 2, 1 across the whole screen before something new, like the one in Forehead.
import { el } from './ui.js';
import { play } from './sound.js';

const step = () => window.countStep ?? 800; // tests shorten it
let box, timer, ends = 0;

// How much longer the screen is covered, so results can wait to flip in.
export const covered = () => Math.max(0, ends - Date.now());
export function stopCount() { clearTimeout(timer); box?.remove(); box = undefined; ends = 0; }

export function count(title, sound = true) {
  stopCount();
  const number = el('p', { className: 'countdown' });
  // A tap skips it on this device.
  box = el('div', { className: 'count3', role: 'status', onclick: stopCount }, el('p', { className: 'ready' }, title), number);
  document.body.append(box);
  ends = Date.now() + 3 * step();
  const tick = n => {
    if (!n) return stopCount();
    number.textContent = n;
    play('tick', 0, sound);
    timer = setTimeout(tick, step(), n - 1);
  };
  tick(3);
}

// Which changes of screen get a countdown. Nothing on joining, or between pages of the same results.
const ACTIVE = ['writing', 'drawing', 'voting'];
export function cue(before, s) {
  if (!before || before === s.phase) return '';
  if (['lobby', 'done'].includes(before)) return ACTIVE.includes(s.phase) ? 'Get ready!' : '';
  if (s.phase === 'reveal') return 'Results in...';
  if (s.phase === 'done') return s.game === 'telephone' ? 'And the favorite is...' : 'And the winner is...';
  if (before === 'reveal' && ACTIVE.includes(s.phase)) return s.stage === 'danger' ? 'Danger round!' : 'Next up...';
  return '';
}
