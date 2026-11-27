// Shared by every test file: SQLite standing in for Turso, and helpers that play any game.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { migrate } from '../lib/db.js';
import * as rules from '../lib/rules.js';

export const sqlite = new DatabaseSync(':memory:');
export const query = async (sql, args = []) => {
  await new Promise(r => setTimeout(r, Math.random() * 5)); // lets requests interleave
  const st = sqlite.prepare(sql);
  if (/^select/i.test(sql)) return { rows: st.all(...args), changes: 0 };
  return { rows: [], changes: Number(st.run(...args).changes) };
};
await migrate(query);

export const ask = async () => 'A hootenanny';
export const room = (game, n) => {
  const r = rules.newRoom(game);
  for (let i = 0; i < n; i++) rules.join(r, { id: 'p' + i, secret: 's', name: 'P' + i });
  return r;
};
// One legal move for any game.
export const move = (r, id, random = () => 0, strokes = [[0, 12, [1, 2, 3, 4]]], text = `word ${id} ${r.step}`) => {
  const v = rules.view(r, id), any = list => list[Math.floor(random() * list.length)];
  if (r.game === 'snack') return rules.vote(r, id, any(r.phase === 'voting' ? [...v.targets.map(t => t.id), 'skip']
    : v.targets.filter(t => !t.mine && r.roles[t.id] !== 'thief').map(t => t.id)));
  if (r.phase === 'drawing') return rules.submitDrawing(r, id, strokes);
  if (r.phase === 'writing') return rules.submitFake(r, id, r.game === 'rap' ? [text, 'and ' + text] : text, v.item);
  if (r.game === 'telephone') return rules.vote(r, id, v.gallery.find(d => d.byId !== id).key);
  if (r.game === 'oddone') return rules.vote(r, id, any(v.options.filter(o => !o.mine)).id);
  if (r.game === 'split') return rules.vote(r, id, any(['yes', 'no']));
  if (r.game === 'whosaid') return rules.vote(r, id, Object.fromEntries(v.answers.filter(a => !a.mine).map(a => [a.n, any(v.suspects).id])));
  if (r.game === 'survival') return rules.vote(r, id, Math.floor(random() * v.choices.length));
  rules.vote(r, id, v.options.findIndex(o => !o.mine));
};
const content = await import('../lib/more-content.js');
export const deals = {
  rap: n => ({ sets: 2, prompts: content.RAP.slice(0, 2 * n) }), oddone: () => ({ prompts: content.ODD.slice(0, 3) }),
  split: () => ({ sets: 2, stems: content.SPLIT.slice(0, 24) }), whosaid: () => ({ prompts: content.WHOSAID.slice(0, 3) }),
  snack: () => ({}), survival: () => ({ questions: content.SURVIVAL.slice(0, 8) }),
};
