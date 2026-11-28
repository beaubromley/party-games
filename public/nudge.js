// Pokes and notes. Players who are done get a panel; the person they pick gets a pop-up.
// Both live outside the redrawn screen content, so nothing half-typed or half-drawn is lost.
import { el } from './ui.js';
import { play } from './sound.js';

const QUICK = ['Hurry up!', 'Tick tock...', "We're waiting!"];
const LINGER = 6000;

export function nudger(send) {
  const panel = el('section', { className: 'nudge', hidden: true });
  const stack = el('div', { className: 'pokes', role: 'alert' });
  document.body.append(stack);
  let to = '', writing = false, text = '', seen = null, shape = '', targets = [], notes = false;
  let queue = [], timer, readyAt = 0, ticker;
  const names = el('div', { className: 'chips', role: 'group', ariaLabel: 'Who to pester' });
  const actions = el('div', { className: 'chips quick' });
  const compose = el('div');
  const status = el('p', { className: 'fine', role: 'status' });
  const wait = el('p', { className: 'fine wait', hidden: true });
  panel.append(el('h2', {}, 'Pester one slowpoke'), names, actions, compose, wait, status,
    el('p', { className: 'fine' }, 'If a TV screen is connected, it shows pokes and notes too.'));

  // After sending one, the buttons rest until the server will take another.
  function rest() {
    const left = Math.ceil((readyAt - Date.now()) / 1000);
    wait.hidden = left <= 0;
    wait.textContent = left > 0 ? `Next poke in ${left}s` : '';
    for (const b of panel.querySelectorAll('.quick button, form button')) b.disabled = left > 0 && !b.dataset.free;
    if (left <= 0) { clearInterval(ticker); ticker = undefined; }
  }
  function cool(ms) {
    readyAt = ms > 0 ? Date.now() + ms : 0;
    if (ms > 0) ticker ??= setInterval(rest, 500);
    rest();
  }
  async function fire(message) {
    const who = targets.find(t => t.id === to)?.name;
    status.textContent = '';
    try { await send({ action: 'poke', to, text: message }); status.textContent = `Sent to ${who}.`; return true; }
    catch (err) { status.textContent = err.message; return false; }
  }
  function drawNames() {
    if (!targets.some(t => t.id === to)) to = targets[0]?.id ?? '';
    names.replaceChildren(...targets.map(t => el('button', { className: t.id === to ? 'on' : '', ariaPressed: t.id === to,
      onclick: () => { to = t.id; drawNames(); } }, t.name)));
  }
  function drawActions() {
    const writer = notes && el('button', { ariaExpanded: writing, onclick: () => { writing = !writing; drawActions(); drawCompose(); compose.querySelector('input')?.focus(); } }, 'Write a note');
    if (writer) writer.dataset.free = '1'; // writing can start while resting
    actions.replaceChildren(...[
      el('button', { className: 'poke', onclick: () => fire('') }, 'Poke'),
      ...notes ? QUICK.map(q => el('button', { onclick: () => fire(q) }, q)) : [],
      writer,
    ].filter(Boolean));
    rest();
  }
  function drawCompose() {
    if (!writing || !notes) return compose.replaceChildren();
    const input = el('input', { value: text, maxLength: 60, placeholder: 'Your note', ariaLabel: 'Your note', autocomplete: 'off', enterKeyHint: 'send', oninput: () => { text = input.value; } });
    compose.replaceChildren(el('form', { onsubmit: async e => {
      e.preventDefault();
      if (Date.now() < readyAt) return;
      if (text.trim() && await fire(text)) { text = input.value = ''; }
    } }, input, el('button', { className: 'big alt' }, 'Send note')));
    rest();
  }

  // On a drawing screen the pop-up goes in the space kept above the canvas, so it never covers the picture.
  function place() {
    const home = document.querySelector('.pokeslot') ?? document.body;
    if (stack.parentElement !== home) home.append(stack);
  }
  // One pop-up at a time. The rest wait underneath, newest last.
  function showNext() {
    clearTimeout(timer);
    place();
    const p = queue[0];
    if (!p) return stack.replaceChildren();
    const more = queue.length - 1;
    const next = () => { queue.shift(); showNext(); };
    stack.replaceChildren(el('button', { className: 'popup' + (more ? ' piled' : ''), ariaLabel: 'Dismiss', onclick: next },
      el('b', {}, p.text ? `${p.from} says:` : `${p.from} poked you!`), p.text && el('span', {}, p.text),
      el('small', {}, more ? `Tap for the next one (${more} more)` : 'Tap to dismiss')));
    timer = setTimeout(next, LINGER);
  }
  const clear = () => { queue = []; showNext(); };

  return {
    panel,
    update(state) {
      // Pop-ups: only new ones, and none once you've finished.
      const pokes = state.pokes ?? [];
      const fresh = seen === null ? [] : pokes.filter(p => p.n > seen);
      seen = Math.max(seen ?? 0, ...pokes.map(p => p.n));
      if (state.nudge || state.pokesOff || !state.pokes) clear();
      else if (fresh.length) {
        const idle = !queue.length;
        queue = [...queue, ...fresh].slice(-6);
        if (idle) showNext();
        else { const more = stack.querySelector('small'); if (more) { more.textContent = `Tap for the next one (${queue.length - 1} more)`; more.parentElement.classList.add('piled'); } place(); }
        play('poke', 0, state.you === state.host);
      } else if (queue.length) place();
      panel.hidden = !state.nudge;
      if (!state.nudge) { shape = ''; writing = false; return; }
      cool(state.pokeWait);
      const screen = `${state.game}:${state.step}`;
      const next = `${screen}:${state.canNote}:${state.nudge.map(t => t.id + t.name).join()}`;
      if (next === shape) return;
      const newScreen = !shape.startsWith(`${screen}:`);
      shape = next; targets = state.nudge; notes = state.canNote;
      drawNames();
      // The note box is only rebuilt between screens, so typing isn't interrupted when someone finishes.
      if (newScreen) { to = targets[0]?.id ?? ''; writing = false; status.textContent = ''; drawNames(); drawActions(); drawCompose(); }
    },
    reset() { seen = null; shape = ''; text = ''; writing = false; panel.hidden = true; clear(); cool(0); },
  };
}
