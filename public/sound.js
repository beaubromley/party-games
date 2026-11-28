// Short synthesized effects, so there are no audio files to download.
let ctx;
const stored = () => { try { return localStorage.getItem('sound'); } catch { return null; } };
let choice = stored();
// `fallback` is used until this phone has chosen for itself.
export const soundOn = (fallback = true) => choice ? choice === 'on' : fallback;
export function setSound(on) {
  choice = on ? 'on' : 'off';
  try { localStorage.setItem('sound', choice); } catch {}
  if (on) unlock();
}
// iPhones only allow audio that was started by a tap.
function unlock() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ctx ??= new Ctx();
  if (ctx.state !== 'running') ctx.resume().then(tune, () => {});
  else tune();
}
addEventListener('pointerdown', unlock);
function tone(freq, at, length, type = 'triangle', volume = 0.18) {
  const o = ctx.createOscillator(), g = ctx.createGain(), start = ctx.currentTime + at;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(volume, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + length);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + length);
}
const EFFECTS = {
  turn: at => { tone(523, at, 0.12); tone(784, at + 0.1, 0.2); },
  poke: at => { [0, 0.16, 0.32].forEach(t => tone(740, at + t, 0.1, 'square', 0.12)); },
  ding: at => tone(988, at, 0.35, 'sine'),
  tick: at => tone(660, at, 0.07, 'square', 0.08),
  buzz: at => tone(150, at, 0.6, 'sawtooth', 0.15),
  drumroll: at => { for (let t = 0; t < 1.7; t += 0.06) tone(110 + (t % 0.12) * 200, at + t, 0.06, 'square', 0.03 + t * 0.04); },
  fanfare: at => { [523, 659, 784].forEach((f, i) => tone(f, at + i * 0.13, 0.18)); [523, 659, 784, 1047].forEach(f => tone(f, at + 0.42, 0.9, 'triangle', 0.1)); },
};
export function play(name, delay = 0, fallback = true) {
  if (ctx?.state === 'running' && soundOn(fallback)) EFFECTS[name](delay);
}

// ---- Ambient music: soft chords and the odd chime, made up as it goes. Off until this device asks for it.
const CHORDS = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64]]; // MIDI notes
const CHIMES = [72, 74, 76, 79, 81, 84];
const BAR = 6; // seconds per chord
const hertz = note => 440 * 2 ** ((note - 69) / 12);
let music = (() => { try { return localStorage.getItem('music') === 'on'; } catch { return false; } })();
let band = null, bar = 0;
export const musicOn = () => music;
export function setMusic(on) {
  music = on;
  try { localStorage.setItem('music', on ? 'on' : 'off'); } catch {}
  if (on) unlock(); else tune();
}
function note(out, midi, at, length, volume, rise, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hertz(midi);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(volume, at + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g).connect(out);
  o.start(at); o.stop(at + length);
}
// Starts or stops the band to match the setting. It rests while the app is out of sight.
function tune() {
  const wanted = music && !document.hidden && ctx?.state === 'running';
  if (wanted === Boolean(band)) return;
  if (!wanted) {
    const { out, timer } = band;
    band = null;
    clearInterval(timer);
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    setTimeout(() => out.disconnect(), 1200);
    return;
  }
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  let next = ctx.currentTime + 0.05;
  const fill = () => {
    while (next < ctx.currentTime + 1.5) {
      const chord = CHORDS[bar++ % CHORDS.length];
      chord.forEach(n => note(out, n, next, BAR + 2, 0.025, 2, 'triangle'));
      for (const beat of [1.5, 3, 4.5]) if (Math.random() < 0.6) note(out, CHIMES[Math.floor(Math.random() * CHIMES.length)], next + beat, 1.6, 0.03, 0.02);
      next += BAR;
    }
  };
  fill();
  band = { out, timer: setInterval(fill, 500) };
}
addEventListener('visibilitychange', () => ctx && (music && !document.hidden ? unlock() : tune()));
