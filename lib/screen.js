// What a TV in the room may show. Everyone can see it, so fields are listed one by one:
// anything not named here (roles, private prompts, your own answer...) never leaves the server.
import { view } from './rules.js';

const ALWAYS = ['game', 'phase', 'step', 'index', 'total', 'round', 'rounds', 'matchup', 'matchups', 'bookNumber', 'books', 'stage', 'last',
  'waiting', 'progress', 'timeLeft', 'night', 'reactions', 'notice'];
const SHOWN = {
  lobby: [],
  drawing: [],
  writing: ['question', 'drawing', 'artist', 'subject'],
  voting: ['question', 'drawing', 'artist', 'subject', 'options', 'answers', 'suspects', 'author', 'authorId', 'choices', 'living', 'inDanger', 'gallery'],
  reveal: ['question', 'drawing', 'artist', 'subject', 'options', 'gains', 'likes', 'yes', 'no', 'author', 'authorId', 'faker', 'fakerId', 'caught',
    'saved', 'goneName', 'goneRole', 'over', 'tally', 'living', 'answer', 'right', 'inDanger', 'spared', 'fallen', 'picks', 'entries', 'owner', 'more'],
  done: ['awards', 'mostLiked', 'miniTrophy', 'headline', 'cast', 'favorites'],
};
// While writing, these games give each player something different, or something one player mustn't see.
const PRIVATE_PROMPT = ['faceoff', 'rap', 'oddone', 'split', 'telephone'];
const only = (item, keys) => Object.fromEntries(keys.filter(k => item[k] !== undefined).map(k => [k, item[k]]));
const POKES = 6, FRESH = 3 * 60 * 1000;

export function screen(room, now = Date.now()) {
  const full = view(room, '');
  const out = only(full, [...ALWAYS, ...SHOWN[room.phase] ?? []]);
  if (room.phase === 'writing' && PRIVATE_PROMPT.includes(room.game)) delete out.question;
  if (out.options) out.options = out.options.map(({ mine, ...o }) => o);
  if (room.phase === 'voting') {
    if (out.options) out.options = out.options.map(o => only(o, ['id', 'name', 'text']));
    if (out.answers) out.answers = out.answers.map(a => only(a, ['n', 'text']));
    if (out.gallery) out.gallery = out.gallery.map(g => only(g, ['by', 'prompt', 'strokes']));
  }
  out.players = room.players.map(({ id, name, score }) => ({ id, name, score }));
  const name = id => room.players.find(p => p.id === id)?.name;
  out.pokes = (room.pokesOff ? [] : room.pokes ?? []).filter(p => now - p.at < FRESH && name(p.to)).slice(-POKES)
    .map(({ n, from, to, text }) => ({ n, from, to: name(to), text }));
  return out;
}
