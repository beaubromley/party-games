# party-games

Family party games for iPhone (ages 10+), on Vercel. No npm dependencies.

| Game | Phones | Storage |
|---|---|---|
| Forehead | 1 | none |
| Quick Draw | 1 | none |
| Bluff | 2-12 | Turso |
| Doodle Bluff | 2-12 | Turso |
| Face-Off | 2-12 (best 3+) | Turso |
| Majority Rules | 2-12 (best 3+) | Turso |
| Telephone Doodle | 2-12 (best 4+) | Turso |
| Rhyme Battle | 2-12 (best 3+) | Turso |
| Odd One Out | 3-12 | Turso |
| Down the Middle | 3-12 | Turso |
| Who Said It? | 3-12 | Turso |
| Midnight Snack | 4-12 | Turso |
| Last One Standing | 2-12 | Turso |

- `lib/rules.js` game rules, `lib/rooms.js` room storage, `api/` Vercel functions.
- Needs `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- `npm run build` writes the decks (Wikidata, CC0) and imports questions (Open Trivia DB, CC BY-SA 4.0).
- `npm test` needs Playwright; it uses an in-memory SQLite in place of Turso.
- `/api/health` checks the database.
- Quick Draw can be watched live on other phones (Quick Draw, then Watch a drawing).
- AI help in Bluff and Face-Off calls Claude Haiku with `ANTHROPIC_API_KEY`, capped at 300 requests a day.
