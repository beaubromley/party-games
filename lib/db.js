// Minimal Turso client over its HTTP API, so the project needs no dependencies.
export function tursoDb(url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN) {
  if (!url || !token) throw new Error('Turso environment variables are missing');
  const endpoint = url.replace(/^libsql:/, 'https:') + '/v2/pipeline';
  const encode = v => typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: String(v) };
  return async function query(sql, args = []) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args.map(encode) } }, { type: 'close' }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Database HTTP ${res.status}`);
    const first = (await res.json()).results[0];
    if (first.type !== 'ok') throw new Error(`Database error: ${first.error?.message}`);
    const { cols, rows, affected_row_count } = first.response.result;
    return {
      changes: affected_row_count,
      rows: rows.map(r => Object.fromEntries(r.map((cell, i) => [cols[i].name, cell.type === 'integer' ? Number(cell.value) : cell.value]))),
    };
  };
}

export async function migrate(query) {
  await query('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, version INTEGER NOT NULL, state TEXT NOT NULL, updated INTEGER NOT NULL)');
  await query('CREATE TABLE IF NOT EXISTS faces (code TEXT NOT NULL, player TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (code, player))');
  await query('CREATE TABLE IF NOT EXISTS presence (code TEXT PRIMARY KEY, seen INTEGER NOT NULL)');
  await query('CREATE TABLE IF NOT EXISTS casts (code TEXT PRIMARY KEY, secret TEXT NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL, updated INTEGER NOT NULL)');
  await query('CREATE TABLE IF NOT EXISTS hint_usage (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  await query('CREATE TABLE IF NOT EXISTS questions (question TEXT PRIMARY KEY, answer TEXT NOT NULL, source TEXT NOT NULL)');
}

export async function addQuestions(query, list) {
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    await query(`INSERT OR IGNORE INTO questions (question, answer, source) VALUES ${batch.map(() => '(?, ?, ?)').join(', ')}`,
      batch.flatMap(q => [q.question, q.answer, q.source]));
  }
}
