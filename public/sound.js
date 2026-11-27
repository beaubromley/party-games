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
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
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
  ding: at => tone(988, at, 0.35, 'sine'),
  tick: at => tone(660, at, 0.07, 'square', 0.08),
  buzz: at => tone(150, at, 0.6, 'sawtooth', 0.15),
  drumroll: at => { for (let t = 0; t < 1.7; t += 0.06) tone(110 + (t % 0.12) * 200, at + t, 0.06, 'square', 0.03 + t * 0.04); },
  fanfare: at => { [523, 659, 784].forEach((f, i) => tone(f, at + i * 0.13, 0.18)); [523, 659, 784, 1047].forEach(f => tone(f, at + 0.42, 0.9, 'triangle', 0.1)); },
};
export function play(name, delay = 0, fallback = true) {
  if (ctx?.state === 'running' && soundOn(fallback)) EFFECTS[name](delay);
}
