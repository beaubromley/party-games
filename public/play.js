import { el, homeLink } from './ui.js';
import { picture, sketchpad } from './canvas.js';
import { shrink } from './face.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
let game = params.get('game') === 'doodle' ? 'doodle' : 'bluff';
const read = () => { try { return JSON.parse(localStorage.getItem('room')); } catch { return null; } };
const write = v => { try { v ? localStorage.setItem('room', JSON.stringify(v)) : localStorage.removeItem('room'); } catch {} };
const TOPICS = [['trivia', 'Trivia'], ['thanksgiving', 'Thanksgiving'], ['music', 'Music'], ['sports', 'Sports'], ['oklahoma', 'Oklahoma history'], ['disney', 'Disney Channel'], ['bible', 'Bible'], ['words', 'Word meanings'], ['about', 'About us']];
let topic = 'trivia';
let me = read(), version = 0, shown = '', state, timer, busy = false;
const note = el('p', { className: 'note error', role: 'status' });
const waiting = el('p', { className: 'note' });
let faces = {}, facesKey = '';
let draft = { step: 0, text: '' }; // typed answer, kept across redraws
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
    note.textContent = '';
  } catch (err) { note.textContent = err.status ? err.message : "That photo didn't work. Try another."; }
}
function facePicker() {
  const mine = state.players.find(p => p.id === state.you);
  const input = el('input', { type: 'file', accept: 'image/*', hidden: true, id: 'face', onchange: () => input.files[0] && sendFace(input.files[0]) });
  return el('div', {}, input,
    button(mine.face ? 'Change your bluff face' : 'Add your bluff face', () => input.click(), 'alt'),
    mine.face && button('Remove photo', () => sendFace(null), 'alt'),
    el('p', { className: 'fine' }, 'Shows when you fool someone. Only this room sees it. It is deleted the next time a room is created after this one has been idle for a day.'));
}
const title = () => game === 'doodle' ? 'Doodle Bluff' : 'Bluff';

async function api(body) {
  const res = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Server problem. Try again.'), { status: res.status });
  return data;
}
const button = (label, onclick, extra = '') => el('button', { className: 'big ' + extra, onclick }, label);
function leave() { clearTimeout(timer); faces = {}; facesKey = ''; me = null; write(null); version = 0; shown = ''; lobbyForm(); }

async function send(body) {
  if (busy) return;
  busy = true; note.textContent = '';
  try { apply(await api({ ...body, ...me, step: state.step })); }
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
    apply(data);
  } catch (err) {
    if (me !== mine) return;
    if (/not found|not in this room/i.test(err.message)) { leave(); note.textContent = 'That room has ended.'; return; }
    waiting.textContent = 'Reconnecting…'; version = 0;
  }
  clearTimeout(timer);
  timer = setTimeout(poll, 1500);
}

function apply(data) {
  if (!data.state || data.version < version) return;
  version = data.version; state = data.state; game = state.game;
  waiting.textContent = state.waiting.length ? `Waiting on: ${state.waiting.join(', ')}` : '';
  // Only rebuild when the screen really changes, so a half-typed answer or drawing survives polling.
  const key = [state.step, state.sent, state.hint, state.canHint, state.phase === 'lobby' && state.players.length,
    FACE_SCREENS.includes(state.phase) && state.players.map(p => p.face).join()].join(':');
  if (key !== shown) { shown = key; note.textContent = ''; render(); }
  loadFaces();
}

function render() {
  const s = state, host = s.you === s.host;
  const nodes = [];
  const scores = () => el('ol', { id: 'recap' }, [...s.players].sort((a, b) => b.score - a.score)
    .map(p => el('li', {}, faceImg(p.id), `${p.name}: ${p.score}${s.gains?.[p.id] ? ` (+${s.gains[p.id]})` : ''}`)));
  const subject = () => [s.question && el('p', { className: 'question' }, s.question), s.drawing && picture(s.drawing)];
  const startButtons = () => game === 'bluff'
    ? [el('div', { className: 'chips', role: 'group', ariaLabel: 'Topic' }, TOPICS.map(([id, label]) =>
        el('button', { className: id === topic ? 'on' : '', ariaPressed: id === topic, onclick: () => { topic = id; render(); } }, label))),
      ...[3, 5, 8].map(n => button(`Start: ${n} questions`, () => send({ action: 'start', topic, rounds: n })))]
    : [button('Start drawing', () => send({ action: 'start' }))];

  if (s.phase === 'lobby') {
    const link = `${location.origin}/play.html?game=${game}&code=${me.code}`;
    nodes.push(el('h1', {}, title()), el('p', {}, 'Room code'), el('p', { className: 'code' }, me.code),
      button('Share invite link', async () => {
        try { navigator.share ? await navigator.share({ url: link }) : (await navigator.clipboard.writeText(link), note.textContent = 'Link copied'); } catch {}
      }, 'alt'),
      el('ul', { id: 'recap' }, s.players.map(p => el('li', {}, faceImg(p.id), p.name))), facePicker());
    if (host && s.players.length >= 2) nodes.push(...startButtons());
    else nodes.push(el('p', {}, s.players.length < 2 ? 'Need at least 2 players.' : 'Waiting for the host to start.'));
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
    else if (s.sent) nodes.push(el('p', { className: 'question' }, 'Sent!'));
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
    if (fooledBy.length) nodes.push(el('section', { className: 'bluffed' },
      el('h2', {}, `Bluffed by ${fooledBy.map(p => p.name).join(' & ')}!`), ...fooledBy.map(p => faceImg(p.id, 'large'))));
    nodes.push(...subject(), s.artist && el('p', {}, `Drawn by ${s.artist}`),
      ...[...s.options].sort((a, b) => a.truth - b.truth).map(o => el('p', { className: 'note' },
        ...o.authorIds.map(id => faceImg(id)), el('b', {}, `${o.truth ? 'REAL: ' : 'Fake: '}${o.text}`), el('br'),
        o.truth ? '' : `by ${o.authors.join(' & ')}${o.helped.length ? ` (AI help: ${o.helped.join(', ')})` : ''} · `, o.voters.length ? `picked by ${o.voters.join(', ')}` : 'nobody picked it')),
      scores());
    if (host) nodes.push(button(s.index + 1 >= s.total ? 'Final scores' : 'Next round', () => send({ action: 'next' })));
  } else {
    const top = Math.max(...s.players.map(p => p.score));
    nodes.push(el('h1', {}, 'Final scores'), el('p', { className: 'question' }, `${s.players.filter(p => p.score === top).map(p => p.name).join(' & ')} wins!`), scores());
    if (host) nodes.push(...startButtons());
    nodes.push(facePicker());
  }
  if (host && ['drawing', 'writing', 'voting'].includes(s.phase)) nodes.push(button('Host: skip waiting', () => send({ action: 'next' }), 'alt'));
  nodes.push(waiting, note, button('Leave game', () => { if (confirm('Leave this game? You cannot rejoin once it has started.')) leave(); }, 'alt'),
    game === 'bluff' && el('footer', {}, 'Trivia: ', el('a', { href: 'https://opentdb.com' }, 'Open Trivia Database'), ' (CC BY-SA 4.0), filtered, plus some written for this app.'));
  app.replaceChildren(...nodes.filter(Boolean));
  scrollTo(0, 0);
}

function lobbyForm() {
  const name = el('input', { maxLength: 14, placeholder: 'Your name', autocomplete: 'off' });
  const code = el('input', { maxLength: 4, placeholder: 'Room code', autocomplete: 'off', autocapitalize: 'characters', value: params.get('code') ?? '' });
  const enter = async body => {
    if (busy) return;
    busy = true; note.textContent = '';
    try {
      const data = await api(body);
      me = { code: data.code, playerId: data.playerId, secret: data.secret }; write(me);
      version = 0; shown = ''; apply(data); poll();
    } catch (err) { note.textContent = err.message; }
    finally { busy = false; }
  };
  app.replaceChildren(homeLink(), el('h1', {}, title()), name,
    button('Create a room', () => enter({ action: 'create', game, name: name.value })),
    code, button('Join room', () => enter({ action: 'join', code: code.value, name: name.value }), 'alt'), note);
}

// A locked phone resumes where it left off.
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) { version = 0; poll(); } });
const invited = params.get('code')?.toUpperCase();
if (me && (!invited || invited === me.code)) { app.replaceChildren(el('p', {}, 'Rejoining…'), waiting, note); poll(); }
else { me = null; lobbyForm(); }
