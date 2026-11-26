// Loads Bluff questions into Turso at build time. Source: Open Trivia DB (CC BY-SA 4.0).
// Never fails the build: the app has hand-written questions to fall back on.
import { tursoDb, migrate, addQuestions } from '../lib/db.js';
import starter from '../lib/questions.js';
import { suitable, decode } from './filter.mjs';

try {
  const query = tursoDb();
  await migrate(query);
  await addQuestions(query, starter);
  const { rows } = await query("SELECT COUNT(*) AS n FROM questions WHERE source = 'Open Trivia DB'");
  if (rows[0].n < 150) {
    // general, science & nature, sports, geography, animals
    for (const [i, category] of [9, 17, 21, 22, 27].entries()) {
      if (i) await new Promise(r => setTimeout(r, 5500)); // the API allows one request per 5 seconds
      try {
        const res = await fetch(`https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986&category=${category}`, { signal: AbortSignal.timeout(20_000) });
        const data = await res.json();
        const list = (data.results ?? []).map(decode).filter(suitable)
          .map(q => ({ question: q.question, answer: q.correct_answer, source: 'Open Trivia DB' }));
        await addQuestions(query, list);
        console.log(`category ${category}: kept ${list.length} of ${data.results?.length ?? 0}`);
      } catch (err) { console.warn(`category ${category} skipped: ${err.message}`); }
    }
  }
  const total = await query('SELECT COUNT(*) AS n FROM questions');
  console.log(`questions in database: ${total.rows[0].n}`);
} catch (err) {
  console.warn(`question import skipped: ${err.message}`);
}
