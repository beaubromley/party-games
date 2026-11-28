// Mini games while you wait: everyone waiting plays the same 30 seconds, then sees all the scores.
// It lives outside the redrawn screen, and disappears the moment the real game needs you.
import { el } from './ui.js';
import { play } from './sound.js';
import { GAMES } from './minigames.js';
import { player, seconds } from './mini-player.js';

const JOIN_WITH = 15; // seconds that must be left to jump into a round already going
const store = { get: () => { try { return localStorage.getItem('arcade') === 'on'; } catch { return false; } }, set: on => { try { localStorage.setItem('arcade', on ? 'on' : 'off'); } catch {} } };

export function arcade(send) {
  const panel = el('section', { className: 'arcadecall', hidden: true });
  const open = el('button', { className: 'big alt', onclick: () => { wanted = true; store.set(true); closedHere = false; show(); } });
  const winsNote = el('p', { className: 'fine' });
  panel.append(open, winsNote);
  const body = el('div'), title = el('b', {}, 'Mini games');
  const box = el('div', { className: 'arcade', role: 'dialog', ariaLabel: 'Mini games' },
    el('p', { className: 'bar' }, title, el('button', { onclick: () => { wanted = false; store.set(false); closedHere = true; close(); } }, 'Close')), body);
  let wanted = store.get(), closedHere = false, state, mini, startAt = 0, endAt = 0, running = null, loop, asked = 0, shape = '';
  const done = new Set(); // rounds this phone has finished

  function close() { clearInterval(loop); loop = undefined; running?.stop(); running = null; shape = ''; box.remove(); document.body.classList.remove('playing'); }
  function show() {
    if (box.isConnected) return;
    document.body.append(box); document.body.classList.add('playing');
    loop = setInterval(frame, 200);
    frame();
  }
  const scores = list => list?.length ? el('ol', { className: 'miniscores' }, list.map(s => el('li', { className: s.id === state.you ? 'me' : '' }, `${s.name}: ${s.score}`))) : el('p', { className: 'fine' }, 'Scores on the way...');
  // Redraws a waiting screen only when what it says changes.
  function say(key, ...nodes) { if (key !== shape) { shape = key; body.replaceChildren(...nodes.flat().filter(Boolean)); } }
  async function ask() {
    if (Date.now() - asked < 1500) return;
    asked = Date.now();
    try { await send({ action: 'mini' }); } catch {}
  }
  async function finish(n, points) {
    done.add(n); running = null; shape = '';
    play('ding');
    for (let tries = 0; tries < 3; tries++) {
      try { await send({ action: 'miniscore', n, score: points }); return; } catch { await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  function frame() {
    if (!mini) return;
    const now = Date.now(), n = mini.n;
    if (running && running.n !== n && now < running.until) { running.stop(); running = null; shape = ''; } // cancelled
    if (running) return;
    if (n === undefined || now >= endAt + 6500) ask();
    if (n === undefined) return say('setup', el('p', { className: 'ready' }, 'Setting up the next game...'));
    const game = GAMES[mini.game], left = Math.ceil((endAt - now) / 1000), until = Math.ceil((startAt - now) / 1000);
    if (until > 0) {
      const last = mini.last;
      return say(`wait:${n}:${until}:${JSON.stringify(last?.scores)}`,
        last && [el('h2', {}, `${GAMES[last.game].title} results`), scores(last.scores)],
        el('p', { className: 'ready' }, 'Next up'), el('h1', {}, game.title), el('p', {}, game.how), el('p', { className: 'countdown small' }, String(until)));
    }
    if (left > 0 && !done.has(n) && left >= Math.min(JOIN_WITH, seconds() / 2)) {
      const round = player({ id: mini.game, seed: mini.seed, startAt: endAt - seconds() * 1000, onEnd: points => finish(n, points) });
      running = Object.assign(round, { n, until: endAt });
      shape = `play:${n}`;
      return body.replaceChildren(round.node);
    }
    const waitFor = Math.max(1, Math.ceil((endAt + 10000 - now) / 1000));
    say(`over:${n}:${left > 0 ? left : waitFor}:${JSON.stringify(mini.scores)}`,
      el('h2', {}, left > 0 ? (done.has(n) ? 'Finishing up' : `${game.title} is under way`) : `${game.title} results`),
      scores(mini.scores),
      el('p', {}, left > 0 ? `You're in the next one. ${left}s to go.` : `Next game in ${waitFor}s`),
      mini.wins.length > 0 && el('p', { className: 'fine' }, `Round wins: ${mini.wins.map(w => `${w.name} ${w.wins}`).join(', ')}`));
  }

  return {
    panel,
    update(next) {
      if (next === state) return;
      const before = state; state = next;
      if (!next.mini) { mini = undefined; panel.hidden = true; closedHere = false; return close(); }
      mini = next.mini;
      if (mini.n !== undefined) { startAt = Date.now() + mini.startsIn; endAt = Date.now() + mini.endsIn; }
      panel.hidden = false;
      open.textContent = next.phase === 'lobby' ? 'Play mini games together' : 'Play mini games while you wait';
      winsNote.textContent = mini.wins.length ? `Mini game round wins: ${mini.wins.map(w => `${w.name} ${w.wins}`).join(', ')}` : '30 seconds a round. Most round wins takes a trophy.';
      // Once someone has chosen to play, it opens by itself the next time they're left waiting during a game.
      if (wanted && !closedHere && next.phase !== 'lobby' && !before?.mini) show();
      if (box.isConnected) frame();
    },
    reset() { state = mini = undefined; done.clear(); panel.hidden = true; close(); },
  };
}
