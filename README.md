# party-games

Family party games for iPhone (ages 10+), on Vercel. No npm dependencies.

| Game | Phones | Storage |
|---|---|---|
| Forehead | 1 | none |
| Quick Draw | 1 | none |
| Bluff | 3-12 | Turso |
| Doodle Bluff | 3-12 | Turso |

- `lib/rules.js` game rules, `lib/rooms.js` room storage, `api/` Vercel functions.
- Needs `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- `npm run build` writes the decks (Wikidata, CC0) and imports questions (Open Trivia DB, CC BY-SA 4.0).
- `npm test` needs Playwright; it uses an in-memory SQLite in place of Turso.
- `/api/health` checks the database.
