import { tiltDetector, shuffle } from './game.js';

const $ = id => document.getElementById(id);
const piles = {};            // unused cards per deck, so rounds don't repeat
let seconds = 60, deck, history, current, timer, phase = 'idle', detect, audio, lock;

function show(id) { for (const s of ['home', 'stage', 'results']) $(s).hidden = s !== id; scrollTo(0, 0); }

function beep(freq, dur = 0.15) {
  if (!audio) return;
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
  $('score').textContent = `${history.filter(h => h.result === 'got').length} correct`;
  $('recap').replaceChildren(...history.map(h => {
    const li = document.createElement('li');
    li.textContent = h.card; if (h.result === 'pass') li.className = 'skipped';
    return li;
  }));
  show('results');
}

$('got').onclick = () => answer('got');
$('pass').onclick = () => answer('pass');
$('quit').onclick = () => { stop(); show('home'); };
$('again').onclick = () => start(deck);
$('back').onclick = () => show('home');
$('times').onclick = e => {
  if (!e.target.dataset.s) return;
  seconds = Number(e.target.dataset.s);
  for (const b of $('times').children) b.classList.toggle('on', b === e.target);
};
// A locked or backgrounded phone ends the round rather than silently burning the clock.
document.addEventListener('visibilitychange', () => { if (document.hidden && phase !== 'idle') { stop(); show('home'); } });

try {
  const decks = await (await fetch('/decks.json')).json();
  $('decks').replaceChildren(...decks.map(d => {
    const b = document.createElement('button'), icon = document.createElement('span');
    icon.textContent = d.emoji; b.append(icon, d.name); b.onclick = () => start(d);
    return b;
  }));
} catch { $('decks').textContent = "Couldn't load decks. Check your connection and reload."; }

navigator.serviceWorker?.register('/sw.js');
