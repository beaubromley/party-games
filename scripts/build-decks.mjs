// Builds public/decks.json: hand-written decks plus topic decks from Wikidata (CC0).
// A deck that fails to download is skipped, so a Wikidata outage never breaks the deploy.
import { readFile, writeFile } from 'node:fs/promises';

const popular = (where, min, limit = 150) => `
SELECT ?item ?itemLabel ?n WHERE {
  ${where}
  ?item wikibase:sitelinks ?n . FILTER(?n > ${min})
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
} ORDER BY DESC(?n) LIMIT ${limit}`;

// Family friendly, ages 10+: the movie deck only uses titles someone has reviewed.
const APPROVED_MOVIES = new Set(JSON.parse(await readFile(new URL('../data/approved-movies.json', import.meta.url))));
const RENAME = { "People's Republic of China": 'China' };

const TOPICS = [
  { id: 'countries', name: 'Countries', emoji: '🌎', query: popular('?item wdt:P31 wd:Q6256 .', 100) },
  { id: 'animated', allow: APPROVED_MOVIES, name: 'Animated Movies', emoji: '🎬', query: popular('VALUES ?type { wd:Q202866 wd:Q29168811 } ?item wdt:P31 ?type .', 30, 100) },
  { id: 'hoops', name: 'Basketball Stars', emoji: '🏀', query: popular('?item wdt:P106 wd:Q3665646 ; wdt:P3647 ?nbaId .', 45, 80) },
];

async function fetchTopic({ query, allow, ...deck }) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'party-games/1.0 (https://github.com/beaubromley/party-games)', Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()).results.bindings;
  const cards = [...new Set(rows.map(r => r.itemLabel.value.replace(/\s*\(.*?\)$/, '')))].filter(c => c.length <= 40 && (!allow || allow.has(c))).map(c => RENAME[c] ?? c);
  if (cards.length < 20) throw new Error(`only ${cards.length} cards`);
  return { ...deck, source: 'Wikidata', cards };
}

const decks = JSON.parse(await readFile(new URL('../data/handwritten.json', import.meta.url)));
for (const topic of TOPICS) {
  try {
    const deck = await fetchTopic(topic);
    decks.push(deck);
    console.log(`deck ${deck.id}: ${deck.cards.length} cards, e.g. ${deck.cards.slice(0, 8).join(' | ')}`);
  } catch (err) {
    console.warn(`SKIPPED deck ${topic.id}: ${err.message}`);
  }
}
await writeFile(new URL('../public/decks.json', import.meta.url), JSON.stringify(decks));
console.log(`wrote ${decks.length} decks`);
