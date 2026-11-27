// Tiny DOM helper. Text always goes in as text nodes, so player input is never parsed as HTML.
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}
export const homeLink = () => el('a', { className: 'home', href: '/' }, 'All games');

// Top three places, shown 2nd, 1st, 3rd. Tied entries share a step.
export function podium(entries) {
  const places = [...new Set(entries.map(e => e.score))].sort((a, b) => b - a).slice(0, 3);
  return el('div', { className: 'podium' }, [1, 0, 2].filter(i => i < places.length).map(i =>
    el('div', { className: `place place${i + 1}` },
      entries.filter(e => e.score === places[i]).map(e => el('div', { className: 'who' }, e.face, el('b', {}, e.name))),
      el('div', { className: 'block' }, el('strong', {}, ['1st', '2nd', '3rd'][i]), String(places[i])))));
}
