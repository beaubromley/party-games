// A screen for the whole room: watches a party by its code and never takes part.
import { el, podium, timed, climbing, enterScreen, WINNER_AT } from './ui.js';
import { play, soundOn, setSound } from './sound.js';
import { keepAwake } from './wake.js';
import { picture } from './canvas.js';
import { PARTY_GAMES } from './party-ui.js';

const app = document.getElementById('tv');
const REACTIONS = ['Ha!', 'Wow!', 'Bravo!', 'No way!'];
const read = () => { try { return localStorage.getItem('tv') ?? ''; } catch { return ''; } };
const write = v => { try { v ? localStorage.setItem('tv', v) : localStorage.removeItem('tv'); } catch {} };
const title = id => PARTY_GAMES[id]?.title ?? (id === 'doodle' ? 'Doodle Bluff' : 'Bluff');
let code = '', version = 0, state, timer, deadline = 0, misses = 0;
let shown = '', screenKey = '', started = 0, heard = null, poked = null;
const bubbles = el('div', { className: 'bubbles' });
const banner = el('p', { className: 'banner lost', role: 'alert', hidden: true }, 'Connection lost. Reconnecting…');
document.body.append(bubbles, banner);
const head = el('header'), stage = el('div', { className: 'fit' }), board = el('div'), feed = el('div'), chips = el('footer');
const clock = el('span', { className: 'clock', role: 'timer' });
setInterval(() => {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  clock.textContent = !deadline ? '' : left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : "Time's up!";
  clock.classList.toggle('low', Boolean(deadline) && left <= 5);
}, 250);

async function poll() {
  clearTimeout(timer);
  const mine = code;
  if (!mine) return;
  try {
    const res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'screen', code: mine, version }), signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    if (code !== mine) return;
    if (!res.ok) throw new Error(data.error || 'Server problem');
    misses = 0; banner.hidden = true;
    if (data.state && data.version >= version) { version = data.version; state = data.state; update(); }
  } catch (err) {
    if (code !== mine) return;
    if (/not found/i.test(err.message)) return leave(state ? 'That party has ended.' : 'No party has that code.');
    if (++misses >= 2) banner.hidden = false;
    version = 0;
  }
  clearTimeout(timer);
  timer = setTimeout(poll, 1500);
}
function join(value) {
  code = value.toUpperCase().trim(); version = 0; state = undefined; shown = screenKey = ''; heard = poked = null; misses = 0;
  write(code);
  history.replaceState(null, '', `?code=${code}`);
  keepAwake();
  app.className = 'live';
  app.replaceChildren(el('p', { className: 'wait' }, 'Connecting…'));
  poll();
}
function leave(message = '') {
  code = ''; deadline = 0; clearTimeout(timer); write(''); keepAwake(false); bubbles.replaceChildren(); banner.hidden = true;
  history.replaceState(null, '', location.pathname);
  form(message);
}
function form(message = '', prefill = '') {
  const input = el('input', { maxLength: 4, placeholder: 'Room code', ariaLabel: 'Room code', autocomplete: 'off', autocapitalize: 'characters', value: prefill });
  app.className = 'join';
  app.replaceChildren(el('h1', {}, 'TV screen'),
    el('p', {}, 'Shows the game to the whole room. This device watches; it doesn’t play.'),
    el('form', { onsubmit: e => { e.preventDefault(); if (input.value.trim()) join(input.value); } }, input, el('button', { className: 'big' }, 'Show this party')),
    el('p', { className: 'note error', role: 'status' }, message),
    el('a', { className: 'link', href: '/' }, '← All Games'));
}

const tools = () => el('div', { className: 'tools' },
  el('button', { ariaPressed: soundOn(), onclick: () => { const on = !soundOn(); setSound(on); drawHead(); if (on) setTimeout(() => play('ding'), 100); } }, `Sound: ${soundOn() ? 'on' : 'off'}`),
  document.documentElement.requestFullscreen && el('button', { onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}) }, 'Full screen'),
  el('button', { onclick: () => leave() }, 'Change room'));
function progressLine(s) {
  if (s.phase === 'lobby' || s.phase === 'done') return '';
  if (s.game === 'telephone') return s.phase === 'reveal' ? `Book ${s.bookNumber} of ${s.books}` : s.phase === 'voting' ? 'Pick a favorite' : `Turn ${s.index + 1} of ${s.total}`;
  if (s.matchup) return `${s.rounds > 1 ? `Round ${s.round} of ${s.rounds}, ` : ''}${s.matchup} of ${s.matchups}`;
  if (s.game === 'snack') return `Night ${s.index + 1}`;
  if (s.round) return s.rounds > 1 ? `Round ${s.round} of ${s.rounds}` : '';
  if (s.total) return s.phase === 'drawing' ? 'Drawing time' : `${['majority', 'survival'].includes(s.game) ? 'Question' : 'Round'} ${s.index + 1} of ${s.total}`;
  return '';
}
function drawHead() {
  head.replaceChildren(...[el('div', {}, el('h1', {}, title(state.game)), el('p', {}, progressLine(state))), clock,
    el('div', { className: 'joinat' }, el('p', {}, `Join at ${location.host}`), el('p', { className: 'code' }, code)), tools()]);
}

// ---- The middle of the screen
const say = text => el('p', { className: 'question' }, text);
const gap = s => s.game === 'majority' ? 0.7 : 1;
const card = (s, order, props, ...children) => timed(el('section', { ...props, className: `answer card ${props.className ?? ''}` }, ...children), started, 0.2 + order * gap(s));
const grid = (...children) => el('div', { className: 'grid' }, ...children);
const fine = text => text && el('p', { className: 'fine' }, text);
const people = (list, none) => list.length ? list.join(', ') : none;

function playing(s) {
  const verb = s.phase === 'drawing' ? 'Draw on your phones' : 'Answer on your phones';
  const heading = { oddone: 'One of you is faking. Answer on your phones.', split: 'Finish the dilemma on your phones', rap: 'Write your verses', faceoff: 'Answer your prompts', telephone: s.phase === 'drawing' ? 'Draw on your phones' : 'Write on your phones' }[s.game];
  if (s.game === 'snack') return [say(`Night ${s.index + 1}`), el('p', { className: 'lead' }, 'The pantry is dark. Everyone check your phone, and no peeking at your neighbor.')];
  return [s.question ? say(s.question) : say(heading ?? verb), s.drawing && picture(s.drawing),
    s.artist && el('p', { className: 'lead' }, `What should we call ${s.artist}'s drawing?`),
    s.subject && el('p', { className: 'lead' }, `This one is about ${s.subject}.`),
    s.question && el('p', { className: 'lead' }, verb)];
}
function voting(s) {
  if (s.game === 'telephone') return [say('Vote for your favorite drawing'), grid(...(s.gallery ?? []).map(g => el('section', { className: 'answer' }, picture(g.strokes), el('b', {}, g.prompt), fine(`Drawn by ${g.by}`))))];
  if (s.game === 'split') return [say(s.question), el('p', { className: 'lead' }, `By ${s.author}. Yes or no?`)];
  if (s.game === 'whosaid') return [say(`${s.question}...`), el('p', { className: 'lead' }, 'Who said what?'), grid(...s.answers.map(a => el('section', { className: 'answer' }, el('b', {}, a.text))))];
  if (s.game === 'snack') return [say('Who raided the pantry?'), el('p', { className: 'lead' }, 'Talk it over, then vote.'), grid(...s.living.map(n => el('section', { className: 'answer' }, el('b', {}, n))))];
  if (s.game === 'survival') return [s.stage === 'danger' && el('h2', {}, `Danger round: ${s.inDanger.join(', ')}`), say(s.question), grid(...s.choices.map(c => el('section', { className: 'answer' }, el('b', {}, c))))];
  const lead = { bluff: 'Which one is real?', doodle: 'Which title is real?', faceoff: 'Vote for your favorite', rap: 'Vote for your favorite', oddone: "Who didn't know the prompt?" }[s.game];
  return [s.question && say(s.question), s.drawing && picture(s.drawing), el('p', { className: 'lead' }, lead),
    grid(...(s.options ?? []).map(o => el('section', { className: 'answer' }, el('b', { className: 'verse' }, o.text), o.name && el('p', {}, o.name))))];
}
function results(s) {
  const liked = ids => { const n = new Set(ids.flatMap(id => s.likes?.[id] ?? [])).size; return n > 0 && el('p', { className: 'liked' }, `${n} ${n === 1 ? 'like' : 'likes'}`); };
  if (s.game === 'bluff' || s.game === 'doodle') {
    const ranked = [...s.options].sort((a, b) => a.truth - b.truth);
    return [s.question && say(s.question), s.drawing && picture(s.drawing), grid(...ranked.map((o, i) => card(s, i, { className: o.truth ? 'winner' : '' },
      el('b', {}, `${o.truth ? 'REAL: ' : ''}${o.text}`), !o.truth && el('p', {}, `by ${o.authors.join(' & ')}`), fine(people(o.voters, 'Nobody') + ' picked it'), liked(o.authorIds))))];
  }
  if (s.game === 'faceoff' || s.game === 'rap') {
    const top = Math.max(...s.options.map(o => o.voters.length));
    return [say(s.question), grid(...s.options.map((o, i) => card(s, i, { className: top && o.voters.length === top ? 'winner' : '' },
      el('b', { className: 'verse' }, o.text), el('p', {}, `${o.author}${s.gains[o.authorId] ? ` +${s.gains[o.authorId]}` : ''}`), fine(o.voters.length ? `Picked by ${o.voters.join(', ')}` : 'No votes'), liked([o.authorId]))))];
  }
  if (s.game === 'majority') return [say(s.question), grid(...s.options.map((o, i) => card(s, i, { className: o.scored ? 'winner' : '' }, el('b', {}, o.text), el('p', {}, o.authors.join(', ')), liked(o.authorIds))))];
  if (s.game === 'oddone') return [say(s.question), card(s, 0, { className: 'winner' }, el('b', {}, `${s.faker} was faking!`), el('p', {}, s.caught ? 'Caught!' : 'And got away with it.')),
    grid(...s.options.map((o, i) => card(s, i + 1, {}, el('b', {}, o.text), el('p', {}, o.name), fine(o.voters.length ? `Suspected by ${o.voters.join(', ')}` : 'Nobody suspected them'), liked([o.id]))))];
  if (s.game === 'split') return [say(s.question), grid(card(s, 0, {}, el('b', {}, `Yes: ${s.yes.length}`), el('p', {}, people(s.yes, 'Nobody'))), card(s, 1, {}, el('b', {}, `No: ${s.no.length}`), el('p', {}, people(s.no, 'Nobody')))),
    card(s, 2, { className: 'winner' }, el('b', {}, `Written by ${s.author}`), el('p', {}, s.gains[s.authorId] ? `+${s.gains[s.authorId]}` : 'No points this time'), liked([s.authorId]))];
  if (s.game === 'whosaid') return [say(`${s.question}...`), grid(...s.options.map((o, i) => card(s, i, {}, el('b', {}, o.text), el('p', {}, o.author), fine(o.right.length ? `Guessed by ${o.right.join(', ')}` : 'Nobody guessed it'), liked([o.authorId]))))];
  if (s.game === 'snack') {
    const news = s.goneName ? `${s.goneName} ${s.stage === 'morning' ? 'was raided in the night' : 'is sent to bed'}. They were ${s.goneRole === 'Family' ? 'family' : `the ${s.goneRole}`}.`
      : s.stage === 'morning' ? (s.saved ? 'Grandma kept watch. Nobody was raided!' : 'A quiet night. Nobody was raided.') : 'No agreement. Nobody is sent to bed.';
    return [say(s.stage === 'morning' ? 'Morning!' : 'The family has spoken'), card(s, 0, { className: 'winner' }, el('b', {}, news)), s.tally && el('p', { className: 'lead' }, s.tally.join('. ')), el('p', { className: 'lead' }, `Still up: ${s.living.join(', ')}`)];
  }
  if (s.game === 'survival') {
    if (s.stage === 'answers') return [say(s.question), card(s, 0, { className: 'winner' }, el('b', {}, s.answer), el('p', {}, s.right.length ? `Got it: ${s.right.join(', ')}` : 'Nobody got it')),
      card(s, 1, {}, el('b', {}, s.inDanger.length ? 'In danger' : 'Everyone standing is safe'), el('p', {}, s.inDanger.join(', ')))];
    return [say(s.answer), el('p', { className: 'lead' }, s.picks.join('. ')), card(s, 0, { className: 'winner' }, el('b', {}, s.spared ? 'Lucky! Everyone is spared.' : s.fallen.length ? `Out: ${s.fallen.join(', ')}` : 'Everyone made it!')),
      el('p', { className: 'lead' }, `Still standing: ${s.living.join(', ')}`)];
  }
  // Telephone: the book grows a page at a time.
  return [say(`${s.owner}'s book`), grid(...s.entries.map(e => el('section', { className: 'answer page' }, fine(`${e.by} ${e.strokes ? 'drew' : 'wrote'}`), e.strokes ? picture(e.strokes) : el('b', {}, e.text))))];
}
function finale(s) {
  const wrap = (node, delay) => timed(node, started, delay);
  const nodes = [];
  if (s.game === 'telephone') {
    const favorites = s.favorites ?? [];
    nodes.push(say(favorites.length ? (favorites.length > 1 ? 'Fan favorites' : 'Fan favorite') : 'The end'),
      grid(...favorites.map(f => el('section', { className: 'answer winner' }, picture(f.strokes), el('b', {}, f.prompt), el('p', {}, `Drawn by ${f.artist}`)))));
  } else {
    const top = Math.max(0, ...s.players.map(p => p.score)), winners = s.players.filter(p => p.score === top).map(p => p.name);
    const verdict = el('p', { className: 'question verdict' }, s.headline ?? (top ? `${winners.join(' & ')} ${winners.length > 1 ? 'tie for the win!' : 'wins!'}` : 'Nobody scored. A true tie!'));
    nodes.push(top > 0 ? wrap(verdict, WINNER_AT + 0.5) : verdict, top > 0 && podium(s.players.map(p => ({ name: p.name, score: p.score })), started));
  }
  const extra = [...(s.awards ?? []).map(a => el('div', { className: 'answer' }, el('b', {}, a.title), el('p', {}, a.names.join(' & ')))),
    s.cast && el('div', { className: 'answer cast' }, el('b', {}, 'Who was who'), s.cast.map(line => el('p', {}, line)))].filter(Boolean);
  if (extra.length) nodes.push(wrap(grid(...extra), WINNER_AT + 1.2));
  return nodes;
}
function lobby(s) {
  return [s.notice && el('p', { className: 'note error' }, s.notice), el('p', { className: 'lead' }, `On your phone, open ${location.host} and join with`), el('p', { className: 'code huge' }, code),
    el('p', { className: 'lead' }, s.players.length ? `${s.players.length} in the party` : 'Waiting for players'),
    el('div', { className: 'names' }, s.players.map(p => el('span', {}, p.name)))];
}

// How many things flip in before the scores may move, so they don't give it away.
const cardCount = s => ({ split: 3, snack: 1, survival: s.stage === 'answers' ? 2 : 1, oddone: (s.options?.length ?? 0) + 1, telephone: 0 })[s.game] ?? s.options?.length ?? 0;
function drawBoard(s) {
  board.className = s.players.length > 6 ? 'crowded' : ''; // leaves room for the pokes below
  if (s.phase === 'done' && s.game !== 'telephone') {
    return board.replaceChildren(...s.night.length ? [el('h2', {}, "Tonight's standings"), el('ol', { className: 'night' }, s.night.map(p => el('li', {}, `${p.name}: ${p.points}`)))] : []);
  }
  const scores = s.phase === 'reveal' && s.gains
    ? climbing(s.players, s.gains, started, 0.2 + cardCount(s) * gap(s) + 0.5, () => false)
    : el('ol', { id: 'recap' }, [...s.players].sort((a, b) => b.score - a.score).map(p => el('li', {}, `${p.name}: ${p.score}`)));
  board.replaceChildren(el('h2', {}, 'Scores'), scores);
}
// Scales the middle down when there is more than fits, since nobody can scroll a TV.
function fit() {
  const room = stage.parentElement;
  if (!room) return;
  let scale = 1;
  for (let i = 0; i < 12; i++) {
    stage.style.width = `${100 / scale}%`;
    stage.style.transform = `scale(${scale})`;
    const over = stage.offsetHeight * scale / room.clientHeight;
    if (over <= 1.005) break;
    // Between square root (text rewraps wider) and linear (pictures don't), erring small.
    scale /= over ** 0.7 * 1.01;
  }
}
addEventListener('resize', fit);

function update() {
  const s = state;
  if (!head.isConnected) app.replaceChildren(head, el('div', { className: 'middle' }, el('div', { className: 'room' }, stage), el('aside', {}, board, feed)), chips);
  deadline = s.timeLeft === undefined ? 0 : Date.now() + s.timeLeft;
  const screen = `${s.game}:${s.phase}:${s.step}`, fresh = screen !== screenKey;
  if (fresh) {
    screenKey = screen; started = Date.now();
    if (['writing', 'drawing', 'voting'].includes(s.phase)) play('turn');
    if (s.phase === 'reveal') for (let i = 0; i < cardCount(s); i++) play('ding', 0.2 + i * gap(s));
    if (s.phase === 'done' && s.players.some(p => p.score > 0)) { play('drumroll', 0.1); play('fanfare', WINNER_AT); }
  }
  // Redraw only on a real change, so the animations aren't restarted by every poll.
  const key = JSON.stringify([screen, s.players, s.likes, s.night, s.phase === 'lobby' && s.notice]);
  if (key !== shown) {
    shown = key;
    drawHead();
    const view = { lobby, drawing: playing, writing: playing, voting, reveal: results, done: finale }[s.phase](s);
    stage.replaceChildren(...view.filter(Boolean));
    drawBoard(s);
    if (fresh) enterScreen(app.querySelector('.room'));
  }
  chips.replaceChildren(...s.progress ? [el('span', {}, `${s.progress.filter(p => p.done).length} of ${s.progress.length} done`),
    el('span', { className: 'who-done' }, s.progress.map(p => el('span', { className: p.done ? 'done' : '' }, p.name)))] : []);
  feed.replaceChildren(...s.pokes.length ? [el('h2', {}, 'Pokes and notes'), el('ul', { className: 'feed' }, [...s.pokes].reverse().map(p =>
    el('li', {}, el('b', {}, `${p.from} → ${p.to}`), ` ${p.text || 'Poke!'}`)))] : []);
  const newest = s.pokes.at(-1)?.n ?? 0;
  if (poked !== null && newest > poked) play('poke');
  poked = Math.max(poked ?? 0, newest);
  const latest = s.reactions.at(-1)?.n ?? 0;
  if (heard !== null) for (const r of s.reactions.filter(r => r.n > heard)) {
    const bubble = el('p', {}, el('b', {}, REACTIONS[r.kind]), ` ${r.name}`);
    bubble.style.left = `${8 + (r.n * 37) % 70}%`;
    bubbles.append(bubble);
    setTimeout(() => bubble.remove(), 2600);
  }
  heard = latest;
  fit();
}

// A tap is needed before a browser will make sound, so a saved or linked code only fills in the box.
form('', new URLSearchParams(location.search).get('code') ?? read());
