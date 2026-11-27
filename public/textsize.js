// Larger text, remembered on this phone. Loaded on every page before it draws.
(() => {
  let large = false;
  try { large = localStorage.getItem('large') === 'on'; } catch {}
  const apply = () => document.documentElement.classList.toggle('large', large);
  apply();
  const label = () => `Larger text: ${large ? 'on' : 'off'}`;
  window.textSizeButton = () => {
    const b = document.createElement('button');
    b.className = 'sound'; b.textContent = label(); b.setAttribute('aria-pressed', large);
    b.onclick = () => {
      large = !large; apply();
      try { localStorage.setItem('large', large ? 'on' : 'off'); } catch {}
      b.textContent = label(); b.setAttribute('aria-pressed', large);
    };
    return b;
  };
})();
