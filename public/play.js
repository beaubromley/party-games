import { el, homeLink, podium, timed, enterScreen, ask, dismiss, climbing, WINNER_AT } from './ui.js';
import { play, soundOn, setSound, musicOn, setMusic } from './sound.js';
import { keepAwake } from './wake.js';
import { savePicture } from './save.js';
import { picture, sketchpad } from './canvas.js';
import { shrink, saveFace, savedFace, FACE_DAYS } from './face.js';
import { BLUFF_TOPICS } from './topics.js';
import { PARTY_GAMES, partyScreen, perform } from './party-ui.js';
import { nudger } from './nudge.js';
import { arcade } from './arcade.js';
import { count, cue, covered, stopCount } from './count.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const asked = params.get('game');
let game = asked === 'doodle' || Object.hasOwn(PARTY_GAMES, asked) ? asked : 'bluff';
const read = () => { try { return JSON.parse(localStorage.getItem('room')); } catch { return null; } };
const write = v => { try { v ? localStorage.setItem('room', JSON.stringify(v)) : localStorage.removeItem('room'); } catch {} };
const readLast = () => { try { return JSON.parse(localStorage.getItem('last')); } catch { return null; } };
const writeLast = v => { try { v ? localStorage.setItem('last', JSON.stringify(v)) : localStorage.removeItem('last'); } catch {} };
let topic = 'trivia';
let preview = null; // { topic, samples }
let lastScreen = '';
let ceremony = { key: '', at: 0 }; // when this final screen first appeared
let reveal = { key: '', at: 0, gap: 1 }; // the same for a round's results
const REACTIONS = ['Ha!', 'Wow!', 'Bravo!', 'No way!'];
let heard = null; // the newest reaction already shown
const bubbles = el('div', { className: 'bubbles', role: 'status' });
const cheers = el('div', { className: 'cheers', role: 'group', ariaLabel: 'React' }, REACTIONS.map((text, kind) => el('button', {
  onclick: async () => { try { apply(await api({ action: 'react', kind, ...me })); } catch (err) { note.textContent = err.message; } } }, text)));
document.body.append(bubbles);
const banner = el('p', { className: 'banner', role: 'alert', hidden: true });
document.body.append(banner);
let misses = 0, bannerTimer;
function connection(ok) {
  if (ok) {
    if (banner.classList.contains('lost')) {
      banner.className = 'banner'; banner.textContent = 'Back online';
      bannerTimer = setTimeout(() => { banner.hidden = true; }, 2000);
    }
    misses = 0;
  } else if (++misses >= 2) {
    clearTimeout(bannerTimer);
    banner.className = 'banner lost'; banner.textContent = 'Connection lost. Reconnecting…'; banner.hidden = false;
  }
}
addEventListener('offline', () => { if (me) { misses = 1; connection(false); } });
addEventListener('online', () => { if (me) { version = 0; poll(); } });
// Collapsible sections that stay open across redraws.
const opened = new Set();
function fold(id, label, ...children) {
  const panel = el('details', { open: opened.has(id), ontoggle: () => opened[panel.open ? 'add' : 'delete'](id) }, el('summary', {}, label), ...children);
  return panel;
}
function showReactions() {
  const newest = state.reactions.at(-1)?.n ?? 0;
  // Joining or rejoining doesn't replay what was already said.
  if (heard !== null) for (const r of state.reactions.filter(r => r.n > heard)) {
    const bubble = el('p', {}, el('b', {}, REACTIONS[r.kind]), ` ${r.name}`);
    bubble.style.left = `${8 + (r.n * 37) % 55}%`;
    bubbles.append(bubble);
    setTimeout(() => bubble.remove(), 2600);
  }
  heard = newest;
}
function nightBoard(host) {
  if (!state.night.length) return [];
  return [el('h2', {}, "Tonight's standings"),
    el('ol', { className: 'night' }, state.night.map(p => el('li', {}, `${p.name}: ${p.points} ${p.points === 1 ? 'point' : 'points'}${p.wins ? `, ${p.wins} ${p.wins === 1 ? 'win' : 'wins'}` : ''}`))),
    el('p', { className: 'fine' }, '3, 2 and 1 points for each podium finish in this room.'),
    host && button('Reset standings', async () => { if (await ask("Clear tonight's standings?", 'Everyone starts the night from zero, and highlights are cleared.', 'Clear standings')) send({ action: 'forget' }); }, 'alt')];
}
let reel = { key: '', items: [] }, reelLoading = false;
const reelKey = () => `${me.code}:${state.highlights.latest}:${state.highlights.count}`;
async function loadReel() {
  if (reelLoading || reel.key === reelKey()) return;
  reelLoading = true;
  const mine = me, key = reelKey();
  try {
    const data = await api({ action: 'highlights', ...mine });
    if (me === mine) { reel = { key, items: data.highlights }; if (FACE_SCREENS.includes(state.phase)) render(); }
  } catch (err) { note.textContent = err.message; }
  finally { reelLoading = false; }
}
function highlightReel() {
  if (!state.highlights.count) return [];
  const mine = reel.key.startsWith(`${me.code}:`) ? reel.items : [];
  const panel = el('details', { className: 'reel', open: opened.has('reel'), ontoggle: () => {
    opened[panel.open ? 'add' : 'delete']('reel');
    if (panel.open && me) loadReel();
  } }, el('summary', {}, `Night highlights (${state.highlights.count})`),
    mine.length ? mine.map(h => {
      const title = titleOf(h.game);
      return el('section', { className: 'answer' }, el('p', { className: 'fine' }, title), el('p', {}, h.heading), h.strokes && picture(h.strokes),
        h.text && el('b', {}, h.text), el('p', { className: 'fine' }, h.credit),
        button('Save', () => savePicture([{ text: h.heading, big: true }, ...h.strokes ? [{ strokes: h.strokes }] : [], ...h.text ? [{ text: `“${h.text}”`, big: true }] : [], { text: h.credit }], 'highlight'), 'alt'));
    }) : el('p', {}, 'Loading…'));
  return [panel];
}
const TIMER_CHOICES = [[0, 'Off'], [30, '30s'], [60, '60s'], [90, '90s'], [120, '2 min']];
let timerChoice = 0, deadline = 0, ticked = '';
try { const t = Number(localStorage.getItem('timer')); if (TIMER_CHOICES.some(([n]) => n === t)) timerChoice = t; } catch {}
const clock = el('p', { className: 'timer', role: 'timer', hidden: true });
setInterval(() => {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  clock.hidden = !deadline;
  if (!deadline) return;
  clock.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : "Time's up!";
  clock.classList.toggle('low', left <= 5);
  const mark = `${deadline}:${Math.max(0, left)}`;
  if (left <= 5 && mark !== ticked) { ticked = mark; play(left > 0 ? 'tick' : 'buzz', 0, state?.you === state?.host); }
}, 250);
const HOW_TO = {
  bluff: ['Write a fake answer that sounds true.', 'Pick the real one from the list.', 'Score for finding the truth and for fooling people.'],
  doodle: ['Everyone secretly draws a prompt.', 'Make up titles for each drawing.', 'Find the real title and fool others with yours.'],
  faceoff: ['Answer two silly prompts.', 'Two answers go head to head and everyone else votes.', 'More votes, more points. A second round counts double.'],
  majority: ['Everyone answers the same question.', 'Answer what you think most people will say.', 'The most common answer scores.'],
  rap: ['Finish two verses by rhyming the lines you are given.', 'Two verses battle and everyone else votes. Tap Hear it to have one read aloud.', 'More votes, more points. A second round counts double.'],
  oddone: ['Everyone answers the same prompt, except one secret faker.', 'See the answers and the prompt, then talk it over.', 'Vote for the faker. They score if they slip by.'],
  split: ['Finish a "would you" with a catch.', 'Everyone else votes yes or no.', 'The more evenly they split, the more you score.'],
  whosaid: ['Everyone finishes the same sentence in secret.', 'Match each answer to a person.', 'Score for right guesses, and for keeping people guessing.'],
  snack: ['Peek at your secret role. Pie thieves raid at night.', 'By day, talk it out and vote someone to bed.', 'Family wins by catching every thief. Thieves win when they equal the rest.'],
  survival: ['Answer the question.', 'Miss it and face a danger round.', 'Outlast everyone. Ghosts keep scoring, but survivors win.'],
  telephone: ['Write a phrase, then pass it on.', 'The next player draws it, the one after describes the drawing, and so on.', 'Read every book together, then vote for a favorite drawing.'],
};
const soundButton = () => {
  const fallback = state.you === state.host, on = soundOn(fallback);
  return el('button', { className: 'sound', ariaPressed: on, onclick: () => { setSound(!on); render(); if (!on) setTimeout(() => play('ding'), 100); } }, `Sound: ${on ? 'on' : 'off'}`);
};
const musicButton = () => el('button', { className: 'sound music', ariaPressed: musicOn(), onclick: () => { setMusic(!musicOn()); render(); } }, `Music: ${musicOn() ? 'on' : 'off'}`);
// A yes-or-no request that works from any screen.
async function request(body) {
  const mine = me;
  try { const data = await api({ ...mine, ...body }); if (me === mine) apply(data); return true; } // body wins: both can name a game
  catch (err) { note.textContent = err.message; return false; }
}
// Your own turn, kept in view for as long as the screen is up.
function yoursPanel() {
  if (!state.yours) return null;
  const show = y => y.strokes ? picture(y.strokes) : el('b', {}, y.text);
  return el('section', { className: 'yours' }, state.yours.map(y => y.secret
    ? fold(`secret:${state.step}`, `${y.label} (tap to show)`, el('div', { className: 'answer' }, show(y)))
    : el('div', { className: 'answer' }, el('p', { className: 'fine' }, y.label), show(y))));
}
// Once you've voted: like answers while the others finish. Names and counts come with the results.
function likePanel() {
  const others = state.likeables?.filter(o => !o.mine) ?? []; // your own is already shown above
  if (!others.length) return null;
  return el('section', { className: 'likeables' }, el('h2', {}, 'Like some while you wait'),
    others.map(o => el('div', { className: 'answer' }, el('b', { className: game === 'rap' ? 'verse' : '' }, o.text), o.by && el('p', {}, o.by),
      game === 'rap' && perform(o.text),
      el('button', { className: 'like' + (o.liked ? ' on' : ''), ariaPressed: o.liked, onclick: () => send({ action: 'like', target: o.ref }) }, o.liked ? 'Liked' : 'Like'))));
}
let nameDraft = null;
function namePicker() {
  const mine = state.players.find(p => p.id === state.you).name;
  const input = el('input', { value: nameDraft ?? mine, maxLength: 14, placeholder: 'Your name', ariaLabel: 'New name', autocomplete: 'off', oninput: () => { nameDraft = input.value; } });
  return fold('name', 'Change your name', el('form', { onsubmit: async e => {
    e.preventDefault();
    const name = input.value;
    if (!await request({ action: 'rename', name })) return;
    nameDraft = null; opened.delete('name');
    try { localStorage.setItem('name', name.trim()); } catch {}
    note.textContent = ''; render();
  } }, input, el('button', { className: 'big alt' }, 'Save name')));
}
// Everyone votes for what to play next. The host has the final say.
function nextGame(host) {
  const tally = {};
  for (const w of state.wants ?? []) (tally[w.game] ??= []).push(w.name);
  const ranked = Object.keys(tally).sort((a, b) => tally[b].length - tally[a].length);
  const mine = state.wants?.find(w => w.id === state.you)?.game;
  const switchTo = (id, text) => button(text, () => send({ action: 'switch', game: id }), 'alt');
  return el('section', { className: 'panel next' }, el('h2', {}, 'Next game'),
    ranked.length ? el('ul', { className: 'votes' }, ranked.map(id => el('li', {}, el('b', {}, `${titleOf(id)}: ${tally[id].length}`), ` ${tally[id].join(', ')}`)))
      : el('p', { className: 'fine' }, 'No votes yet.'),
    host && ranked.filter(id => id !== game).slice(0, 3).map(id => switchTo(id, `Switch to ${titleOf(id)} (${tally[id].length})`)),
    fold('vote', mine ? `Your vote: ${titleOf(mine)}` : 'Vote for the next game',
      el('div', { className: 'chips', role: 'group', ariaLabel: 'Vote for the next game' }, Object.keys(HOW_TO).map(id => el('button', { className: id === mine ? 'on' : '', ariaPressed: id === mine,
        onclick: () => request({ action: 'want', game: id }) }, titleOf(id))))),
    host && fold('switch', 'Switch to any game', Object.keys(HOW_TO).filter(id => id !== game).map(id => switchTo(id, `Switch to ${titleOf(id)}`))));
}
let phaseBefore = ''; // for counting down into a new screen
let me = read(), version = 0, shown = '', state, timer, busy = false;
const note = el('p', { className: 'note error', role: 'status' });
const waiting = el('p', { className: 'note' });
let faces = {}, facesKey = '';
let draft = { step: 0, text: '' }; // typed answer, kept across redraws
// Host controls live in one element that updates by itself, so changing them never wipes a drawing.
const controls = el('div');
let nudged = '';
let controlsKey = '', managing = false, hostAway = false, pinged = 0;
// A poke must report its own errors, and must not be swallowed while another tap is in flight.
const nudge = nudger(async body => { const mine = me; const data = await api({ ...body, ...mine }); if (me === mine) apply(data); });
const games = arcade(async body => { const mine = me; const data = await api({ ...mine, ...body }); if (me === mine) apply(data); });
const FACE_SCREENS = ['lobby', 'reveal', 'done']; // screens with nothing half-typed to lose
const faceImg = (id, extra = '') => faces[id] && el('img', { className: 'face ' + extra, src: faces[id], alt: '' });
async function loadFaces() {
  const key = state.players.map(p => p.face ? p.id + p.face : '').join('');
  if (key === facesKey) return;
  const mine = me, before = facesKey;
  facesKey = key;
  try {
    const data = await api({ action: 'faces', ...mine });
    if (me !== mine) return;
    faces = data.faces;
    if (FACE_SCREENS.includes(state.phase)) render();
  } catch { facesKey = before; }
}
async function sendFace(file) {
  note.textContent = 'Saving photo…';
  try {
    const data = file ? await shrink(file) : '';
    apply(await api({ action: 'face', data, ...me }));
    saveFace(data);
    note.textContent = '';
  } catch (err) { note.textContent = err.status ? err.message : "That photo didn't work. Try another."; }
}
function facePicker() {
  const mine = state.players.find(p => p.id === state.you);
  const input = el('input', { type: 'file', accept: 'image/*', hidden: true, id: 'face', onchange: () => input.files[0] && sendFace(input.files[0]) });
  return el('div', {}, input,
    button(`${mine.face ? 'Change' : 'Add'} your ${PARTY_GAMES[game] ? 'photo' : 'bluff face'}`, () => input.click(), 'alt'),
    mine.face && button('Remove photo', () => sendFace(null), 'alt'),
    el('p', { className: 'fine' }, `${PARTY_GAMES[game] ? 'Shows beside your name and answers' : 'Shows when you fool someone'}; only people in the room see it. This phone remembers it for ${FACE_DAYS} days and adds it to new rooms. Remove photo forgets it. The room's copy is deleted when a new room is created after this one sits idle for a day.`));
}
const label = id => BLUFF_TOPICS.find(([t]) => t === id)?.[1];

// Everyone can browse and preview. The host's choice starts the game; others send a request.
function topicPicker(host) {
  if (game !== 'bluff') return null;
  const mine = state.requests.find(r => r.id === state.you)?.topic;
  const chosen = host ? topic : preview?.topic ?? mine;
  const showSamples = async () => {
    const wanted = chosen;
    try {
      const { samples } = await api({ action: 'preview', topic: wanted, ...me });
      preview = { topic: wanted, samples }; render();
    } catch (err) { note.textContent = err.message; }
  };
  return el('section', {},
    el('h2', {}, host ? 'Pick a topic' : 'Topics'),
    el('div', { className: 'chips', role: 'group', ariaLabel: 'Topic' }, BLUFF_TOPICS.map(([id, name]) => {
      const asked = state.requests.filter(r => r.topic === id).length;
      return el('button', { className: id === chosen ? 'on' : '', ariaPressed: id === chosen,
        onclick: () => { if (host) topic = id; preview = host ? null : { topic: id }; render(); } }, asked ? `${name} (${asked})` : name);
    })),
    chosen && button(`Preview ${label(chosen)}`, showSamples, 'alt'),
    preview?.samples && preview.topic === chosen && el('ul', { className: 'samples' }, preview.samples.map(q => el('li', {}, q))),
    !host && chosen && button(mine === chosen ? `Withdraw request for ${label(chosen)}` : `Ask host for ${label(chosen)}`,
      () => send({ action: 'request', topic: chosen })),
    host && state.requests.length > 0 && el('p', {}, 'Requests: ', state.requests.map(r => `${r.name} wants ${label(r.topic)}`).join('. ')));
}
const titleOf = id => PARTY_GAMES[id]?.title ?? (id === 'doodle' ? 'Doodle Bluff' : 'Bluff');
const title = () => titleOf(game);

async function api(body) {
  const res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Server problem. Try again.'), { status: res.status });
  return data;
}
const button = (label, onclick, extra = '') => el('button', { className: 'big ' + extra, onclick }, label);
// The host's settings, in a section of their own that is there on every screen.
function updateControls() {
  const host = state.you === state.host, playing = !['lobby', 'done'].includes(state.phase);
  const key = [host, playing, state.phase, state.host, hostAway, state.pokesOff, timerChoice, state.players.map(p => p.id + p.name).join()].join(':');
  if (key === controlsKey) return;
  controlsKey = key;
  const others = state.players.filter(p => p.id !== state.you);
  const hostName = state.players.find(p => p.id === state.host)?.name;
  const current = TIMER_CHOICES.find(([n]) => n === timerChoice)[1];
  const panel = el('details', { className: 'panel options', open: managing, ontoggle: () => { managing = panel.open; } },
    el('summary', {}, 'Game options'),
    el('h2', {}, 'Timer'),
    el('div', { className: 'chips', role: 'group', ariaLabel: 'Timer' }, TIMER_CHOICES.map(([n, text]) => el('button', { className: n === timerChoice ? 'on' : '', ariaPressed: n === timerChoice,
      onclick: () => { timerChoice = n; try { localStorage.setItem('timer', n); } catch {} updateControls(); } }, text))),
    el('p', { className: 'fine' }, playing ? `Set to ${current.toLowerCase()} for the next game.` : 'A countdown to hurry people along. Nothing skips by itself.'),
    el('h2', {}, 'Pestering'),
    button(`Pestering: ${state.pokesOff ? 'off' : 'on'}`, () => request({ action: 'pokes', on: state.pokesOff }), 'alt pestering'),
    el('p', { className: 'fine' }, 'Pokes and notes from players who are done.'),
    others.length > 0 && el('h2', {}, 'Players'),
    others.map(p => button(`Remove ${p.name}`, async () => {
      if (await ask(`Remove ${p.name}?`, 'They will be taken out of this game.', `Remove ${p.name}`)) send({ action: 'kick', target: p.id });
    }, 'alt')),
    playing && button('Restart: back to lobby', async () => {
      if (await ask('Restart the game?', 'Everyone goes back to the lobby and scores reset.', 'Back to lobby')) send({ action: 'restart' });
    }, 'alt'));
  controls.replaceChildren(...[
    host && ['drawing', 'writing', 'voting'].includes(state.phase) && button('Host: skip waiting', () => send({ action: 'next' }), 'alt'),
    host && panel,
    !host && hostAway && el('p', {}, `${hostName}, the host, seems to be away.`),
    !host && hostAway && button('Take over as host', async () => { if (await ask('Take over as host?', 'You will run the game from this phone.', 'Become host')) send({ action: 'claim' }); }, 'alt'),
  ].filter(Boolean));
}
async function ping() {
  if (Date.now() - pinged < 15000) return;
  pinged = Date.now();
  const mine = me;
  try {
    const data = await api({ action: 'ping', ...mine });
    if (me === mine && state) { hostAway = data.hostAway; updateControls(); }
  } catch {}
}
function remember() {
  const mine = state?.players.find(p => p.id === state.you);
  if (me && mine) writeLast({ code: me.code, name: mine.name, game });
}
// Tells the room, so the game can carry on without this phone.
async function quit() {
  nudge.reset(); games.reset(); stopCount(); phaseBefore = '';
  const mine = me;
  clearTimeout(timer); me = null;
  try { await api({ action: 'leave', ...mine }); } catch {}
}
function leave() { dismiss(); stopCount(); phaseBefore = ''; games.reset(); nudge.reset(); reel = { key: '', items: [] }; opened.clear(); misses = 0; banner.hidden = true; banner.className = 'banner'; heard = null; bubbles.replaceChildren(); keepAwake(false); deadline = 0; clearTimeout(timer); controlsKey = ''; controls.replaceChildren(); managing = false; hostAway = false; pinged = 0; preview = null; topic = 'trivia'; faces = {}; facesKey = ''; nameDraft = null; me = null; write(null); version = 0; shown = ''; lobbyForm(); }

async function send(body) {
  if (busy) return;
  busy = true; note.textContent = '';
  try { apply(await api({ ...me, ...body, step: state.step })); } // body wins: both can name a game
  catch (err) { note.textContent = err.message; }
  finally { busy = false; }
}

async function poll() {
  clearTimeout(timer);
  const mine = me;
  if (!mine) return;
  try {
    const data = await api({ action: 'poll', ...mine, version });
    if (me !== mine) return;
    connection(true);
    apply(data);
    ping();
  } catch (err) {
    if (me !== mine) return;
    if (/not found|not in this room/i.test(err.message)) { const ended = /not found/i.test(err.message); if (ended) writeLast(null); else remember(); leave(); note.textContent = ended ? 'That room has ended.' : 'You are no longer in that room.'; return; }
    connection(false); version = 0;
  }
  clearTimeout(timer);
  timer = setTimeout(poll, 1500);
}

function apply(data) {
  if (!data.state || data.version < version) return;
  version = data.version; state = data.state;
  if (game !== state.game || me.game !== state.game) {
    game = state.game;
    me = Object.assign(me, { game }); write(me);
    history.replaceState(null, '', `?game=${game}`);
  }
  keepAwake();
  deadline = state.timeLeft === undefined ? 0 : Date.now() + state.timeLeft;
  const next = cue(phaseBefore, state);
  phaseBefore = state.phase;
  if (next) count(next, soundOn(state.you === state.host));
  else if (state.phase === 'lobby') stopCount();
  const done = state.progress?.filter(p => p.done).length;
  waiting.replaceChildren(...state.progress ? [el('span', {}, `${done} of ${state.progress.length} done`),
    el('span', { className: 'who-done' }, state.progress.map(p => el('span', { className: p.done ? 'done' : '', ariaLabel: `${p.name}: ${p.done ? 'done' : 'still going'}` }, p.name)))] : []);
  // Only rebuild when the screen really changes, so a half-typed answer or drawing survives polling.
  const key = [state.game, state.step, state.sent, state.item, state.favorite, state.highlights.latest, state.highlights.count, state.canVote, JSON.stringify(state.likes), state.night.map(p => p.name + p.points).join(), state.hint, state.canHint, state.phase === 'lobby' && state.players.length,
    FACE_SCREENS.includes(state.phase) && state.players.map(p => [p.id, p.name, p.face]).join() + state.host,
    JSON.stringify([state.wants, state.yours?.map(y => [y.label, y.text]), state.likeables]),
    state.requests.map(r => r.id + r.topic).join()].join(':');
  if (key !== shown) {
    // A nudge when there is something new to do.
    const turn = `${state.game}:${state.step}:${state.item ?? ''}`;
    if (['writing', 'drawing', 'voting'].includes(state.phase) && !state.sent && turn !== nudged) { nudged = turn; play('turn', 0, state.you === state.host); }
    shown = key; note.textContent = ''; render();
  }
  updateControls();
  nudge.update(state);
  games.update(state);
  showReactions();
  loadFaces();
}

function render() {
  const s = state, host = s.you === s.host;
  const nodes = [];
  // `order` is the scoreboard's place in a results queue; with it, the points climb once the cards are in.
  const scores = order => order !== undefined
    ? climbing(s.players, s.gains ?? {}, reveal.at, 0.2 + order * reveal.gap + 0.5, p => faceImg(p.id))
    : el('ol', { id: 'recap' }, [...s.players].sort((a, b) => b.score - a.score)
      .map(p => el('li', {}, faceImg(p.id), `${p.name}: ${p.score}${s.gains?.[p.id] ? ` (+${s.gains[p.id]})` : ''}`)));
  // Thumbs-up for an answer on the results screen.
  const like = authors => {
    if (!authors.length) return false;
    const fans = new Set(authors.flatMap(a => s.likes?.[a] ?? [])), mine = authors.includes(s.you), on = fans.has(s.you);
    if (mine) return fans.size > 0 && el('p', { className: 'liked' }, `${fans.size} ${fans.size === 1 ? 'like' : 'likes'}`);
    return el('button', { className: 'like' + (on ? ' on' : ''), ariaPressed: on, onclick: () => send({ action: 'like', target: authors[0] }) },
      `${on ? 'Liked' : 'Like'}${fans.size ? ` (${fans.size})` : ''}`);
  };
  const subject = () => [s.question && el('p', { className: 'question' }, s.question), s.drawing && picture(s.drawing)];
  if (s.phase === 'reveal') {
    const key = [me.code, game, s.index, s.round, s.matchup, s.bookNumber, s.stage].join(':');
    if (reveal.key !== key) {
      reveal = { key, at: Date.now() + covered(), gap: game === 'majority' ? 0.7 : 1 };
      const cards = game === 'telephone' ? 0 : s.options?.length ?? 0;
      for (let i = 0; i < cards; i++) play('ding', covered() / 1000 + 0.2 + i * reveal.gap, host);
    }
  }
  const startButtons = () => PARTY_GAMES[game]
    ? PARTY_GAMES[game].starts.map(([text, n]) => button(text, () => send({ action: 'start', rounds: n, timer: timerChoice })))
    : game === 'bluff'
    ? [3, 5, 8].map(n => button(`Start: ${n} questions`, () => send({ action: 'start', topic, rounds: n, timer: timerChoice })))
    : [button('Start drawing', () => send({ action: 'start', timer: timerChoice }))];
  // The same code works all night, for latecomers and anyone who dropped out.
  const invite = () => [el('p', {}, 'Room code'), el('p', { className: 'code' }, me.code),
    button('Share invite link', async () => {
      const link = `${location.origin}/play.html?game=${game}&code=${me.code}`;
      try { navigator.share ? await navigator.share({ url: link }) : (await navigator.clipboard.writeText(link), note.textContent = 'Link copied'); } catch {}
    }, 'alt')];
  if (s.phase === 'lobby') {
    if (s.notice) nodes.push(el('p', { className: 'note error' }, s.notice));
    nodes.push(el('h1', {}, title()),
      fold('how', 'How to play', PARTY_GAMES[game] && el('p', {}, PARTY_GAMES[game].blurb), el('ol', { className: 'how' }, HOW_TO[game].map(line => el('li', {}, line)))),
      ...invite(),
      fold('tv', 'Show it on a TV', el('p', {}, `On a laptop, iPad or smart TV browser, open ${location.host}/tv.html and enter ${me.code}. A spare phone mirrored to the TV works too.`),
        el('p', { className: 'fine' }, 'That screen only watches. Keep playing on your phones.')),
      el('ul', { id: 'recap' }, s.players.map(p => el('li', {}, faceImg(p.id), p.name))), topicPicker(host));
    const least = PARTY_GAMES[game]?.min ?? 2;
    if (host && s.players.length >= least) nodes.push(...startButtons());
    else nodes.push(el('p', {}, s.players.length < least ? `Need at least ${least} players.` : 'Waiting for the host to start.'));
    nodes.push(nextGame(host), namePicker(), fold('photo', 'Your photo', facePicker()), ...nightBoard(host), ...highlightReel());
  } else if (PARTY_GAMES[game] && s.phase !== 'done') {
    nodes.push(...partyScreen({ s, host, send, button, faceImg, scores, redraw: render, reveal, like }));
  } else if (s.phase === 'drawing') {
    if (s.sent) nodes.push(el('h1', {}, 'Nice art!'));
    else {
      const pad = sketchpad({ slot: true });
      nodes.push(el('p', {}, 'Secretly draw:'), el('p', { className: 'question' }, s.prompt), ...pad.nodes,
        button('Send drawing', () => send({ action: 'drawing', strokes: pad.strokes() })));
    }
  } else if (s.phase === 'writing') {
    nodes.push(el('p', {}, `Round ${s.index + 1} of ${s.total}`), ...subject());
    if (s.isArtist) nodes.push(el('p', { className: 'question' }, 'Your masterpiece! Sit back while they make up titles.'));
    else if (s.sent) nodes.push(el('p', { className: 'question' }, 'Sent!'), button('Edit my answer', () => {
      draft = { step: s.step, text: s.mine, hint: s.hint };
      return send({ action: 'unsend' });
    }, 'alt'));
    else {
      if (draft.step !== s.step) draft = { step: s.step, text: '' };
      if (s.hint && draft.hint !== s.hint) draft = { step: s.step, text: s.hint, hint: s.hint };
      const input = el('input', { value: draft.text, oninput: () => { draft.text = input.value; }, maxLength: 60, placeholder: s.isSubject ? 'Your honest answer' : game === 'bluff' ? 'Your fake answer' : 'Your fake title', autocomplete: 'off', enterKeyHint: 'send' });
      if (s.subject) nodes.push(el('p', {}, s.isSubject ? 'This one is about you. Tell the truth.' : `Answer as if you were ${s.subject}.`));
      nodes.push(el('form', { onsubmit: e => { e.preventDefault(); send({ action: 'fake', text: input.value }); } }, input, el('button', { className: 'big' }, 'Send')));
      if (s.canHint) nodes.push(button('AI help (half points)', async e => {
        e.target.disabled = true; e.target.textContent = 'Thinking…';
        await send({ action: 'hint' });
        if (e.target.isConnected) { e.target.disabled = false; e.target.textContent = 'AI help (half points)'; }
      }, 'alt'));
      if (s.hint) nodes.push(el('p', { className: 'fine' }, 'Suggested by Claude. Edit it if you like. Fooling someone this round earns half.'));
    }
  } else if (s.phase === 'voting') {
    nodes.push(...subject(), el('p', {}, 'Which one is real?'));
    if (s.isArtist) nodes.push(el('p', { className: 'question' }, "They're voting on your drawing."));
    else if (s.isSubject) nodes.push(el('p', { className: 'question' }, 'They are guessing which answer is yours.'));
    else if (s.sent) nodes.push(el('p', { className: 'question' }, 'Vote locked in.'));
    else nodes.push(...s.options.map((o, i) => Object.assign(button(o.mine ? `${o.text} (yours)` : o.text, () => send({ action: 'vote', choice: i })), { disabled: o.mine })));
  } else if (s.phase === 'reveal') {
    const fooledBy = s.players.filter(p => s.bluffedBy.includes(p.id));
    // Fakes flip in one at a time with the truth last, then the damage report.
    const ranked = [...s.options].sort((a, b) => a.truth - b.truth);
    const after = node => timed(node, reveal.at, 0.2 + ranked.length * reveal.gap);
    nodes.push(...subject(), s.artist && el('p', {}, `Drawn by ${s.artist}`),
      s.drawing && button('Save drawing', () => savePicture([{ text: s.options.find(o => o.truth).text, big: true }, { strokes: s.drawing }, { text: `Drawn by ${s.artist}` }], 'doodle'), 'alt'),
      ...ranked.map((o, i) => timed(el('p', { className: 'note card' + (o.truth ? ' truth' : '') },
        ...o.authorIds.map(id => faceImg(id)), el('b', {}, `${o.truth ? 'REAL: ' : 'Fake: '}${o.text}`), el('br'),
        o.truth ? '' : `by ${o.authors.join(' & ')}${o.helped.length ? ` (AI help: ${o.helped.join(', ')})` : ''} · `, o.voters.length ? `picked by ${o.voters.join(', ')}` : 'nobody picked it', like(o.authorIds)), reveal.at, 0.2 + i * reveal.gap)),
      fooledBy.length > 0 && after(el('section', { className: 'bluffed' },
        el('h2', {}, `Bluffed by ${fooledBy.map(p => p.name).join(' & ')}!`), ...fooledBy.map(p => faceImg(p.id, 'large')))),
      after(scores(ranked.length)));
    if (host) nodes.push(button(s.index + 1 >= s.total ? 'Final scores' : 'Next round', () => send({ action: 'next' })));
  } else {
    const top = Math.max(...s.players.map(p => p.score));
    if (game === 'telephone') {
      nodes.push(el('h1', {}, 'The end'), el('p', { className: 'question' }, 'Every book has been read.'));
      const favorites = s.favorites ?? [];
      if (favorites.length) {
        const key = `${me.code}:${s.step}`;
        if (ceremony.key !== key) { ceremony = { key, at: Date.now() + covered() }; play('fanfare', covered() / 1000 + 0.2, host); }
        nodes.push(el('h2', {}, favorites.length > 1 ? 'Fan favorites (tie)' : 'Fan favorite'), ...favorites.map(f => timed(el('section', { className: 'answer winner card' },
          el('div', { className: 'crown', ariaHidden: 'true' }), picture(f.strokes), el('b', {}, f.prompt),
          el('p', {}, `Drawn by ${f.artist}. ${f.votes} ${f.votes === 1 ? 'vote' : 'votes'}.`),
          button('Save picture', () => savePicture([{ text: f.prompt, big: true }, { strokes: f.strokes }, { text: `Drawn by ${f.artist}` }], 'fan-favorite'), 'alt')), ceremony.at, 0.2)));
      }
    } else {
      const winners = s.players.filter(p => p.score === top).map(p => p.name);
      const key = `${me.code}:${s.step}`;
      if (ceremony.key !== key) {
        ceremony = { key, at: Date.now() + covered() };
        if (top > 0) { play('drumroll', covered() / 1000 + 0.1, host); play('fanfare', covered() / 1000 + WINNER_AT, host); }
      }
      const verdict = el('p', { className: 'question verdict' }, s.headline ? s.headline : top ? `${winners.join(' & ')} ${winners.length > 1 ? 'tie for the win!' : 'wins!'}` : 'Nobody scored. A true tie!');
      nodes.push(el('h1', {}, 'Final scores'),
        top > 0 ? timed(verdict, ceremony.at, WINNER_AT + 0.5) : verdict,
        top > 0 && podium(s.players.map(p => ({ name: p.name, score: p.score, face: faceImg(p.id) })), ceremony.at),
        top > 0 ? timed(scores(), ceremony.at, WINNER_AT + 0.8) : scores());
      if (s.cast) nodes.push(timed(el('section', { className: 'answer' }, el('h2', {}, 'Who was who'), s.cast.map(line => el('p', {}, line))), ceremony.at, WINNER_AT + 1));
    }
    if (s.miniTrophy) nodes.push(timed(el('section', { className: 'answer trophy' }, el('h2', {}, 'Mini Game Trophy'), el('b', {}, s.miniTrophy.names.join(' and ')),
      el('p', {}, `${s.miniTrophy.wins} round ${s.miniTrophy.wins === 1 ? 'win' : 'wins'}`)), ceremony.at, WINNER_AT + 0.9));
    if (s.mostLiked?.length) nodes.push(timed(el('section', { className: 'liked-list' }, el('h2', {}, 'Most liked'),
      s.mostLiked.map(l => el('div', { className: 'answer' }, el('b', { className: 'verse' }, l.text),
        el('p', {}, `${l.by || 'The real answer'}: ${l.likes} ${l.likes === 1 ? 'like' : 'likes'}`)))), ceremony.at, WINNER_AT + 1.1));
    if (s.awards?.length) nodes.push(timed(el('section', { className: 'awards' }, el('h2', {}, 'Awards'),
      s.awards.map(a => el('div', { className: 'answer' }, el('b', {}, a.title), el('p', {}, a.names.join(' & ')),
        el('p', { className: 'fine' }, `${a.detail[0].toUpperCase()}${a.detail.slice(1)} (${a.times})`)))), ceremony.at, WINNER_AT + 1.2));
    nodes.push(...nightBoard(host), ...highlightReel(), ...invite());
    nodes.push(topicPicker(host));
    if (host) nodes.push(el('h2', {}, 'Play again'), ...startButtons(), button('Back to lobby', () => send({ action: 'restart' }), 'alt'));
    else nodes.push(el('p', {}, 'Waiting for the host to start another game.'));
    nodes.push(nextGame(host), namePicker(), fold('photo', 'Your photo', facePicker()));
  }
  nodes.push(yoursPanel(), likePanel(), s.phase === 'reveal' && namePicker());
  const exit = button('Leave party', async () => {
    if (!await ask('Leave the party?', `You can come back with the code ${me.code}.`, 'Leave party')) return;
    remember();
    await quit(); leave();
  }, 'alt');
  if (!['lobby', 'done'].includes(s.phase)) nodes.push(el('p', { className: 'fine party-code' }, `Room code ${me.code}`));
  if (['writing', 'drawing', 'voting'].includes(s.phase)) nodes.unshift(clock);
  if (['reveal', 'done'].includes(s.phase)) nodes.push(cheers);
  nodes.push(nudge.panel, games.panel, controls, waiting, note, el('div', { className: 'prefs' }, soundButton(), musicButton(), textSizeButton()), exit,
    game === 'bluff' && el('footer', {}, 'Trivia: ', el('a', { href: 'https://opentdb.com' }, 'Open Trivia Database'), ' (CC BY-SA 4.0), filtered, plus some written for this app.'));
  app.replaceChildren(...nodes.filter(Boolean));
  // Jump to the top for a new screen only, not when browsing topics.
  const screen = `${s.step}:${s.phase}`;
  if (screen !== lastScreen) {
    lastScreen = screen; scrollTo(0, 0);
    // A telephone book grows downward, so follow the newest page.
    if (s.entries?.length > 1) {
      const page = app.querySelector('.page:last-of-type');
      page.scrollIntoView(); enterScreen(page);
    } else enterScreen(app);
  }
}

function lobbyForm() {
  let last = '';
  try { last = localStorage.getItem('name') ?? ''; } catch {}
  const name = el('input', { maxLength: 14, placeholder: 'Your name', autocomplete: 'off', value: last });
  const code = el('input', { maxLength: 4, placeholder: 'Room code', autocomplete: 'off', autocapitalize: 'characters', value: params.get('code') ?? '' });
  const enter = async body => {
    if (busy) return;
    busy = true; note.textContent = '';
    try {
      const data = await api(body);
      try { localStorage.setItem('name', body.name.trim()); } catch {}
      me = { code: data.code, playerId: data.playerId, secret: data.secret, game: data.state.game }; write(me);
      writeLast(null);
      version = 0; shown = ''; apply(data); poll();
      const face = savedFace();
      if (face) api({ action: 'face', data: face, ...me }).then(apply).catch(() => {});
    } catch (err) {
      note.textContent = err.message;
      if (/not found/i.test(err.message) && body.code === readLast()?.code) { writeLast(null); back?.remove(); }
    }
    finally { busy = false; }
  };
  // Still in a party (picked another game from the menu), or stepped out of one.
  const saved = read(), left = readLast(), invited = params.get('code');
  const back = saved ? button(`Return to party ${saved.code}`, () => {
    me = saved; version = 0; shown = ''; app.replaceChildren(el('p', {}, 'Rejoining…'), waiting, note); poll();
  }) : left && (!invited || invited.toUpperCase() === left.code) ? button(`Rejoin party ${left.code}`, () => enter({ action: 'join', code: left.code, name: left.name })) : null;
  app.replaceChildren(...[homeLink(), el('h1', {}, title()), back, name,
    button('Create a room', () => enter({ action: 'create', game, name: name.value })),
    code, button('Join room', () => enter({ action: 'join', code: code.value, name: name.value }), 'alt'), note].filter(Boolean));
}

// A locked phone resumes where it left off.
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) { version = 0; pinged = 0; poll(); } });
const invited = params.get('code')?.toUpperCase();
const otherGame = !invited && asked && me?.game && me.game !== asked;
if (me && !otherGame && (!invited || invited === me.code)) { app.replaceChildren(el('p', {}, 'Rejoining…'), waiting, note); poll(); }
else { me = null; lobbyForm(); }
savedFace(); // erases an expired photo whenever this page is opened
