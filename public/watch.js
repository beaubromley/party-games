// Follows a Quick Draw on a second phone.
import { el, homeLink } from './ui.js';
import { picture } from './canvas.js';
import { api } from './cast.js';
import { keepAwake } from './wake.js';

const app = document.getElementById('app');
const note = el('p', { className: 'note error', role: 'status' });
let code = '', version = 0, timer, ends = 0, run = 0;
const clock = el('p', { className: 'timer', role: 'timer', hidden: true });
setInterval(() => {
  clock.hidden = !ends;
  if (ends) clock.textContent = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
}, 250);

const back = () => homeLink('Quick Draw', '/draw.html');
function form(message = '') {
  run++; clearTimeout(timer); ends = 0; note.textContent = message;
  const input = el('input', { maxLength: 4, placeholder: 'Watch code', autocomplete: 'off', autocapitalize: 'characters', value: code });
  app.replaceChildren(back(), el('h1', {}, 'Watch a Drawing'),
    el('form', { onsubmit: e => { e.preventDefault(); watch(input.value); } }, input, el('button', { className: 'big' }, 'Watch')), note);
}
function show(data) {
  ends = data.seconds === undefined ? 0 : Date.now() + data.seconds * 1000;
  const words = { waiting: 'Waiting for the next drawing…', drawing: 'Shout your guesses!', done: `It was “${data.word}”` };
  app.replaceChildren(back(), el('p', { className: 'question' }, words[data.status]), clock,
    data.status === 'waiting' ? '' : picture(data.strokes), note, el('p', { className: 'fine' }, `Watching ${code}`));
}
function watch(value) {
  code = value.toUpperCase().trim(); version = 0; note.textContent = '';
  const mine = ++run;
  keepAwake();
  const poll = async () => {
    clearTimeout(timer);
    try {
      const data = await api({ action: 'cast-watch', code, version });
      if (mine !== run) return;
      history.replaceState(null, '', `?code=${code}`);
      note.textContent = '';
      if (data.status) show(data);
      version = data.version;
    } catch (err) {
      if (mine !== run) return;
      if (err.status === 400) return form(err.message);
      note.textContent = 'Reconnecting…';
    }
    timer = setTimeout(poll, 700);
  };
  poll();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && version) watch(code); });
const asked = new URLSearchParams(location.search).get('code');
if (asked) { code = asked.toUpperCase(); form(); watch(asked); } else form();
