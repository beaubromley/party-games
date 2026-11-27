import { el, homeLink } from './ui.js';
import { sketchpad } from './canvas.js';
import { shuffle } from './game.js';
import { QUICK_WORDS } from './words.js';
import { scoreboard } from './teams.js';
import { keepAwake } from './wake.js';
import { play, soundOn, setSound } from './sound.js';

keepAwake();

const app = document.getElementById('app');
let pile = [], timer;
const show = (...nodes) => { app.replaceChildren(...nodes); scrollTo(0, 0); };
const soundLabel = () => `Sound: ${soundOn() ? 'on' : 'off'}`;
const button = (label, onclick, extra = '') => el('button', { className: 'big ' + extra, onclick }, label);

function ready(message, points = 0) {
  clearTimeout(timer);
  show(homeLink(), el('h1', {}, 'Quick Draw'), message && el('p', { className: 'question' }, message),
    scoreboard(points), el('p', {}, 'Hand the phone to the drawer. No letters or numbers!'),
    button('Show my word', reveal), el('button', { className: 'sound', onclick: e => { setSound(!soundOn()); e.target.textContent = soundLabel(); } }, soundLabel()));
}
function reveal() {
  if (!pile.length) pile = shuffle(QUICK_WORDS);
  const word = pile.pop();
  show(el('p', {}, 'Only the drawer looks'), el('h1', {}, word), button('Start drawing (60s)', () => draw(word)), button('Different word', reveal, 'alt'));
}
function draw(word) {
  const pad = sketchpad(), clock = el('h1', {}, '60'), end = Date.now() + 60000;
  const done = got => ready(`${got ? 'Got it!' : "Time's up or skipped."} The word was “${word}”.`, got ? 1 : 0);
  show(clock, ...pad.nodes, button('They got it!', () => done(true)), button('Give up', () => done(false), 'alt'));
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0) { play('buzz'); return done(false); }
    if (left <= 5 && clock.textContent !== String(left)) play('tick');
    clock.textContent = left; timer = setTimeout(tick, 200);
  };
  tick();
}
ready();
