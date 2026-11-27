// Tiny DOM helper. Text always goes in as text nodes, so player input is never parsed as HTML.
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}
export const homeLink = () => el('a', { className: 'home', href: '/' }, 'All games');

// Plays an element's entrance as if it began at `started`, so redrawing a screen doesn't replay it.
export function timed(node, started, delay) {
  node.classList.add('enter');
  node.style.animationDelay = `${delay - (Date.now() - started) / 1000}s`;
  return node;
}
const CONFETTI = ['--red', '--blue', '--green', '--gold', '--ink'];
function confetti(started, delay) {
  return el('div', { className: 'confetti', ariaHidden: 'true' }, Array.from({ length: 70 }, (_, i) => {
    const bit = el('i');
    bit.style.cssText = `left:${(i * 37) % 100}%;background:var(${CONFETTI[i % 5]});--drift:${(i * 53) % 120 - 60}px;--spin:${360 + (i * 97) % 720}deg;animation-duration:${2.2 + (i % 7) * 0.25}s`;
    bit.style.animationDelay = `${delay + (i % 14) * 0.09 - (Date.now() - started) / 1000}s`;
    return bit;
  }));
}
export const WINNER_AT = 1.9; // seconds into the ceremony
// Top three places, shown 2nd, 1st, 3rd and revealed from last to first. Tied entries share a step.
export function podium(entries, started = Date.now()) {
  const places = [...new Set(entries.map(e => e.score))].sort((a, b) => b - a).slice(0, 3);
  const when = i => i ? 0.2 + (places.length - 1 - i) * 0.7 : WINNER_AT;
  return el('div', { className: 'podium' }, [1, 0, 2].filter(i => i < places.length).map(i =>
    el('div', { className: `place place${i + 1}` },
      timed(el('div', { className: 'winners' },
        i === 0 && el('div', { className: 'crown', ariaHidden: 'true' }),
        entries.filter(e => e.score === places[i]).map(e => el('div', { className: 'who' }, e.face, el('b', {}, e.name)))), started, when(i) + 0.35),
      timed(el('div', { className: 'block' }, el('strong', {}, ['1st', '2nd', '3rd'][i]), String(places[i])), started, when(i)))),
    Date.now() - started < 6000 && confetti(started, WINNER_AT + 0.3));
}
// A quick fade-and-rise when the screen changes.
export function enterScreen(node) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  node.animate?.([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
}
// An "are you sure?" box in the app's own style. Resolves true only for the action button.
export function ask(title, detail, action) {
  if (document.querySelector('dialog.ask')) return Promise.resolve(false);
  return new Promise(resolve => {
    const box = el('dialog', { className: 'ask', ariaLabel: title },
      el('form', { method: 'dialog' }, el('h2', {}, title), detail && el('p', {}, detail),
        el('button', { value: 'yes', className: 'yes' }, action),
        el('button', { value: '', autofocus: true }, 'Cancel')));
    box.onclose = () => { box.remove(); resolve(box.returnValue === 'yes'); };
    box.onclick = e => { if (e.target === box) box.close(); }; // a tap outside cancels
    document.body.append(box);
    box.showModal();
  });
}
// Closes an open question that no longer applies.
export const dismiss = () => document.querySelector('dialog.ask')?.close('');
