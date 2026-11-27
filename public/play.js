import { el, homeLink, podium, timed, enterScreen, WINNER_AT } from './ui.js';
import { play, soundOn, setSound } from './sound.js';
import { keepAwake } from './wake.js';
import { savePicture } from './save.js';
import { picture, sketchpad } from './canvas.js';
import { shrink, saveFace, savedFace, FACE_DAYS } from './face.js';
import { BLUFF_TOPICS } from './topics.js';
import { PARTY_GAMES, partyScreen } from './party-ui.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const asked = params.get('game');
let game = asked === 'doodle' || Object.hasOwn(PARTY_GAMES, asked) ? asked : 'bluff';
const read = () => { try { return JSON.parse(localStorage.getItem('room')); } catch { return null; } };
const write = v => { try { v ? localStorage.setItem('room', JSON.stringify(v)) : localStorage.removeItem('room'); } catch {} };
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
    host && button('Reset standings', () => { if (confirm("Clear tonight's standings?")) send({ action: 'forget' }); }, 'alt')];
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
  telephone: ['Write a phrase, then pass it on.', 'The next player draws it, the one after describes the drawing, and so on.', 'Read the books together and pick a favorite drawing.'],
};
const soundButton = () => {
  const fallback = state.you === state.host, on = soundOn(fallback);
  return el('button', { className: 'sound', ariaPressed: on, onclick: () => { setSound(!on); render(); if (!on) setTimeout(() => play('ding'), 100); } }, `Sound: ${on ? 'on' : 'off'}`);
};
let me = read(), version = 0, shown = '', state, timer, busy = false;
const note = el('p', { className: 'note error', role: 'status' });
const waiting = el('p', { className: 'note' });
let faces = {}, facesKey = '';
let draft = { step: 0, text: '' }; // typed answer, kept across redraws
// Host controls live in one element that updates by itself, so changing them never wipes a drawing.
const controls = el('div');
let nudged = '';
let controlsKey = '', managing = false, hostAway = false, pinged = 0;
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
// Host settings shown between games, tucked away under the start buttons.
function gameOptions() {
  const current = TIMER_CHOICES.find(([n]) => n === timerChoice)[1];
  return fold('options', `Game options (timer: ${current.toLowerCase()})`,
    el('h2', {}, 'Timer'),
    el('div', { className: 'chips', role: 'group', ariaLabel: 'Timer' }, TIMER_CHOICES.map(([n, text]) => el('button', { className: n === timerChoice ? 'on' : '', ariaPressed: n === timerChoice,
      onclick: () => { timerChoice = n; try { localStorage.setItem('timer', n); } catch {} render(); } }, text))),
    el('p', { className: 'fine' }, 'A countdown to hurry people along. Nothing skips by itself.'),
    el('h2', {}, 'Switch game (same room)'),
    Object.keys(HOW_TO).filter(id => id !== game).map(id => button(`Switch to ${titleOf(id)}`, () => send({ action: 'switch', game: id }), 'alt')));
}
function updateControls() {
  const host = state.you === state.host, playing = !['lobby', 'done'].includes(state.phase);
  const key = [host, playing, state.phase, state.host, hostAway, state.players.map(p => p.id).join()].join(':');
  if (key === controlsKey) return;
  controlsKey = key;
  const others = state.players.filter(p => p.id !== state.you);
  const hostName = state.players.find(p => p.id === state.host)?.name;
  const panel = el('details', { open: managing, ontoggle: () => { managing = panel.open; } },
    el('summary', {}, 'Manage players'),
    others.map(p => button(`Remove ${p.name}`, () => {
      if (confirm(`Remove ${p.name} from this game?`)) send({ action: 'kick', target: p.id });
    }, 'alt')),
    playing && button('Restart: back to lobby', () => {
      if (confirm('End this game and send everyone back to the lobby? Scores reset.')) send({ action: 'restart' });
    }, 'alt'));
  controls.replaceChildren(...[
    host && ['drawing', 'writing', 'voting'].includes(state.phase) && button('Host: skip waiting', () => send({ action: 'next' }), 'alt'),
    host && (others.length > 0 || playing) && panel,
    !host && hostAway && el('p', {}, `${hostName}, the host, seems to be away.`),
    !host && hostAway && button('Take over as host', () => { if (confirm('Become the host of this room?')) send({ action: 'claim' }); }, 'alt'),
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
// Tells the room, so the game can carry on without this phone.
async function quit() {
  const mine = me;
  clearTimeout(timer); me = null;
  try { await api({ action: 'leave', ...mine }); } catch {}
}
function leave() { opened.clear(); misses = 0; banner.hidden = true; banner.className = 'banner'; heard = null; bubbles.replaceChildren(); keepAwake(false); deadline = 0; clearTimeout(timer); controlsKey = ''; controls.replaceChildren(); managing = false; hostAway = false; pinged = 0; preview = null; topic = 'trivia'; faces = {}; facesKey = ''; me = null; write(null); version = 0; shown = ''; lobbyForm(); }

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
    if (/not found|not in this room/i.test(err.message)) { const ended = /not found/i.test(err.message); leave(); note.textContent = ended ? 'That room has ended.' : 'You are no longer in that room.'; return; }
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
  const done = state.progress?.filter(p => p.done).length;
  waiting.replaceChildren(...state.progress ? [el('span', {}, `${done} of ${state.progress.length} done`),
    el('span', { className: 'who-done' }, state.progress.map(p => el('span', { className: p.done ? 'done' : '', ariaLabel: `${p.name}: ${p.done ? 'done' : 'still going'}` }, p.name)))] : []);
  // Only rebuild when the screen really changes, so a half-typed answer or drawing survives polling.
  const key = [state.game, state.step, state.sent, state.item, state.favorite, state.night.map(p => p.name + p.points).join(), state.hint, state.canHint, state.phase === 'lobby' && state.players.length,
    FACE_SCREENS.includes(state.phase) && state.players.map(p => [p.id, p.face]).join() + state.host,
    state.requests.map(r => r.id + r.topic).join()].join(':');
  if (key !== shown) {
    // A nudge when there is something new to do.
    const turn = `${state.game}:${state.step}:${state.item ?? ''}`;
    if (['writing', 'drawing', 'voting'].includes(state.phase) && !state.sent && turn !== nudged) { nudged = turn; play('turn', 0, state.you === state.host); }
    shown = key; note.textContent = ''; render();
  }
  updateControls();
  showReactions();
  loadFaces();
}

function render() {
  const s = state, host = s.you === s.host;
  const nodes = [];
  const scores = () => el('ol', { id: 'recap' }, [...s.players].sort((a, b) => b.score - a.score)
    .map(p => el('li', {}, faceImg(p.id), `${p.name}: ${p.score}${s.gains?.[p.id] ? ` (+${s.gains[p.id]})` : ''}`)));
  const subject = () => [s.question && el('p', { className: 'question' }, s.question), s.drawing && picture(s.drawing)];
  if (s.phase === 'reveal') {
    const key = [me.code, game, s.index, s.round, s.matchup, s.bookNumber].join(':');
    if (reveal.key !== key) {
      reveal = { key, at: Date.now(), gap: game === 'majority' ? 0.7 : 1 };
      const cards = game === 'telephone' ? 0 : s.options?.length ?? 0;
      for (let i = 0; i < cards; i++) play('ding', 0.2 + i * reveal.gap, host);
    }
  }
  const startButtons = () => PARTY_GAMES[game]
    ? PARTY_GAMES[game].starts.map(([text, n]) => button(text, () => send({ action: 'start', rounds: n, timer: timerChoice })))
    : game === 'bluff'
    ? [3, 5, 8].map(n => button(`Start: ${n} questions`, () => send({ action: 'start', topic, rounds: n, timer: timerChoice })))
    : [button('Start drawing', () => send({ action: 'start', timer: timerChoice }))];
  if (s.phase === 'lobby') {
    if (s.notice) nodes.push(el('p', { className: 'note error' }, s.notice));
    const link = `${location.origin}/play.html?game=${game}&code=${me.code}`;
    nodes.push(el('h1', {}, title()),
      fold('how', 'How to play', PARTY_GAMES[game] && el('p', {}, PARTY_GAMES[game].blurb), el('ol', { className: 'how' }, HOW_TO[game].map(line => el('li', {}, line)))),
      el('p', {}, 'Room code'), el('p', { className: 'code' }, me.code),
      button('Share invite link', async () => {
        try { navigator.share ? await navigator.share({ url: link }) : (await navigator.clipboard.writeText(link), note.textContent = 'Link copied'); } catch {}
      }, 'alt'),
      el('ul', { id: 'recap' }, s.players.map(p => el('li', {}, faceImg(p.id), p.name))), topicPicker(host));
    if (host && s.players.length >= 2) nodes.push(...startButtons());
    else nodes.push(el('p', {}, s.players.length < 2 ? 'Need at least 2 players.' : 'Waiting for the host to start.'));
    if (host) nodes.push(gameOptions());
    nodes.push(fold('photo', 'Your photo', facePicker()), ...nightBoard(host));
  } else if (PARTY_GAMES[game] && s.phase !== 'done') {
    nodes.push(...partyScreen({ s, host, send, button, faceImg, scores, redraw: render, reveal }));
  } else if (s.phase === 'drawing') {
    if (s.sent) nodes.push(el('h1', {}, 'Nice art!'));
    else {
      const pad = sketchpad();
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
        o.truth ? '' : `by ${o.authors.join(' & ')}${o.helped.length ? ` (AI help: ${o.helped.join(', ')})` : ''} · `, o.voters.length ? `picked by ${o.voters.join(', ')}` : 'nobody picked it'), reveal.at, 0.2 + i * reveal.gap)),
      fooledBy.length > 0 && after(el('section', { className: 'bluffed' },
        el('h2', {}, `Bluffed by ${fooledBy.map(p => p.name).join(' & ')}!`), ...fooledBy.map(p => faceImg(p.id, 'large')))),
      after(scores()));
    if (host) nodes.push(button(s.index + 1 >= s.total ? 'Final scores' : 'Next round', () => send({ action: 'next' })));
  } else {
    const top = Math.max(...s.players.map(p => p.score));
    if (game === 'telephone') {
      nodes.push(el('h1', {}, 'The end'), el('p', { className: 'question' }, 'Every book has been read.'));
      const favorites = s.favorites ?? [];
      if (favorites.length) {
        const key = `${me.code}:${s.step}`;
        if (ceremony.key !== key) { ceremony = { key, at: Date.now() }; play('fanfare', 0.2, host); }
        nodes.push(el('h2', {}, favorites.length > 1 ? 'Fan favorites (tie)' : 'Fan favorite'), ...favorites.map(f => timed(el('section', { className: 'answer winner card' },
          el('div', { className: 'crown', ariaHidden: 'true' }), picture(f.strokes), el('b', {}, f.prompt),
          el('p', {}, `Drawn by ${f.artist}. ${f.votes} ${f.votes === 1 ? 'vote' : 'votes'}.`),
          button('Save picture', () => savePicture([{ text: f.prompt, big: true }, { strokes: f.strokes }, { text: `Drawn by ${f.artist}` }], 'fan-favorite'), 'alt')), ceremony.at, 0.2)));
      }
    } else {
      const winners = s.players.filter(p => p.score === top).map(p => p.name);
      const key = `${me.code}:${s.step}`;
      if (ceremony.key !== key) {
        ceremony = { key, at: Date.now() };
        if (top > 0) { play('drumroll', 0.1, host); play('fanfare', WINNER_AT, host); }
      }
      const verdict = el('p', { className: 'question verdict' }, top ? `${winners.join(' & ')} ${winners.length > 1 ? 'tie for the win!' : 'wins!'}` : 'Nobody scored. A true tie!');
      nodes.push(el('h1', {}, 'Final scores'),
        top > 0 ? timed(verdict, ceremony.at, WINNER_AT + 0.5) : verdict,
        top > 0 && podium(s.players.map(p => ({ name: p.name, score: p.score, face: faceImg(p.id) })), ceremony.at),
        top > 0 ? timed(scores(), ceremony.at, WINNER_AT + 0.8) : scores());
    }
    if (s.awards?.length) nodes.push(timed(el('section', { className: 'awards' }, el('h2', {}, 'Awards'),
      s.awards.map(a => el('div', { className: 'answer' }, el('b', {}, a.title), el('p', {}, a.names.join(' & ')),
        el('p', { className: 'fine' }, `${a.detail[0].toUpperCase()}${a.detail.slice(1)} (${a.times})`)))), ceremony.at, WINNER_AT + 1.2));
    nodes.push(...nightBoard(host));
    nodes.push(topicPicker(host));
    if (host) nodes.push(el('h2', {}, 'Play again'), ...startButtons(), gameOptions());
    else nodes.push(el('p', {}, 'Waiting for the host to start another game.'));
    nodes.push(fold('photo', 'Your photo', facePicker()));
  }
  const exit = s.phase === 'done'
    ? button('All games', async () => { await quit(); write(null); location.href = '/'; }, 'alt')
    : button('Leave game', async () => {
      if (!confirm('Leave this game? The others carry on without you.')) return;
      await quit(); leave();
    }, 'alt');
  if (['writing', 'drawing', 'voting'].includes(s.phase)) nodes.unshift(clock);
  if (['reveal', 'done'].includes(s.phase)) nodes.push(cheers);
  nodes.push(controls, waiting, note, el('div', { className: 'prefs' }, soundButton(), textSizeButton()), exit,
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
      version = 0; shown = ''; apply(data); poll();
      const face = savedFace();
      if (face) api({ action: 'face', data: face, ...me }).then(apply).catch(() => {});
    } catch (err) { note.textContent = err.message; }
    finally { busy = false; }
  };
  app.replaceChildren(homeLink(), el('h1', {}, title()), name,
    button('Create a room', () => enter({ action: 'create', game, name: name.value })),
    code, button('Join room', () => enter({ action: 'join', code: code.value, name: name.value }), 'alt'), note);
}

// A locked phone resumes where it left off.
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) { version = 0; pinged = 0; poll(); } });
const invited = params.get('code')?.toUpperCase();
const otherGame = !invited && asked && me?.game && me.game !== asked;
if (me && !otherGame && (!invited || invited === me.code)) { app.replaceChildren(el('p', {}, 'Rejoining…'), waiting, note); poll(); }
else { me = null; lobbyForm(); }
savedFace(); // erases an expired photo whenever this page is opened
