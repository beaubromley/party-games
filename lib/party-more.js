// Odd One Out, Down the Middle, Who Said It?, Midnight Snack and Last One Standing.
// Pure functions over the room state, like party.js.
import { GameError, shuffle, clean, enter as open } from './rules.js';
import { count, highlight } from './extras.js';

const need = (ok, message) => { if (!ok) throw new GameError(message); };
const finish = room => open(room, 'done');
const ids = room => room.players.map(p => p.id);
const award = (room, id, points) => {
  const p = room.players.find(p => p.id === id);
  if (p && points) { p.score += points; room.gains[id] = (room.gains[id] || 0) + points; }
};
const nameOf = room => id => room.players.find(p => p.id === id)?.name ?? room.gone?.[id];
const present = (room, list) => list.filter(id => ids(room).includes(id));
const pickOne = (list, random) => list[Math.floor(random() * list.length)];
// Ids with the most picks; several if tied.
function leaders(picks) {
  const tally = {};
  for (const id of picks) tally[id] = (tally[id] || 0) + 1;
  const most = Math.max(0, ...Object.values(tally));
  return { most, top: Object.keys(tally).filter(id => tally[id] === most) };
}

// ---- Odd One Out: everyone answers the same prompt, except one faker who never saw it.
const oddone = {
  min: 3,
  start(room, { prompts }) { Object.assign(room, { prompts, index: 0 }); oddone.ask(room); },
  ask(room, random = Math.random) {
    Object.assign(room, { cast: ids(room), answers: {}, votes: {}, gains: {}, faker: pickOne(ids(room), random) });
    open(room, 'writing');
  },
  next(room, random) {
    if (room.index + 1 >= room.prompts.length) return finish(room);
    room.index++;
    oddone.ask(room, random);
  },
  waiting(room) {
    const done = room.phase === 'writing' ? room.answers : room.phase === 'voting' ? room.votes : null;
    return done ? present(room, room.cast).filter(id => !(id in done)) : [];
  },
  expected: room => present(room, room.cast),
  text(room, id, text) {
    need(room.phase === 'writing' && room.cast.includes(id), 'Writing time is over');
    need(!(id in room.answers), 'Already sent');
    text = clean(text, 40);
    need(text, 'Write something');
    room.answers[id] = text;
    if (!oddone.waiting(room).length) oddone.advance(room);
  },
  unsend(room, id) { need(id in room.answers, 'Nothing to edit'); delete room.answers[id]; },
  vote(room, id, choice) {
    need(room.phase === 'voting' && room.cast.includes(id), 'Voting is over');
    need(!(id in room.votes), 'Already voted');
    need(choice !== id && present(room, room.cast).includes(choice), 'Pick another player');
    room.votes[id] = choice;
    if (!oddone.waiting(room).length) oddone.advance(room);
  },
  remove(room, id) {
    if (room.phase === 'reveal') return;
    // Without the faker there is nothing to find.
    if (id === room.faker) return oddone.next(room);
    delete room.answers[id]; delete room.votes[id];
    if (room.phase === 'voting') {
      for (const [voter, choice] of Object.entries(room.votes)) if (choice === id) delete room.votes[voter];
      room.step++;
    }
    if (!oddone.waiting(room).length) oddone.advance(room);
  },
  advance(room, random) {
    if (room.phase === 'writing') return open(room, 'voting');
    if (room.phase === 'voting') {
      const { top } = leaders(Object.values(room.votes));
      room.caught = top.length === 1 && top[0] === room.faker;
      for (const [voter, choice] of Object.entries(room.votes)) {
        if (choice === room.faker && voter !== room.faker) { award(room, voter, 500); count(room, voter, 'sharp'); }
      }
      if (!room.caught) { award(room, room.faker, 1000); count(room, room.faker, 'slick'); }
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    oddone.next(room, random);
  },
  likeable: room => room.cast.filter(id => id in room.answers).map(id => [id]),
  view(room, id, out) {
    const names = nameOf(room), [prompt, hint] = room.prompts[room.index].split('|');
    Object.assign(out, { index: room.index, total: room.prompts.length, sittingOut: !room.cast.includes(id) });
    if (room.phase === 'writing') {
      const faking = id === room.faker;
      Object.assign(out, { faking, question: faking ? "You're the faker!" : prompt, clue: faking ? hint : undefined, sent: id in room.answers, mine: room.answers[id] });
      return;
    }
    out.question = prompt;
    out.options = present(room, room.cast).map(who => ({ id: who, name: names(who), text: room.answers[who] ?? '(no answer)', mine: who === id,
      voters: room.phase === 'reveal' ? Object.entries(room.votes).filter(([, c]) => c === who).map(([v]) => names(v)) : undefined }));
    if (room.phase === 'voting') out.sent = !room.cast.includes(id) || id in room.votes;
    if (room.phase === 'reveal') Object.assign(out, { gains: room.gains, fakerId: room.faker, faker: names(room.faker), caught: room.caught, last: room.index + 1 >= room.prompts.length });
  },
};

// ---- Down the Middle: finish a "would you" so the room splits as evenly as possible.
const split = {
  min: 3,
  start(room, { stems, sets }) { Object.assign(room, { stems, sets, set: 0, used: 0 }); split.deal(room); },
  deal(room) {
    room.scenarios = ids(room).map((author, i) => ({ author, stem: room.stems[(room.used + i) % room.stems.length], text: '' }));
    room.used += room.scenarios.length;
    Object.assign(room, { index: 0, votes: {}, gains: {} });
    open(room, 'writing');
  },
  voters: room => ids(room).filter(id => id !== room.scenarios[room.index].author),
  waiting(room) {
    if (room.phase === 'writing') return present(room, room.scenarios.filter(s => !s.text).map(s => s.author));
    if (room.phase === 'voting') return split.voters(room).filter(id => !(id in room.votes));
    return [];
  },
  expected: room => room.phase === 'writing' ? present(room, room.scenarios.map(s => s.author)) : split.voters(room),
  text(room, id, text) {
    need(room.phase === 'writing', 'Writing time is over');
    const mine = room.scenarios.find(s => s.author === id);
    need(mine && !mine.text, 'Already sent');
    text = clean(text, 60);
    need(text, 'Write something');
    mine.text = text;
    if (!split.waiting(room).length) split.advance(room);
  },
  unsend(room, id) {
    const mine = room.scenarios.find(s => s.author === id);
    need(mine?.text, 'Nothing to edit');
    mine.text = '';
  },
  vote(room, id, choice) {
    need(room.phase === 'voting', 'Voting is over');
    need(split.voters(room).includes(id), 'This one is yours');
    need(!(id in room.votes), 'Already voted');
    need(choice === 'yes' || choice === 'no', 'Pick yes or no');
    room.votes[id] = choice;
    if (!split.waiting(room).length) split.advance(room);
  },
  show(room, index) {
    for (; index < room.scenarios.length; index++) {
      const s = room.scenarios[index];
      if (!s.text || !ids(room).includes(s.author)) continue;
      Object.assign(room, { index, votes: {}, gains: {} });
      return open(room, 'voting');
    }
    if (room.set + 1 < room.sets) { room.set++; return split.deal(room); }
    finish(room);
  },
  remove(room, id) {
    if (room.phase === 'reveal') return;
    if (room.phase === 'voting') {
      if (room.scenarios[room.index].author === id) return split.show(room, room.index + 1);
      delete room.votes[id];
    }
    if (!split.waiting(room).length) split.advance(room);
  },
  advance(room) {
    if (room.phase === 'writing') return split.show(room, 0);
    if (room.phase === 'voting') {
      const picks = Object.values(room.votes), yes = picks.filter(v => v === 'yes').length, no = picks.length - yes;
      const s = room.scenarios[room.index], even = yes > 0 && no > 0 && Math.abs(yes - no) <= 1;
      if (picks.length) award(room, s.author, Math.round(1000 * (1 - Math.abs(yes - no) / picks.length)) + (yes === no ? 250 : 0));
      if (even) {
        count(room, s.author, 'splits');
        highlight(room, { heading: s.stem.replace('___', s.text), text: `${yes} yes, ${no} no`, credit: `Written by ${nameOf(room)(s.author)}` });
      }
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    split.show(room, room.index + 1);
  },
  likeable: room => [[room.scenarios[room.index].author]],
  view(room, id, out) {
    const names = nameOf(room);
    Object.assign(out, { round: room.set + 1, rounds: room.sets });
    if (room.phase === 'writing') {
      const mine = room.scenarios.find(s => s.author === id);
      Object.assign(out, { sittingOut: !mine, question: mine?.stem ?? 'Get ready to vote', sent: !mine || Boolean(mine.text), mine: mine?.text });
      return;
    }
    const s = room.scenarios[room.index];
    Object.assign(out, { matchup: room.index + 1, matchups: room.scenarios.length, question: s.stem.replace('___', s.text), authorId: s.author, author: names(s.author) });
    if (room.phase === 'voting') Object.assign(out, { canVote: id !== s.author, sent: id in room.votes });
    if (room.phase === 'reveal') {
      const side = v => Object.entries(room.votes).filter(([, c]) => c === v).map(([who]) => names(who));
      Object.assign(out, { gains: room.gains, yes: side('yes'), no: side('no'),
        last: room.set + 1 >= room.sets && !room.scenarios.slice(room.index + 1).some(x => x.text && ids(room).includes(x.author)) });
    }
  },
};

// ---- Who Said It?: everyone answers, then matches each answer to a person.
const whosaid = {
  min: 3,
  start(room, { prompts }) { Object.assign(room, { prompts, index: 0 }); whosaid.ask(room); },
  ask(room) { Object.assign(room, { cast: ids(room), answers: {}, list: [], votes: {}, gains: {} }); open(room, 'writing'); },
  waiting(room) {
    if (room.phase === 'writing') return present(room, room.cast).filter(id => !(id in room.answers));
    if (room.phase === 'voting') return whosaid.expected(room).filter(id => !(id in room.votes));
    return [];
  },
  // Guessers are the round's players who have somebody else's answer to match.
  expected: room => present(room, room.cast).filter(id => room.phase !== 'voting' || room.list.some(a => a.author !== id)),
  text(room, id, text) {
    need(room.phase === 'writing' && room.cast.includes(id), 'Writing time is over');
    need(!(id in room.answers), 'Already sent');
    text = clean(text, 60);
    need(text, 'Write something');
    room.answers[id] = text;
    if (!whosaid.waiting(room).length) whosaid.advance(room);
  },
  unsend(room, id) { need(id in room.answers, 'Nothing to edit'); delete room.answers[id]; },
  vote(room, id, choice) {
    need(room.phase === 'voting' && room.cast.includes(id), 'Voting is over');
    need(!(id in room.votes), 'Already voted');
    const others = room.list.filter(a => a.author !== id), authors = room.list.map(a => a.author);
    need(choice && typeof choice === 'object' && others.every(a => authors.includes(choice[a.n]) && choice[a.n] !== id), 'Match every answer to a person');
    room.votes[id] = Object.fromEntries(others.map(a => [a.n, choice[a.n]]));
    if (!whosaid.waiting(room).length) whosaid.advance(room);
  },
  remove(room, id) {
    if (room.phase === 'reveal') return;
    delete room.answers[id]; delete room.votes[id];
    if (room.phase === 'voting') { room.list = room.list.filter(a => a.author !== id); room.step++; }
    if (!whosaid.waiting(room).length) whosaid.advance(room);
  },
  advance(room, random = Math.random) {
    if (room.phase === 'writing') {
      room.list = shuffle(Object.entries(room.answers), random).map(([author, text], n) => ({ n, author, text }));
      // One answer is no mystery.
      if (room.list.length < 2) return open(room, 'reveal');
      return open(room, 'voting');
    }
    if (room.phase === 'voting') {
      for (const [voter, guesses] of Object.entries(room.votes)) {
        for (const a of room.list) {
          if (a.author === voter) continue;
          if (guesses[a.n] === a.author) { award(room, voter, 500); count(room, voter, 'read'); }
          else if (a.n in guesses) { award(room, a.author, 200); count(room, a.author, 'stumped'); }
        }
      }
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    if (room.index + 1 >= room.prompts.length) return finish(room);
    room.index++;
    whosaid.ask(room);
  },
  likeable: room => room.list.map(a => [a.author]),
  view(room, id, out) {
    const names = nameOf(room);
    Object.assign(out, { index: room.index, total: room.prompts.length, question: room.prompts[room.index], sittingOut: !room.cast.includes(id) });
    if (room.phase === 'writing') Object.assign(out, { sent: !room.cast.includes(id) || id in room.answers, mine: room.answers[id] });
    if (room.phase === 'voting') {
      Object.assign(out, { sent: !whosaid.expected(room).includes(id) || id in room.votes,
        answers: room.list.map(a => ({ n: a.n, text: a.text, mine: a.author === id })),
        suspects: room.list.filter(a => a.author !== id).map(a => ({ id: a.author, name: names(a.author) })).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (room.phase === 'reveal') {
      Object.assign(out, { gains: room.gains, last: room.index + 1 >= room.prompts.length,
        options: room.list.map(a => ({ text: a.text, authorId: a.author, author: names(a.author),
          right: Object.entries(room.votes).filter(([voter, g]) => voter !== a.author && g[a.n] === a.author).map(([v]) => names(v)) })) });
    }
  },
};

// ---- Midnight Snack: hidden pie thieves, a family trying to catch them. Phones stay secret; talking is out loud.
export const thiefCount = n => n >= 10 ? 3 : n >= 7 ? 2 : 1;
const ROLES = { thief: 'Pie Thief', dog: 'Watchdog', grandma: 'Grandma', family: 'Family' };
const snack = {
  min: 3, startMin: 4,
  start(room, _content, random = Math.random) {
    const order = shuffle(ids(room), random), thieves = thiefCount(order.length);
    const deck = [...Array(thieves).fill('thief'), 'dog', ...order.length >= 5 ? ['grandma'] : []];
    Object.assign(room, { roles: Object.fromEntries(order.map((id, i) => [id, deck[i] ?? 'family'])), alive: ids(room), index: 0, peeks: {}, gains: {}, winner: '' });
    snack.night(room);
  },
  night(room) { Object.assign(room, { picks: {}, votes: {}, news: null }); open(room, 'writing'); },
  living: room => present(room, room.alive),
  waiting(room) {
    const done = room.phase === 'writing' ? room.picks : room.phase === 'voting' ? room.votes : null;
    return done ? snack.living(room).filter(id => !(id in done)) : [];
  },
  expected: room => snack.living(room),
  targets(room, id) {
    const living = snack.living(room);
    if (room.phase === 'voting') return living.filter(t => t !== id);
    // Everyone gets the same list at night, so a glance at a phone gives nothing away.
    return living;
  },
  vote(room, id, choice) {
    need(['writing', 'voting'].includes(room.phase) && snack.living(room).includes(id), "You can't pick right now");
    const done = room.phase === 'writing' ? room.picks : room.votes;
    need(!(id in done), 'Already picked');
    need((room.phase === 'voting' && choice === 'skip') || snack.targets(room, id).includes(choice), 'Pick someone');
    if (room.phase === 'writing') {
      need(room.roles[id] !== 'thief' || room.roles[choice] !== 'thief', 'Raid someone who is not a thief');
      need(room.roles[id] !== 'dog' || choice !== id, 'Sniff someone else');
    }
    done[id] = choice;
    if (room.phase === 'writing' && room.roles[id] === 'dog') room.peeks[choice] = room.roles[choice] === 'thief';
    if (!snack.waiting(room).length) snack.advance(room);
  },
  side(room) {
    const living = snack.living(room), thieves = living.filter(id => room.roles[id] === 'thief').length;
    return !thieves ? 'family' : thieves >= living.length - thieves ? 'thieves' : '';
  },
  end(room) {
    room.winner = snack.side(room);
    room.gains = {};
    for (const [id, role] of Object.entries(room.roles)) if ((role === 'thief') === (room.winner === 'thieves')) award(room, id, 1000);
    finish(room);
  },
  remove(room, id) {
    room.alive = room.alive.filter(a => a !== id);
    if (room.phase === 'reveal') return;
    if (snack.side(room)) return snack.end(room);
    delete room.picks[id]; delete room.votes[id];
    // Anyone who picked them picks again.
    const done = room.phase === 'writing' ? room.picks : room.votes;
    for (const [who, choice] of Object.entries(done)) if (choice === id) delete done[who];
    room.step++;
    if (!snack.waiting(room).length) snack.advance(room);
  },
  advance(room, random = Math.random) {
    if (room.phase === 'writing') {
      const living = snack.living(room);
      const wanted = living.filter(id => room.roles[id] === 'thief' && living.includes(room.picks[id])).map(id => room.picks[id]);
      const target = wanted.length ? pickOne(leaders(wanted).top, random) : null;
      const guard = living.find(id => room.roles[id] === 'grandma');
      const saved = Boolean(target) && guard !== undefined && room.picks[guard] === target;
      const out = target && !saved ? target : null;
      if (out) room.alive = room.alive.filter(a => a !== out);
      room.news = { stage: 'morning', out, saved };
      return open(room, 'reveal');
    }
    if (room.phase === 'voting') {
      const picks = Object.values(room.votes), skips = picks.filter(v => v === 'skip').length;
      const { most, top } = leaders(picks.filter(v => v !== 'skip'));
      const out = top.length === 1 && most > skips ? top[0] : null;
      if (out) room.alive = room.alive.filter(a => a !== out);
      room.news = { stage: 'verdict', out, votes: { ...room.votes } };
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    if (snack.side(room)) return snack.end(room);
    if (room.news.stage === 'morning') { room.votes = {}; return open(room, 'voting'); }
    room.index++;
    snack.night(room);
  },
  view(room, id, out) {
    const names = nameOf(room), role = room.roles[id], alive = snack.living(room).includes(id);
    Object.assign(out, { index: room.index, sittingOut: !role, isAlive: alive, role: role && ROLES[role], roleId: role,
      living: snack.living(room).map(names),
      partners: role === 'thief' ? Object.keys(room.roles).filter(t => t !== id && room.roles[t] === 'thief').map(names) : undefined,
      peeks: role === 'dog' ? Object.entries(room.peeks).map(([t, thief]) => ({ name: names(t), thief })) : undefined });
    if (room.phase === 'writing' || room.phase === 'voting') {
      const done = room.phase === 'writing' ? room.picks : room.votes;
      Object.assign(out, { question: room.phase === 'writing' ? `Night ${room.index + 1}` : 'Who raided the pantry?',
        sent: !alive || id in done, targets: alive ? snack.targets(room, id).map(t => ({ id: t, name: names(t), mine: t === id })) : [] });
    }
    if (room.phase === 'reveal') {
      const { stage, out: gone, saved, votes } = room.news;
      Object.assign(out, { stage, saved, goneName: gone ? names(gone) : '', goneRole: gone ? ROLES[room.roles[gone]] : '', over: Boolean(snack.side(room)),
        tally: votes ? Object.entries(votes).map(([v, c]) => `${names(v)} voted ${c === 'skip' ? 'to skip' : names(c)}`) : undefined });
    }
  },
  done(room, out) {
    const names = nameOf(room);
    out.headline = room.winner === 'thieves' ? 'The pie thieves win!' : 'The family wins!';
    out.cast = Object.entries(room.roles).map(([id, role]) => `${names(id)}: ${ROLES[role]}`);
  },
};

// ---- Last One Standing: miss a question and survive a danger round, or become a ghost.
export const SURVIVOR_BONUS = 10000;
const DANGERS = ['pie', 'lonely', 'math'];
const survival = {
  start(room, { questions }) { Object.assign(room, { questions, index: 0, alive: ids(room), danger: [] }); survival.ask(room); },
  ask(room, random = Math.random) {
    const [question, right, ...wrong] = room.questions[room.index].split('|');
    const choices = shuffle([right, ...wrong], random);
    Object.assign(room, { stage: 'question', quiz: { question, choices, right: choices.indexOf(right) }, picks: {}, danger: [], gains: {} });
    open(room, 'voting');
  },
  trap(room, random = Math.random) {
    let kind = DANGERS[room.index % DANGERS.length];
    if (kind === 'lonely' && room.danger.length < 2) kind = 'pie';
    const roll = n => Math.floor(random() * n);
    let quiz;
    if (kind === 'pie') {
      // Halfway through, a second pie gets the hot sauce.
      const choices = ['Pumpkin', 'Pecan', 'Apple', 'Cherry'], late = room.index >= room.questions.length / 2;
      const hot = shuffle([0, 1, 2, 3], random).slice(0, late ? 2 : 1);
      quiz = { question: late ? 'Pick a pie. TWO are full of hot sauce.' : 'Pick a pie. One is full of hot sauce.', choices, hot, right: hot[0] };
    }
    if (kind === 'lonely') quiz = { question: 'Pick a number nobody else picks.', choices: Array.from({ length: Math.max(3, room.danger.length) }, (_, i) => String(i + 1)) };
    if (kind === 'math') {
      const a = 6 + roll(8), b = 6 + roll(8), c = 7 + roll(23), answer = a * b + c;
      // The wrong ones are close, so a rough guess won't do.
      const choices = shuffle([answer, answer + 10, answer - 10, answer + 2], random).map(String);
      quiz = { question: `Quick! What is ${a} × ${b} + ${c}?`, choices, right: choices.indexOf(String(answer)) };
    }
    Object.assign(room, { stage: 'danger', kind, quiz, picks: {}, gains: {} });
    open(room, 'voting');
  },
  players: room => room.stage === 'danger' ? present(room, room.danger) : ids(room),
  waiting: room => room.phase === 'voting' ? survival.players(room).filter(id => !(id in room.picks)) : [],
  expected: room => survival.players(room),
  vote(room, id, choice) {
    need(room.phase === 'voting' && survival.players(room).includes(id), "You're safe this time");
    need(!(id in room.picks), 'Already answered');
    need(Number.isInteger(choice) && choice >= 0 && choice < room.quiz.choices.length, 'Pick an answer');
    room.picks[id] = choice;
    if (!survival.waiting(room).length) survival.advance(room);
  },
  remove(room, id) {
    room.alive = room.alive.filter(a => a !== id);
    room.danger = room.danger.filter(a => a !== id);
    if (!present(room, room.alive).length) room.alive = ids(room);
    if (room.phase !== 'voting') return;
    delete room.picks[id];
    if (!survival.waiting(room).length) survival.advance(room);
  },
  advance(room, random = Math.random) {
    if (room.phase === 'voting' && room.stage === 'question') {
      for (const [id, choice] of Object.entries(room.picks)) if (choice === room.quiz.right) { award(room, id, 500); count(room, id, 'right'); }
      room.danger = present(room, room.alive).filter(id => room.picks[id] !== room.quiz.right);
      room.stage = 'answers';
      return open(room, 'reveal');
    }
    if (room.phase === 'voting') {
      const { kind, quiz, picks } = room, in_ = present(room, room.danger);
      const lost = in_.filter(id => !(id in picks) || (kind === 'pie' ? quiz.hot.includes(picks[id])
        : kind === 'math' ? picks[id] !== quiz.right : in_.some(o => o !== id && picks[o] === picks[id])));
      // Someone always survives: if this would empty the table, everyone is spared.
      const spared = lost.length >= present(room, room.alive).length;
      room.fallen = spared ? [] : lost;
      room.spared = spared;
      room.alive = room.alive.filter(id => !room.fallen.includes(id));
      room.stage = 'fate';
      return open(room, 'reveal');
    }
    need(room.phase === 'reveal', 'Nothing to skip');
    if (room.stage === 'answers' && room.danger.length) return survival.trap(room, random);
    const standing = present(room, room.alive);
    if (standing.length <= 1 || room.index + 1 >= room.questions.length) {
      room.gains = {};
      standing.forEach(id => award(room, id, SURVIVOR_BONUS));
      room.winners = standing;
      return finish(room);
    }
    room.index++;
    survival.ask(room, random);
  },
  view(room, id, out) {
    const names = nameOf(room), { quiz, stage } = room;
    Object.assign(out, { index: room.index, total: room.questions.length, stage, isAlive: room.alive.includes(id),
      living: present(room, room.alive).map(names), question: quiz.question });
    if (room.phase === 'voting') {
      const playing = survival.players(room).includes(id);
      Object.assign(out, { choices: quiz.choices, canVote: playing, sent: !playing || id in room.picks, inDanger: present(room, room.danger).map(names) });
    } else {
      out.gains = room.gains;
      if (stage === 'answers') Object.assign(out, { answer: quiz.choices[quiz.right], inDanger: present(room, room.danger).map(names),
        right: Object.entries(room.picks).filter(([, c]) => c === quiz.right).map(([v]) => names(v)) });
      else Object.assign(out, { spared: room.spared, fallen: room.fallen.map(names),
        answer: room.kind === 'pie' ? `The hot sauce was in the ${quiz.hot.map(i => quiz.choices[i]).join(' and ')} pie${quiz.hot.length > 1 ? 's' : ''}.` : room.kind === 'math' ? `The answer was ${quiz.choices[quiz.right]}.` : 'Matching numbers are out.',
        picks: present(room, room.danger).map(d => `${names(d)}: ${d in room.picks ? quiz.choices[room.picks[d]] : 'no pick'}`) });
      out.last = stage === 'fate' || !room.danger.length
        ? present(room, room.alive).length <= 1 || room.index + 1 >= room.questions.length : false;
    }
  },
  done(room, out) {
    const standing = (room.winners ?? []).map(nameOf(room));
    out.headline = standing.length === 1 ? `${standing[0]} is the last one standing!` : `${standing.join(' & ')} survived!`;
  },
};

export const MORE = { oddone, split, whosaid, snack, survival };
