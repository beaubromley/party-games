// Two-team scoreboard shared by the one-phone games. Saved on this phone until reset.
import { el, podium, ask, WINNER_AT } from './ui.js';
import { play } from './sound.js';
let scores = [0, 0];
try { const saved = JSON.parse(localStorage.getItem('teams')); if (saved?.length === 2 && saved.every(Number.isInteger)) scores = saved; } catch {}

// Pass the points just earned to offer "give them to a team", which works once per round.
export function scoreboard(points = 0) {
  const box = el('section', { className: 'teams' });
  let pending = points;
  const change = (team, by) => {
    scores[team] = Math.max(0, scores[team] + by);
    try { localStorage.setItem('teams', JSON.stringify(scores)); } catch {}
    draw();
  };
  const reset = () => { change(0, -scores[0]); change(1, -scores[1]); };
  // The final standings, until they start over or go back to playing.
  const finish = () => { play('drumroll', 0.1); play('fanfare', WINNER_AT); celebrate(); };
  const celebrate = () => box.replaceChildren(
    el('p', { className: 'question verdict' }, scores[0] === scores[1] ? "It's a tie!" : `Team ${scores[0] > scores[1] ? 1 : 2} wins!`),
    podium(scores.map((score, i) => ({ name: `Team ${i + 1}`, score }))),
    el('button', { className: 'wide', onclick: () => { pending = 0; reset(); } }, 'New game'),
    el('button', { className: 'wide', onclick: () => draw() }, 'Keep playing'),
    el('a', { className: 'wide', href: '/' }, '← All Games'));
  const draw = () => box.replaceChildren(
    ...scores.map((score, i) => el('div', { className: 'team' },
      el('h2', {}, `Team ${i + 1}`), el('output', {}, String(score)),
      pending > 0 && el('button', { className: 'award', onclick: () => { const n = pending; pending = 0; change(i, n); } }, `Add ${points}`),
      el('div', { className: 'adjust' },
        el('button', { ariaLabel: `Team ${i + 1} minus one`, onclick: () => change(i, -1) }, '-1'),
        el('button', { ariaLabel: `Team ${i + 1} plus one`, onclick: () => change(i, 1) }, '+1')))),
    (scores[0] || scores[1]) ? el('button', { className: 'wide end', onclick: finish }, 'End game: show winner') : '',
    el('button', { className: 'wide reset', onclick: async () => {
      if (await ask('Reset team scores?', 'Both teams go back to zero.', 'Reset scores')) reset();
    } }, 'Reset scores'));
  draw();
  return box;
}
