import { el, homeLink, enterScreen } from './ui.js';
import { sketchpad } from './canvas.js';
import { shuffle } from './game.js';
import { QUICK_WORDS } from './words.js';
import { scoreboard } from './teams.js';
import { keepAwake } from './wake.js';
import { play, soundOn, setSound } from './sound.js';
import { sharing, startSharing, stopSharing, share, whenEnded } from './cast.js';

keepAwake();

const app = document.getElementById('app');
let pile = [], timer;
const show = (...nodes) => { app.replaceChildren(...nodes); scrollTo(0, 0); enterScreen(app); };
const soundLabel = () => `Sound: ${soundOn() ? 'on' : 'off'}`;
const button = (label, onclick, extra = '') => el('button', { className: 'big ' + extra, onclick }, label);

// Lets everyone else follow along on their own phones.
function watchBox(message, points) {
  const session = sharing(), status = el('p', { className: 'note error', role: 'status' });
  if (!session) return el('div', {}, button('Let others watch on their phones', async e => {
    e.target.disabled = true;
    try { await startSharing(); ready(message, 0); } catch (err) { status.textContent = err.message; e.target.disabled = false; }
  }, 'alt'), status);
  const link = `${location.origin}/watch.html?code=${session.code}`;
  return el('div', {}, el('p', {}, 'Watch code (on the home screen, tap Watch Quick Draw)'), el('p', { className: 'code' }, session.code),
    button('Share watch link', async () => {
      try { navigator.share ? await navigator.share({ url: link }) : (await navigator.clipboard.writeText(link), status.textContent = 'Link copied'); } catch {}
    }, 'alt'),
    button('Stop sharing', () => { stopSharing(); ready(message, 0); }, 'alt'), status);
}
function ready(message, points = 0) {
  clearTimeout(timer);
  show(homeLink(), el('h1', {}, 'Quick Draw'), message && el('p', { className: 'question' }, message),
    scoreboard(points), el('p', {}, 'Hand the phone to the drawer. No letters or numbers!'),
    button('Show my word', reveal), watchBox(message, points), el('button', { className: 'sound', onclick: e => { setSound(!soundOn()); e.target.textContent = soundLabel(); } }, soundLabel()), textSizeButton());
}
function reveal() {
  share({ status: 'waiting', strokes: [] });
  if (!pile.length) pile = shuffle(QUICK_WORDS);
  const word = pile.pop();
  show(el('p', {}, 'Only the drawer looks'), el('h1', {}, word), button('Start drawing (60s)', () => countdown(word)), button('Different word', reveal, 'alt'));
}
function countdown(word, n = 3) {
  if (!n) return draw(word);
  const number = el('p', { className: 'countdown', role: 'status' }, String(n));
  show(el('p', { className: 'ready' }, 'Get ready to draw'), number);
  play('tick');
  number.animate?.([{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 350, easing: 'ease-out' });
  timer = setTimeout(() => countdown(word, n - 1), 800);
}
function draw(word) {
  const pad = sketchpad(), clock = el('h1', {}, '60'), end = Date.now() + 60000;
  const done = got => {
    share({ status: 'done', strokes: pad.strokes(), word });
    ready(`${got ? 'Got it!' : "Time's up or skipped."} The word was “${word}”.`, got ? 1 : 0);
  };
  let sent = '', sentAt = 0;
  const stream = left => {
    const strokes = pad.strokes(), mark = `${strokes.length}:${strokes.reduce((n, s) => n + s[2].length, 0)}`;
    if (mark === sent || Date.now() - sentAt < 600) return;
    sent = mark; sentAt = Date.now();
    share({ status: 'drawing', strokes: structuredClone(strokes), seconds: left });
  };
  show(clock, ...pad.nodes, button('They got it!', () => done(true)), button('Give up', () => done(false), 'alt'));
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0) { play('buzz'); return done(false); }
    if (left <= 5 && clock.textContent !== String(left)) play('tick');
    clock.textContent = left; stream((end - Date.now()) / 1000); timer = setTimeout(tick, 200);
  };
  tick();
}
whenEnded(() => { if (app.querySelector('.teams')) ready(); });
share({ status: 'waiting', strokes: [] }); // also notices if an old watch code has expired
ready();
