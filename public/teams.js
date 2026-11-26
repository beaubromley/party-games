// Two-team scoreboard shared by the one-phone games. Saved on this phone until reset.
import { el } from './ui.js';
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
  const draw = () => box.replaceChildren(
    ...scores.map((score, i) => el('div', { className: 'team' },
      el('h2', {}, `Team ${i + 1}`), el('output', {}, String(score)),
      pending > 0 && el('button', { className: 'award', onclick: () => { const n = pending; pending = 0; change(i, n); } }, `Add ${points}`),
      el('div', { className: 'adjust' },
        el('button', { ariaLabel: `Team ${i + 1} minus one`, onclick: () => change(i, -1) }, '-1'),
        el('button', { ariaLabel: `Team ${i + 1} plus one`, onclick: () => change(i, 1) }, '+1')))),
    el('button', { className: 'reset', onclick: () => {
      if (!confirm('Reset both team scores to zero?')) return;
      change(0, -scores[0]); change(1, -scores[1]);
    } }, 'Reset scores'));
  draw();
  return box;
}
