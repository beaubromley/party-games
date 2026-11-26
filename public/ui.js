// Tiny DOM helper. Text always goes in as text nodes, so player input is never parsed as HTML.
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}
export const homeLink = () => el('a', { className: 'home', href: '/' }, 'All games');
