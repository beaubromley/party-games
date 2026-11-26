import { tursoDb, migrate } from '../lib/db.js';
import { handle } from '../lib/rooms.js';
import { GameError } from '../lib/rules.js';

let ready;
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const query = tursoDb();
    await (ready ??= migrate(query).catch(err => { ready = null; throw err; }));
    return res.status(200).json(await handle(query, req.body ?? {}));
  } catch (err) {
    if (err instanceof GameError) return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Server problem. Try again.' });
  }
}
