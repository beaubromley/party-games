// Mini games to play while waiting. The server only keeps the shared clock and the scores;
// the games run on the phones.
export const MINI = ['cactus', 'ski', 'turkey', 'hoops', 'stack', 'pies', 'bonk', 'copycat', 'derby', 'fieldgoal'];
export const PLAY = 30000, BREAK = 10000, LEAD = 4000, LATE_SCORE = 20000;
const KEPT = 100;

const current = room => room.mini?.rounds.at(-1);
// A new round is made a little before the break ends, so phones can show what's coming.
export const due = (room, now) => { const r = current(room); return !r || r.void || now >= r.end + BREAK - LEAD; };

export function next(room, now, random = Math.random) {
  if (!due(room, now)) return false;
  const box = room.mini ??= { rounds: [], queue: [] };
  const last = current(room);
  // Every game comes up once before any repeats.
  if (!box.queue.length) {
    box.queue = [...MINI];
    for (let i = box.queue.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [box.queue[i], box.queue[j]] = [box.queue[j], box.queue[i]]; }
    if (box.queue[0] === last?.game) box.queue.push(box.queue.shift());
  }
  // A cancelled round's game comes back around.
  const start = Math.max(now + LEAD, last && !last.void ? last.end + BREAK : 0);
  room.miniCount = (room.miniCount || 0) + 1;
  box.rounds = [...box.rounds, { n: room.miniCount, game: box.queue.shift(), seed: Math.floor(random() * 2 ** 31), start, end: start + PLAY, scores: {} }].slice(-KEPT);
  return true;
}

// The real game moved on: a round still being played doesn't count.
export function moved(room, now) {
  const r = current(room);
  if (r && now < r.end) r.void = true;
}

export function score(room, playerId, n, points, now) {
  const r = room.mini?.rounds.find(r => r.n === n);
  if (!r || r.void || now < r.end - 3000 || now > r.end + LATE_SCORE || playerId in r.scores) return false;
  if (!Number.isInteger(points) || points < 0 || points > 100000) return false;
  r.scores[playerId] = points;
  return true;
}

const table = (room, r) => Object.entries(r.scores).map(([id, score]) => ({ id, name: room.players.find(p => p.id === id)?.name, score }))
  .filter(s => s.name).sort((a, b) => b.score - a.score);

// Round wins: highest score among at least two players. Ties all count.
export function wins(room, now) {
  const out = new Map();
  for (const r of room.mini?.rounds ?? []) {
    if (r.void || now < r.end) continue;
    const list = table(room, r);
    if (list.length < 2 || !list[0].score) continue;
    for (const s of list.filter(s => s.score === list[0].score)) out.set(s.id, (out.get(s.id) ?? 0) + 1);
  }
  return [...out].map(([id, wins]) => ({ id, name: room.players.find(p => p.id === id).name, wins })).sort((a, b) => b.wins - a.wins);
}
export function trophy(room, now) {
  const list = wins(room, now);
  if (!list.length) return undefined;
  return { names: list.filter(w => w.wins === list[0].wins).map(w => w.name), wins: list[0].wins };
}

export function view(room, now) {
  const out = { wins: wins(room, now) }, r = current(room);
  if (r && !r.void) Object.assign(out, { n: r.n, game: r.game, seed: r.seed, startsIn: r.start - now, endsIn: r.end - now, scores: table(room, r) });
  // The round before, for the results shown during the break.
  const before = (room.mini?.rounds ?? []).filter(x => x !== r && !x.void).at(-1);
  if (before) out.last = { n: before.n, game: before.game, scores: table(room, before) };
  return out;
}
