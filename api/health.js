// Checks that the database can be written and read, and counts the imported questions.
import { randomUUID } from 'node:crypto';
import { tursoDb, migrate } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    const query = tursoDb(), probe = 'health-' + randomUUID();
    await migrate(query);
    await query('INSERT INTO rooms (code, version, state, updated) VALUES (?, 1, ?, ?)', [probe, '{}', Date.now()]);
    const updated = await query('UPDATE rooms SET version = 2 WHERE code = ? AND version = ?', [probe, 1]);
    const read = await query('SELECT version FROM rooms WHERE code = ?', [probe]);
    await query('DELETE FROM rooms WHERE code = ?', [probe]);
    const counts = await query('SELECT source, COUNT(*) AS n FROM questions GROUP BY source');
    res.status(200).json({ ok: updated.changes === 1 && read.rows[0]?.version === 2, questions: counts.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}
