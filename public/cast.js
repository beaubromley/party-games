// Sends the drawer's picture to watching phones.
export async function api(body) {
  const res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Server problem. Try again.'), { status: res.status });
  return data;
}
const read = () => { try { return JSON.parse(localStorage.getItem('cast')); } catch { return null; } };
const write = v => { try { v ? localStorage.setItem('cast', JSON.stringify(v)) : localStorage.removeItem('cast'); } catch {} };
let session = read(), next = null, sending = false, onEnd = () => {};
export const sharing = () => session;
export const whenEnded = fn => { onEnd = fn; };
export async function startSharing() {
  session = await api({ action: 'cast-start' });
  write(session);
}
export function stopSharing() { session = null; next = null; write(null); }
// Only the newest picture matters, so anything waiting to be sent is replaced.
export async function share(update) {
  if (!session) return;
  next = { ...update, at: Date.now() };
  if (sending) return;
  sending = true;
  while (next && session) {
    const { at, ...body } = next;
    next = null;
    if (body.seconds) body.seconds = Math.max(0, body.seconds - (Date.now() - at) / 1000);
    try { await api({ action: 'cast-send', ...session, ...body }); }
    catch (err) {
      if (/ended/i.test(err.message)) { stopSharing(); onEnd(); }
      else if (!next) { next = { ...body, at: Date.now() }; await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  sending = false;
}
