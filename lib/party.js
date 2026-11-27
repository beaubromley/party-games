// Face-Off, Majority Rules and Telephone Doodle. Pure functions over the room state, like rules.js.
import { GameError, shuffle, validDrawing, clean } from './rules.js';
import { sameAnswer } from './match.js';
import { count, highlight } from './extras.js';
import { DOODLE_PROMPTS } from '../public/words.js';

const need = (ok, message) => { if (!ok) throw new GameError(message); };
const open = (room, phase) => { room.phase = phase; room.step++; room.likes = {}; };
const finish = room => open(room, 'done');
const ids = room => room.players.map(p => p.id);
const award = (room, id, points) => {
  const p = room.players.find(p => p.id === id);
  if (p && points) { p.score += points; room.gains[id] = (room.gains[id] || 0) + points; }
};
const nameOf = room => id => room.players.find(p => p.id === id)?.name ?? room.gone?.[id];

// ---- Face-Off: two players answer each prompt, everyone else votes. The second round counts double.
const faceoff = {
  start(room, { prompts, sets }) {
    Object.assign(room, { prompts, sets, set: 0, used: 0, matches: [] });
    faceoff.deal(room);
  },
  deal(room, random = Math.random) {
    // A ring: each player shares one prompt with each neighbour, so everyone answers two.
    const order = shuffle(ids(room), random);
    room.matches = order.map((id, i) => ({ prompt: room.prompts[room.used + i], players: [id, order[(i + 1) % order.length]], answers: {} }));
    room.used += order.length;
    Object.assign(room, { index: 0, votes: {}, options: [], gains: {}, hints: {} });
    open(room, 'writing');
  },
  todo: (room, id) => room.matches.findIndex(m => m.players.includes(id) && !(id in m.answers)),
  voters(room) {
    const m = room.matches[room.index], others = ids(room).filter(id => !m.players.includes(id));
    return others.length ? others : ids(room); // with two players, each picks the other's
  },
  waiting(room) {
    if (room.phase === 'writing') return ids(room).filter(id => faceoff.todo(room, id) >= 0);
    if (room.phase === 'voting') return faceoff.voters(room).filter(id => !(id in room.votes));
    return [];
  },
  text(room, id, text, item) {
    need(room.phase === 'writing', 'Writing time is over');
    const next = faceoff.todo(room, id);
    need(next >= 0 && next === item, 'Already sent');
    text = clean(text, 60);
    need(text, 'Write something');
    room.matches[next].answers[id] = text;
    if (!faceoff.waiting(room).length) faceoff.advance(room);
  },
  unsend(room, id, item) {
    const m = room.matches[item];
    need(m && id in m.answers, 'Nothing to edit');
    delete m.answers[id];
  },
  vote(room, id, choice) {
    need(room.phase === 'voting', 'Voting is over');
    need(faceoff.voters(room).includes(id), 'Your answer is in this one');
    need(!(id in room.votes), 'Already voted');
    need(room.options[choice], 'Pick an answer');
    need(room.options[choice].author !== id, "You can't pick your own");
    room.votes[id] = choice;
    if (!faceoff.waiting(room).length) faceoff.advance(room);
  },
  remove(room, id) {
    if (room.phase === 'reveal') return;
    for (const m of room.matches) { m.players = m.players.filter(p => p !== id); delete m.answers[id]; }
    if (room.phase === 'voting') {
      delete room.votes[id];
      // Their opponent's answer now stands alone.
      if (room.options.some(o => o.author === id)) return faceoff.show(room, room.index);
    }
    if (!faceoff.waiting(room).length) faceoff.advance(room);
  },
  helped: (room, id, index = room.index) => Boolean(room.hints?.[`${id}:${index}`]),
  show(room, index, random) {
    for (; index < room.matches.length; index++) {
      const answers = Object.entries(room.matches[index].answers);
      if (!answers.length) continue;
      Object.assign(room, { index, votes: {}, gains: {}, options: shuffle(answers.map(([author, text]) => ({ author, text })), random) });
      if (answers.length === 2) return open(room, 'voting');
      const [alone] = answers[0];
      award(room, alone, 500 * (room.set + 1) / (faceoff.helped(room, alone, index) ? 2 : 1)); // unopposed
      return open(room, 'reveal');
    }
    if (room.set + 1 < room.sets) { room.set++; return faceoff.deal(room, random); }
    finish(room);
  },
  advance(room, random = Math.random) {
    if (room.phase === 'writing') return faceoff.show(room, 0, random);
    if (room.phase === 'voting') {
      const picks = Object.values(room.votes), times = room.set + 1;
      room.options.forEach((o, i) => {
        const n = picks.filter(c => c === i).length;
        if (!n) return;
        const sweep = n === picks.length && n > 1 ? 250 : 0;
        for (let k = 0; k < n; k++) count(room, o.author, 'votes');
        if (sweep) count(room, o.author, 'sweeps');
        const points = (Math.round(1000 * n / picks.length) + sweep) * times;
        award(room, o.author, faceoff.helped(room, o.author) ? Math.round(points / 2) : points); // AI help halves it
      });
      // Only a clear winner makes the highlights.
      const votes = room.options.map((o, i) => picks.filter(c => c === i).length), best = Math.max(0, ...votes);
      if (best && votes.filter(n => n === best).length === 1) {
        const o = room.options[votes.indexOf(best)];
        highlight(room, { heading: room.matches[room.index].prompt, text: o.text, credit: `${nameOf(room)(o.author)}, ${best} ${best === 1 ? 'vote' : 'votes'}` });
      }
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    faceoff.show(room, room.index + 1, random);
  },
  view(room, id, out) {
    const names = nameOf(room);
    out.round = room.set + 1; out.rounds = room.sets;
    if (room.phase === 'writing') {
      const next = faceoff.todo(room, id);
      const own = room.matches.flatMap((m, i) => m.players.includes(id) ? [i] : []);
      out.sent = next < 0;
      out.written = own.filter(i => id in room.matches[i].answers).map(i => ({ item: i, text: room.matches[i].answers[id] }));
      out.sittingOut = !own.length;
      if (next >= 0) Object.assign(out, { item: next, question: room.matches[next].prompt,
        number: own.indexOf(next) + 1, hint: room.hints?.[`${id}:${next}`] || undefined, canHint: !(`${id}:${next}` in (room.hints ?? {})) });
    }
    if (room.phase === 'voting' || room.phase === 'reveal') {
      const m = room.matches[room.index];
      Object.assign(out, { question: m.prompt, matchup: room.index + 1, matchups: room.matches.length });
    }
    if (room.phase === 'voting') {
      out.canVote = faceoff.voters(room).includes(id);
      out.sent = id in room.votes;
      out.options = room.options.map(o => ({ text: o.text, mine: o.author === id }));
    }
    if (room.phase === 'reveal') {
      out.gains = room.gains;
      out.options = room.options.map((o, i) => ({ text: o.text, author: names(o.author), authorId: o.author, helped: faceoff.helped(room, o.author),
        voters: Object.entries(room.votes).filter(([, c]) => c === i).map(([v]) => names(v)) }));
      out.last = room.index + 1 >= room.matches.length && room.set + 1 >= room.sets;
    }
  },
};

// ---- Majority Rules: everyone answers; the most common answer scores.
const majority = {
  start(room, { prompts }) { Object.assign(room, { prompts, index: 0 }); majority.ask(room); },
  ask(room) { Object.assign(room, { answers: {}, groups: [], gains: {} }); open(room, 'writing'); },
  waiting: room => room.phase === 'writing' ? ids(room).filter(id => !(id in room.answers)) : [],
  text(room, id, text) {
    need(room.phase === 'writing', 'Writing time is over');
    need(!(id in room.answers), 'Already sent');
    text = clean(text, 40);
    need(text, 'Write something');
    room.answers[id] = text;
    if (!majority.waiting(room).length) majority.advance(room);
  },
  remove(room, id) {
    if (room.phase !== 'writing') return; // results already counted stay as they are
    delete room.answers[id];
    if (!majority.waiting(room).length) majority.advance(room);
  },
  unsend(room, id) {
    need(id in room.answers, 'Nothing to edit');
    delete room.answers[id];
  },
  score(room) {
    for (const [id, points] of Object.entries(room.gains)) { const p = room.players.find(p => p.id === id); if (p) p.score -= points; }
    room.gains = {};
    room.groups.sort((a, b) => b.authors.length - a.authors.length);
    const top = room.groups[0]?.authors.length ?? 0;
    for (const g of room.groups) {
      g.scored = top > 1 && g.authors.length === top;
      if (g.scored) g.authors.forEach(id => award(room, id, 1000));
    }
  },
  // The host decides when two answers mean the same thing ("soda" and "pop").
  merge(room, a, b) {
    need(room.phase === 'reveal', 'Combine answers on the results screen');
    const into = room.groups[a], from = room.groups[b];
    need(into && from && into !== from, 'Pick two different answers');
    into.authors.push(...from.authors);
    into.texts.push(...from.texts);
    room.groups.splice(b, 1);
    majority.score(room);
    room.step++;
  },
  advance(room) {
    if (room.phase === 'writing') {
      for (const [id, text] of Object.entries(room.answers)) {
        const group = room.groups.find(g => g.texts.some(t => sameAnswer(t, text)));
        if (group) { group.authors.push(id); group.texts.push(text); } else room.groups.push({ texts: [text], authors: [id] });
      }
      majority.score(room);
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    // Counted on the way out, after the host has finished combining answers.
    for (const g of room.groups) for (const id of g.authors) {
      if (g.scored) count(room, id, 'matched');
      if (g.authors.length === 1) count(room, id, 'alone');
    }
    const all = room.groups.length === 1 && room.groups[0];
    if (all && all.authors.length >= 3) highlight(room, { heading: room.prompts[room.index], text: all.texts[0], credit: `All ${all.authors.length} players agreed` });
    if (room.index + 1 >= room.prompts.length) return finish(room);
    room.index++;
    majority.ask(room);
  },
  view(room, id, out) {
    out.index = room.index; out.total = room.prompts.length;
    if (room.phase === 'writing') Object.assign(out, { question: room.prompts[room.index], sent: id in room.answers, mine: room.answers[id] });
    if (room.phase === 'reveal') {
      out.question = room.prompts[room.index];
      out.gains = room.gains;
      out.options = room.groups.map(g => ({ text: [...new Set(g.texts)].join(' / '), authors: g.authors.map(nameOf(room)), authorIds: g.authors, scored: g.scored }));
      out.last = room.index + 1 >= room.prompts.length;
    }
  },
};

// ---- Telephone Doodle: write, draw, describe, draw... each book passes to the next player.
export const turnCount = players => Math.max(3, Math.min(9, players % 2 ? players : players - 1));
const QUESTION_MARK = [[0, 24, [360, 330, 400, 240, 500, 200, 600, 240, 640, 330, 590, 420, 500, 480, 500, 600]], [0, 40, [500, 760, 500, 770]]];

const telephone = {
  start(room, _content, random = Math.random) {
    const order = shuffle(ids(room), random);
    Object.assign(room, { order, books: order.map(owner => ({ owner, entries: [] })), turn: 0, turns: turnCount(order.length), gains: {}, favorites: {} });
    open(room, 'writing');
  },
  book: (room, id) => {
    if (!room.order.includes(id)) return; // joined mid-game: watches until the next one
    const n = room.order.length;
    return room.books[((room.order.indexOf(id) - room.turn) % n + n) % n];
  },
  missing: room => room.order.filter(id => !telephone.book(room, id).entries[room.turn]),
  // Every real drawing, as vote choices "book:page".
  drawings: room => room.books.flatMap((b, book) => b.entries.flatMap((e, i) => e.strokes && !e.skipped ? [{ key: `${book}:${i}`, book, i, by: e.by }] : [])),
  waiting(room) {
    if (room.phase === 'writing' || room.phase === 'drawing') return telephone.missing(room).filter(id => ids(room).includes(id));
    if (room.phase !== 'voting') return [];
    const all = telephone.drawings(room);
    return ids(room).filter(id => !(id in room.favorites) && all.some(d => d.by !== id));
  },
  remove(room, id) {
    if (room.phase === 'reveal') return;
    if (room.phase === 'voting') delete room.favorites[id];
    if (telephone.waiting(room).length) return;
    if (room.phase === 'voting') telephone.close(room); else telephone.pass(room);
  },
  close(room) {
    finish(room);
    const out = {};
    telephone.done(room, out);
    for (const f of out.favorites) highlight(room, { heading: f.prompt, strokes: f.strokes, credit: `Drawn by ${f.artist}. Fan favorite.` });
  },
  unsend(room, id) {
    const entries = telephone.book(room, id)?.entries;
    need(entries?.[room.turn], 'Nothing to edit');
    delete entries[room.turn];
  },
  put(room, id, entry) {
    const book = telephone.book(room, id);
    need(book && !book.entries[room.turn], 'Already sent');
    book.entries[room.turn] = { by: id, ...entry };
    if (!telephone.waiting(room).length) telephone.pass(room);
  },
  text(room, id, text) {
    need(room.phase === 'writing', 'Writing time is over');
    text = clean(text, 80);
    need(text, 'Write something');
    telephone.put(room, id, { text });
  },
  drawing(room, id, strokes) {
    need(room.phase === 'drawing', 'Drawing time is over');
    need(validDrawing(strokes), 'Draw something first (or simplify a very detailed drawing)');
    telephone.put(room, id, { strokes });
  },
  pass(room, random = Math.random) {
    // A missed turn repeats the book's last drawing or text, so the next player still has something real.
    for (const id of telephone.missing(room)) {
      const entries = telephone.book(room, id).entries;
      const kind = room.phase === 'drawing' ? 'strokes' : 'text';
      const earlier = entries.findLast(e => e?.[kind])?.[kind];
      const spare = kind === 'strokes' ? QUESTION_MARK : DOODLE_PROMPTS[Math.floor(random() * DOODLE_PROMPTS.length)];
      entries[room.turn] = { by: id, skipped: true, [kind]: earlier ?? spare };
    }
    if (room.turn + 1 >= room.turns) { room.showing = { book: 0, count: 1 }; return open(room, 'reveal'); }
    room.turn++;
    open(room, room.turn % 2 ? 'drawing' : 'writing');
  },
  // After the last book, everyone picks one favorite drawing.
  vote(room, id, choice) {
    need(room.phase === 'voting', 'Vote after the last book');
    const drawing = telephone.drawings(room).find(d => d.key === choice);
    need(drawing, 'Pick a drawing');
    need(drawing.by !== id, "You can't pick your own");
    need(!(id in room.favorites), 'Already voted');
    room.favorites[id] = choice;
    if (!telephone.waiting(room).length) telephone.close(room);
  },
  done(room, out) {
    const tally = {};
    for (const key of Object.values(room.favorites ?? {})) tally[key] = (tally[key] || 0) + 1;
    const most = Math.max(0, ...Object.values(tally));
    out.favorites = Object.keys(tally).filter(k => tally[k] === most).slice(0, 3).map(key => {
      const [b, i] = key.split(':').map(Number), entries = room.books[b].entries;
      return { artist: nameOf(room)(entries[i].by), prompt: entries[i - 1].text, strokes: entries[i].strokes, votes: most };
    });
  },
  advance(room, random) {
    if (room.phase === 'writing' || room.phase === 'drawing') return telephone.pass(room, random);
    if (room.phase === 'voting') return telephone.close(room);
    need(room.phase === 'reveal', 'Nothing to skip');
    const s = room.showing;
    if (s.count < room.turns) s.count++;
    else if (s.book + 1 < room.books.length) Object.assign(s, { book: s.book + 1, count: 1 });
    else {
      room.favorites = {};
      open(room, 'voting');
      if (!telephone.waiting(room).length) telephone.close(room);
      return;
    }
    room.step++;
  },
  view(room, id, out) {
    const names = nameOf(room);
    if (room.phase === 'writing' || room.phase === 'drawing') {
      const book = telephone.book(room, id), prev = book?.entries[room.turn - 1];
      Object.assign(out, { index: room.turn, total: room.turns, sent: Boolean(book?.entries[room.turn]), mine: book?.entries[room.turn]?.text,
        prev: prev && { text: prev.text, strokes: prev.strokes }, sittingOut: !book });
    }
    if (room.phase === 'voting') {
      const all = telephone.drawings(room);
      Object.assign(out, { sent: id in room.favorites || !all.some(d => d.by !== id), favorite: room.favorites[id] ?? '',
        gallery: all.map(d => ({ key: d.key, by: names(d.by), byId: d.by, prompt: room.books[d.book].entries[d.i - 1].text, strokes: room.books[d.book].entries[d.i].strokes })) });
    }
    if (room.phase === 'reveal') {
      const { book, count } = room.showing, b = room.books[book];
      Object.assign(out, { owner: names(b.owner), bookNumber: book + 1, books: room.books.length,
        entries: b.entries.slice(0, count).map(e => ({ by: names(e.by), byId: e.by, text: e.text, strokes: e.strokes, skipped: e.skipped })),
        more: count < room.turns, last: count >= room.turns && book + 1 >= room.books.length });
    }
  },
};

export const PARTY = { faceoff, majority, telephone };
