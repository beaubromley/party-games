// Group Doodle: one prompt, everybody drawing on the same picture at once, each in their own color.
// The room only holds the clock. Strokes go in their own table, so a dozen phones can pour them in.
export const LEAD = 4000, DRAW = 60000, GRACE = 5000;
export const COLOR_COUNT = 12, WIDTHS = [10, 30];
const MOST_AT_ONCE = 20, MOST_POINTS = 200, MOST_ROWS = 4000, PAGE = 500;
export const PROMPTS = ('A very busy zoo,Thanksgiving dinner gone wrong,The weirdest playground ever,An underwater city,A monster parade,The ultimate treehouse,' +
  'A farm on the moon,A giant pizza party,A haunted amusement park,The silliest parade,A dinosaur birthday party,A pirate ship full of cats,' +
  'A snow day,The world\'s strangest sandwich,A robot city,A beach with way too much going on,A castle made of candy,An alien school,' +
  'A jungle band concert,A turkey escape plan,A race with silly vehicles,The messiest bedroom ever,A bug picnic,A town inside a snow globe').split(',');

const paint = (room, id) => { const { colors } = room.doodle; colors[id] ??= Object.keys(colors).length % COLOR_COUNT; };
export const joined = (room, id) => { if (room.doodle) paint(room, id); };

// Returns false when one is already going, so a second tap just joins it.
export function start(room, playerId, now, random = Math.random) {
  if (room.doodle && now < room.doodle.end) return false;
  let left = PROMPTS.filter(p => !room.doodled?.includes(p));
  if (!left.length) { room.doodled = []; left = PROMPTS; }
  const prompt = left[Math.floor(random() * left.length)];
  (room.doodled ??= []).push(prompt);
  room.doodleCount = (room.doodleCount || 0) + 1;
  room.doodle = { n: room.doodleCount, prompt, by: room.players.find(p => p.id === playerId).name, start: now + LEAD, end: now + LEAD + DRAW, colors: {} };
  room.players.forEach(p => paint(room, p.id));
  return true;
}
export function view(room, now) {
  const d = room.doodle;
  if (!d) return undefined;
  return { n: d.n, prompt: d.prompt, by: d.by, startsIn: d.start - now, endsIn: d.end - now,
    painters: room.players.filter(p => p.id in d.colors).map(p => ({ id: p.id, name: p.name, color: d.colors[p.id] })) };
}

const valid = s => Array.isArray(s) && s.length === 2 && WIDTHS.includes(s[0]) && Array.isArray(s[1]) && s[1].length >= 2 && s[1].length <= MOST_POINTS * 2 &&
  !(s[1].length % 2) && s[1].every(v => Number.isInteger(v) && v >= 0 && v <= 1000);

// Saves what this phone has drawn (if anything) and returns whatever has arrived since `after`.
export async function sync(query, code, room, playerId, body, now) {
  const d = room.doodle;
  if (!d || body.n !== d.n) return { over: true, strokes: [] };
  const color = d.colors[playerId];
  const mine = Array.isArray(body.strokes) ? body.strokes.slice(0, MOST_AT_ONCE).filter(valid) : [];
  if (playerId && color !== undefined && mine.length && now >= d.start - 1000 && now <= d.end + GRACE) {
    const [{ n }] = (await query('SELECT COUNT(*) AS n FROM doodles WHERE code = ? AND round = ?', [code, d.n])).rows;
    if (n < MOST_ROWS) await query(`INSERT INTO doodles (code, round, color, data) VALUES ${mine.map(() => '(?, ?, ?, ?)').join(', ')}`,
      mine.flatMap(s => [code, d.n, color, JSON.stringify(s)]));
  }
  const after = Number.isInteger(body.after) ? body.after : 0;
  const { rows } = await query('SELECT id, color, data FROM doodles WHERE code = ? AND round = ? AND id > ? ORDER BY id LIMIT ?', [code, d.n, after, PAGE]);
  return { n: d.n, strokes: rows.map(r => [r.color, ...JSON.parse(r.data)]), last: rows.at(-1)?.id ?? after, more: rows.length === PAGE };
}
