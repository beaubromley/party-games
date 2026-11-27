// Pokes and notes. Players who are done get a panel; the people they pick get a pop-up.
// Both live outside the redrawn screen content, so nothing half-typed or half-drawn is lost.
import { el } from './ui.js';
import { play } from './sound.js';

const QUICK = ['Hurry up!', 'Tick tock...', "We're waiting!"];
const LINGER = 8000;

export function nudger(send) {
  const panel = el('section', { className: 'nudge', hidden: true });
  const stack = el('div', { className: 'pokes', role: 'alert' });
  document.body.append(stack);
  let to = 'all', writing = false, text = '', seen = null, shape = '', targets = [], notes = false;
  const names = el('div', { className: 'chips', role: 'group', ariaLabel: 'Who to pester' });
  const actions = el('div', { className: 'chips quick' });
  const compose = el('div');
  const status = el('p', { className: 'fine', role: 'status' });
  panel.append(el('h2', {}, 'Pester the slowpokes'), names, actions, compose, status);

  async function fire(message) {
    const who = to === 'all' ? 'everyone still going' : targets.find(t => t.id === to)?.name;
    status.textContent = '';
    try { await send({ action: 'poke', to, text: message }); status.textContent = `Sent to ${who}.`; return true; }
    catch (err) { status.textContent = err.message; return false; }
  }
  function drawNames() {
    if (!targets.some(t => t.id === to)) to = 'all';
    const list = targets.length > 1 ? [{ id: 'all', name: 'Everyone' }, ...targets] : targets;
    if (targets.length === 1) to = targets[0].id;
    names.replaceChildren(...list.map(t => el('button', { className: t.id === to ? 'on' : '', ariaPressed: t.id === to,
      onclick: () => { to = t.id; drawNames(); } }, t.name)));
  }
  function drawActions() {
    actions.replaceChildren(...[
      el('button', { className: 'poke', onclick: () => fire('') }, 'Poke'),
      ...notes ? QUICK.map(q => el('button', { onclick: () => fire(q) }, q)) : [],
      notes && el('button', { ariaExpanded: writing, onclick: () => { writing = !writing; drawActions(); drawCompose(); compose.querySelector('input')?.focus(); } }, 'Write a note'),
    ].filter(Boolean));
  }
  function drawCompose() {
    if (!writing || !notes) return compose.replaceChildren();
    const input = el('input', { value: text, maxLength: 60, placeholder: 'Your note', ariaLabel: 'Your note', autocomplete: 'off', enterKeyHint: 'send', oninput: () => { text = input.value; } });
    compose.replaceChildren(el('form', { onsubmit: async e => {
      e.preventDefault();
      if (text.trim() && await fire(text)) { text = input.value = ''; }
    } }, input, el('button', { className: 'big alt' }, 'Send note')));
  }
  function show(p) {
    const card = el('button', { className: 'popup', ariaLabel: 'Dismiss', onclick: () => card.remove() },
      el('b', {}, p.text ? `${p.from} says:` : `${p.from} poked you!`), p.text && el('span', {}, p.text), el('small', {}, 'Tap to dismiss'));
    stack.append(card);
    while (stack.children.length > 3) stack.firstChild.remove();
    setTimeout(() => card.remove(), LINGER);
  }

  return {
    panel,
    update(state) {
      // Pop-ups: only new ones, and none once you've finished.
      const pokes = state.pokes ?? [];
      const fresh = seen === null ? [] : pokes.filter(p => p.n > seen);
      seen = Math.max(seen ?? 0, ...pokes.map(p => p.n));
      if (state.nudge || !state.pokes) stack.replaceChildren();
      else if (fresh.length) {
        fresh.forEach(show);
        play('poke', 0, state.you === state.host);
      }
      panel.hidden = !state.nudge;
      if (!state.nudge) { shape = ''; writing = false; return; }
      const screen = `${state.game}:${state.step}`;
      const next = `${screen}:${state.canNote}:${state.nudge.map(t => t.id).join()}`;
      if (next === shape) return;
      const newScreen = !shape.startsWith(`${screen}:`);
      shape = next; targets = state.nudge; notes = state.canNote;
      drawNames();
      // The note box is only rebuilt between screens, so typing isn't interrupted when someone finishes.
      if (newScreen) { to = 'all'; writing = false; status.textContent = ''; drawNames(); drawActions(); drawCompose(); }
    },
    reset() { seen = null; shape = ''; text = ''; writing = false; panel.hidden = true; stack.replaceChildren(); },
  };
}
