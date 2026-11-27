// Stops the screen from locking during a game, where the phone supports it.
let wanted = false, lock = null, asking = false;
async function request() {
  if (!wanted || asking || (lock && !lock.released) || document.visibilityState !== 'visible') return;
  asking = true;
  try { lock = await navigator.wakeLock?.request('screen'); } catch {}
  asking = false;
  if (!wanted) release();
}
function release() { lock?.release().catch(() => {}); lock = null; }
export function keepAwake(on = true) { wanted = on; on ? request() : release(); }
document.addEventListener('visibilitychange', request);
// Some phones only grant it after a tap.
addEventListener('pointerdown', request);
