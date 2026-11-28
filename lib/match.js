// Decides whether a fake answer is really just the true answer in other words.
const FILLER = new Set(['a', 'an', 'the', 'of', 'to', 'his', 'her', 'its', 'their', 'and', 'or', 'in', 'on']);
const NUMBERS = Object.fromEntries('zero one two three four five six seven eight nine ten eleven twelve'.split(' ').map((w, i) => [w, String(i)]));
Object.assign(NUMBERS, { thirty: '30', forty: '40', fifty: '50', hundred: '100' });

const singular = w => w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y'
  : w.length > 4 && /(ches|shes|sses|xes)$/.test(w) ? w.slice(0, -2)
  : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

export function words(text) {
  const all = String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f'\u2019]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  const kept = all.filter(w => !FILLER.has(w));
  return (kept.length ? kept : all).map(w => NUMBERS[w] ?? singular(w));
}

function edits(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}

// loose: for drawing titles, where sharing one word ("cat") is fine and only a near copy counts.
export function tooClose(fake, truth, { loose = false } = {}) {
  const f = new Set(words(fake)), t = new Set(words(truth));
  if (!f.size || !t.size) return false;
  const a = [...f].join(''), b = [...t].join('');
  if (a === b) return true;
  const slips = /\d/.test(a + b) ? 0 : b.length >= 9 ? 2 : b.length >= 5 ? 1 : 0; // typos, never numbers
  if (edits(a, b) <= slips) return true;
  const shared = [...f].filter(w => t.has(w)).length;
  if (loose) return shared / (f.size + t.size - shared) >= 0.6;
  return shared === f.size || shared === t.size; // "wall" for "the city walls", or the answer padded out
}

// For grouping matching answers: stricter than tooClose, so "pie" and "pumpkin pie" stay apart.
export function sameAnswer(a, b) {
  const x = words(a).join(''), y = words(b).join('');
  if (!x || !y) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  return x === y || (Math.min(x.length, y.length) >= 7 && !/\d/.test(x + y) && edits(x, y) <= 1);
}

// Stricter than tooClose, for AI suggestions: it mustn't even lean on the real answer's words
// (ones already in the question don't count).
export function leans(fake, truth, question = '') {
  if (tooClose(fake, truth) || tooClose(fake, truth, { loose: true })) return true;
  const given = new Set(words(question)), stem = w => w.length > 5 ? w.slice(0, 5) : w;
  const secret = new Set(words(truth).filter(w => w.length > 2 && !given.has(w)).map(stem));
  return words(fake).some(w => secret.has(stem(w)));
}
// Too similar to count as a new answer.
export const repeats = (text, list) => list.some(other => sameAnswer(text, other) || tooClose(text, other, { loose: true }));
