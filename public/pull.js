// Pull down from the top to refresh. The Home Screen app has no browser bar, so it needs its own;
// Safari already does this itself.
(() => {
  if (!(navigator.standalone || matchMedia('(display-mode: standalone)').matches)) return;
  const FAR = 90; // pixels the label must travel before letting go refreshes
  let start = null, pulled = 0, label;
  const hide = () => { start = null; pulled = 0; label?.remove(); };
  // Never steal a stroke from a drawing, or interrupt a question or a Forehead round.
  const blocked = target => target.closest?.('canvas, dialog') || document.querySelector('dialog[open], .countdown, #stage:not([hidden])');
  addEventListener('touchstart', e => {
    hide();
    if (e.touches.length === 1 && scrollY <= 0 && !blocked(e.target)) start = [e.touches[0].clientX, e.touches[0].clientY];
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!start) return;
    const dx = e.touches[0].clientX - start[0], dy = e.touches[0].clientY - start[1];
    if (e.touches.length > 1 || scrollY > 0 || dy < Math.abs(dx)) return hide();
    pulled = dy / 2;
    if (!label) { label = document.createElement('p'); label.className = 'pull'; label.setAttribute('role', 'status'); }
    if (!label.isConnected) document.body.append(label);
    label.textContent = pulled >= FAR ? 'Release to refresh' : 'Pull to refresh';
    label.style.transform = `translateY(${Math.min(pulled, FAR + 20)}px)`;
  }, { passive: true });
  addEventListener('touchcancel', hide);
  addEventListener('touchend', async () => {
    if (pulled < FAR) return hide();
    start = null; pulled = 0;
    // A reload loses a half-made drawing or a typed answer, so ask first.
    const unsent = document.querySelector('canvas.pad') || [...document.querySelectorAll('main input:not([type=file])')].some(i => i.value && !/name|code|seconds/i.test(`${i.placeholder} ${i.id}`));
    if (unsent) {
      label.remove();
      const { ask } = await import('/ui.js');
      if (!await ask('Refresh now?', 'Unsent drawing or typing will be lost.', 'Refresh')) return;
      document.body.append(label);
    }
    label.textContent = 'Refreshing…';
    // Pick up a new version of the app first, if there is one, without hanging on a bad signal.
    const update = async () => {
      const worker = await navigator.serviceWorker?.getRegistration();
      if (!worker) return;
      await worker.update();
      const next = worker.installing || worker.waiting;
      if (next && next.state !== 'activated') await new Promise(done => next.addEventListener('statechange', () => ['activated', 'redundant'].includes(next.state) && done()));
    };
    await Promise.race([update().catch(() => {}), new Promise(done => setTimeout(done, 4000))]);
    location.reload();
  });
})();
