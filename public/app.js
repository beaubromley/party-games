import { tiltDetector, shuffle, roundSeconds } from './game.js';
import { scoreboard } from './teams.js';
import { soundOn, setSound } from './sound.js';

const $ = id => document.getElementById(id);
const piles = {};            // unused cards per deck, so rounds don't repeat
let seconds = 60, deck, history, current, timer, phase = 'idle', detect, audio, lock;

function show(id) {
  for (const s of ['home', 'preview', 'stage', 'results']) $(s).hidden = s !== id;
  if (id === 'home') $('homeTeams').replaceChildren(scoreboard());
  scrollTo(0, 0);
}

function beep(freq, dur = 0.15) {
  if (!audio || !soundOn()) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.2, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur);
}

const onTilt = e => { const a = detect(e.beta, e.gamma); if (a) answer(a); };

async function keepAwake() { try { lock = await navigator.wakeLock?.request('screen'); } catch {} }

async function start(d) {
  if (phase !== 'idle') return; // ignore double taps while the permission prompt is up
  phase = 'starting';
  deck = d;
  // iOS only grants motion access from inside a tap, so ask before anything else.
  const permission = window.DeviceOrientationEvent?.requestPermission?.();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx) { audio ??= new Ctx(); audio.resume(); }
  keepAwake();
  try { await permission; } catch {} // buttons still work if denied
  history = []; detect = tiltDetector(); phase = 'ready';
  show('stage'); $('controls').hidden = true; $('stage').className = '';
  addEventListener('deviceorientation', onTilt);
  let n = 3;
  const tick = () => {
    if (n === 0) return play();
    $('clock').textContent = 'Place on forehead'; $('card').textContent = n--; beep(440);
    timer = setTimeout(tick, 1000);
  };
  tick();
}

function play() {
  const end = Date.now() + seconds * 1000;
  $('controls').hidden = false; beep(880, 0.3); next();
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0) return finish();
    if ($('clock').textContent !== String(left) && left <= 5) beep(660, 0.08);
    $('clock').textContent = left;
    timer = setTimeout(tick, 200);
  };
  tick();
}

function next() {
  if (!piles[deck.id]?.length) piles[deck.id] = shuffle(deck.cards);
  current = piles[deck.id].pop();
  $('card').textContent = current; $('stage').className = ''; phase = 'play';
}

function answer(result) {
  if (phase !== 'play') return;
  phase = 'flash';
  history.push({ card: current, result }); current = null;
  $('stage').className = result;
  $('card').textContent = result === 'got' ? 'Got it!' : 'Pass';
  beep(result === 'got' ? 1200 : 220, 0.25);
  setTimeout(() => { if (phase === 'flash') next(); }, 700);
}

function stop() {
  phase = 'idle'; clearTimeout(timer); current = null;
  removeEventListener('deviceorientation', onTilt);
  lock?.release().catch(() => {}); lock = null;
}

function finish() {
  if (current) history.push({ card: current, result: 'pass' });
  stop(); beep(180, 0.8);
  const correct = history.filter(h => h.result === 'got').length;
  $('score').textContent = `${correct} correct`;
  $('teams').replaceChildren(scoreboard(correct));
  $('recap').replaceChildren(...history.map(h => {
    const li = document.createElement('li');
    li.textContent = h.card; if (h.result === 'pass') li.className = 'skipped';
    return li;
  }));
  show('results');
}

const mute = () => { $('mute').textContent = `Sound: ${soundOn() ? 'on' : 'off'}`; };
$('mute').onclick = () => { setSound(!soundOn()); mute(); };
mute();
$('mute').after(textSizeButton());
$('got').onclick = () => answer('got');
$('pass').onclick = () => answer('pass');
$('quit').onclick = () => { stop(); show('home'); };
$('again').onclick = () => start(deck);
$('back').onclick = () => show('home');
// Shows a sample, not the whole deck, so the round isn't spoiled.
function peek(d) {
  const make = (tag, props) => Object.assign(document.createElement(tag), props);
  const list = make('ul', { id: 'sample', className: 'samples' });
  list.append(...shuffle(d.cards).slice(0, 12).map(card => make('li', { textContent: card })));
  $('preview').replaceChildren(make('h1', { textContent: d.name }), make('p', { textContent: `12 of ${d.cards.length} cards` }), list,
    make('button', { className: 'big', textContent: 'Play this deck', onclick: () => start(d) }),
    make('button', { className: 'big alt', textContent: 'Back', onclick: () => show('home') }));
  show('preview');
}
function pickTime(value, chosen) {
  seconds = value;
  for (const b of $('times').querySelectorAll('button')) b.classList.toggle('on', b === chosen);
  try { localStorage.setItem('seconds', value); } catch {}
}
$('times').onclick = e => {
  if (!e.target.dataset.s) return;
  $('custom').value = '';
  pickTime(Number(e.target.dataset.s), e.target);
};
$('custom').oninput = () => { const n = roundSeconds($('custom').value); if (n) pickTime(n, null); };
$('custom').onchange = () => { if ($('custom').value) $('custom').value = seconds; };
try {
  const saved = roundSeconds(localStorage.getItem('seconds'));
  if (saved) {
    const preset = $('times').querySelector(`[data-s="${saved}"]`);
    if (!preset) $('custom').value = saved;
    pickTime(saved, preset);
  }
} catch {}
$('homeTeams').replaceChildren(scoreboard());
// A locked or backgrounded phone ends the round rather than silently burning the clock.
document.addEventListener('visibilitychange', () => { if (document.hidden && phase !== 'idle') { stop(); show('home'); } });

try {
  const decks = await (await fetch('/decks.json')).json();
  const groups = Map.groupBy ? Map.groupBy(decks, d => d.group) : decks.reduce((m, d) => m.set(d.group, [...(m.get(d.group) ?? []), d]), new Map());
  $('decks').replaceChildren(...[...groups].flatMap(([group, list]) => [
    Object.assign(document.createElement('h2'), { textContent: group }),
    ...list.map(d => Object.assign(document.createElement('button'), { textContent: d.name, onclick: () => $('peek').checked ? peek(d) : start(d) })),
  ]));
} catch { $('decks').textContent = "Couldn't load decks. Check your connection and reload."; }

navigator.serviceWorker?.register('/sw.js');
