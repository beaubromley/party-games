// Screens for Face-Off, Majority Rules and Telephone Doodle.
import { el, timed } from './ui.js';
import { picture, sketchpad } from './canvas.js';
import { DOODLE_PROMPTS } from './words.js';
import { savePicture } from './save.js';
import { MORE_GAMES, moreScreen } from './more-ui.js';

export const PARTY_GAMES = {
  faceoff: { title: 'Face-Off', blurb: 'Two answers, one winner. Best with 3 or more.',
    starts: [['Start: 1 round', 1], ['Start: 2 rounds', 2]] },
  majority: { title: 'Majority Rules', blurb: 'Think like everyone else. Best with 3 or more.',
    starts: [5, 8, 12].map(n => [`Start: ${n} questions`, n]) },
  telephone: { title: 'Telephone Doodle', blurb: 'Write, draw, guess, repeat. Best with 4 or more.',
    starts: [['Start passing', 0]] },
  rap: { title: 'Rhyme Battle', blurb: 'Finish the verse, battle head to head. Best with 3 or more.',
    starts: [['Start: 1 round', 1], ['Start: 2 rounds', 2]] },
  ...MORE_GAMES,
};
// Reads a verse out in the phone's own voice.
function perform(text) {
  if (!window.speechSynthesis) return false;
  return el('button', { className: 'like hear', onclick: () => {
    speechSynthesis.cancel();
    const voice = new SpeechSynthesisUtterance(text.replaceAll('\n', '. '));
    voice.rate = 1.05; voice.pitch = 0.8;
    speechSynthesis.speak(voice);
  } }, 'Hear it');
}

let draft = { key: '', text: '' }; // typed text survives redraws
let picked = null; // host's first tap when combining answers

export function partyScreen(context) {
  const { s, host, send, button, faceImg, scores, redraw, reveal, like } = context;
  // Results flip in one at a time; `order` is each card's place in the queue.
  const card = (node, order) => { node.classList.add('card'); return timed(node, reveal.at, 0.2 + order * reveal.gap); };
  const after = (node, order) => timed(node, reveal.at, 0.2 + order * reveal.gap);
  const say = text => el('p', { className: 'question' }, text);
  const answerForm = (placeholder, maxLength, extra) => {
    const key = `${s.you}:${s.step}:${s.item ?? ''}`;
    if (draft.key !== key) draft = { key, text: '' };
    if (s.hint && draft.hint !== s.hint) draft = { key, text: s.hint, hint: s.hint };
    const input = el('input', { value: draft.text, oninput: () => { draft.text = input.value; }, maxLength, placeholder, autocomplete: 'off', enterKeyHint: 'send' });
    return [el('form', { onsubmit: e => { e.preventDefault(); send({ action: 'fake', text: input.value, item: s.item }); } }, input, el('button', { className: 'big' }, 'Send')),
      extra && button('Give me an idea', () => { input.value = draft.text = extra[Math.floor(Math.random() * extra.length)]; }, 'alt')];
  };
  // Pulls a sent answer back into the box.
  const edit = (label, text, item) => button(label, () => {
    draft = { key: `${s.you}:${s.step}:${item ?? ''}`, text };
    return send({ action: 'unsend', item });
  }, 'alt');
  const onward = label => host && button(label, () => send({ action: 'next' }));
  const nodes = [];
  if (Object.hasOwn(MORE_GAMES, s.game)) return moreScreen({ ...context, card, after, say, answerForm, edit, onward });
  const rap = s.game === 'rap';
  // The two lines to rhyme with, each followed by a box.
  const verseForm = () => {
    const key = `${s.you}:${s.step}:${s.item}`;
    if (draft.key !== key) draft = { key, text: '', lines: ['', ''] };
    draft.lines ??= ['', ''];
    const inputs = [0, 1].map(i => el('input', { value: draft.lines[i], oninput: e => { draft.lines[i] = e.target.value; }, maxLength: 60, placeholder: 'Your rhyme', ariaLabel: `Your rhyme ${i + 1}`, autocomplete: 'off', enterKeyHint: i ? 'send' : 'next' }));
    return el('form', { onsubmit: e => { e.preventDefault(); send({ action: 'fake', text: inputs.map(x => x.value), item: s.item }); } },
      ...inputs.flatMap((input, i) => [el('p', { className: 'starter' }, s.starters[i]), input]), el('button', { className: 'big' }, 'Send'));
  };

  if (s.game === 'faceoff' || rap) {
    const round = s.rounds > 1 ? `Round ${s.round} of ${s.rounds}${s.round > 1 ? ' (double points)' : ''}` : PARTY_GAMES[s.game].title;
    if (s.phase === 'writing') {
      nodes.push(el('p', {}, round));
      if (s.sittingOut) nodes.push(say("You're in! Get ready to vote on these."));
      else if (s.sent) nodes.push(say('Both answers are in!'));
      else if (rap) nodes.push(el('p', {}, `Your verse ${s.number} of 2`), verseForm());
      else nodes.push(el('p', {}, `Your prompt ${s.number} of 2`), say(s.question), ...answerForm('Make them laugh', 60),
        s.canHint && button('AI help (half points)', async e => {
          e.target.disabled = true; e.target.textContent = 'Thinking…';
          await send({ action: 'hint' });
          if (e.target.isConnected) { e.target.disabled = false; e.target.textContent = 'AI help (half points)'; }
        }, 'alt'),
        s.hint && el('p', { className: 'fine' }, 'Suggested by Claude. Edit it if you like. It earns half points.'));
      nodes.push(...s.written.map((w, i) => rap ? button(`Edit sent verse ${i + 1}`, () => {
        draft = { key: `${s.you}:${s.step}:${w.item}`, text: '', lines: [...w.lines] };
        return send({ action: 'unsend', item: w.item });
      }, 'alt') : edit(`Edit “${w.text}”`, w.text, w.item)));
    } else if (s.phase === 'voting') {
      nodes.push(el('p', {}, `${round}. Matchup ${s.matchup} of ${s.matchups}`), say(s.question));
      if (!s.canVote) nodes.push(say('This one is yours. Act natural.'));
      else if (s.sent) nodes.push(say('Vote locked in.'));
      else nodes.push(...s.options.flatMap((o, i) => [Object.assign(button(o.mine ? `${o.text} (yours)` : o.text, () => send({ action: 'vote', choice: i }), rap ? 'verse' : ''), { disabled: o.mine }), rap && perform(o.text)]));
      if (rap && (!s.canVote || s.sent)) nodes.push(...s.options.map(o => el('section', { className: 'answer' }, el('b', { className: 'verse' }, o.text), perform(o.text))));
    } else {
      const top = Math.max(...s.options.map(o => o.voters.length));
      // Fewest votes first, so the winner lands last.
      const ranked = [...s.options].sort((a, b) => a.voters.length - b.voters.length);
      nodes.push(say(s.question), ...ranked.map((o, i) => card(el('section', { className: 'answer' + (top && o.voters.length === top ? ' winner' : '') },
        el('b', { className: rap ? 'verse' : '' }, o.text), rap && perform(o.text), el('p', {}, faceImg(o.authorId), o.author, o.helped ? ' (AI help)' : '', s.gains[o.authorId] ? ` +${s.gains[o.authorId]}` : ''),
        el('p', { className: 'fine' }, s.options.length < 2 ? 'No opponent answered.' : o.voters.length ? `Picked by ${o.voters.join(', ')}` : 'No votes'), like([o.authorId])), i)),
        after(scores(ranked.length), ranked.length), onward(s.last ? 'Final scores' : 'Next'));
    }
  } else if (s.game === 'majority') {
    nodes.push(el('p', {}, `Question ${s.index + 1} of ${s.total}`), say(s.question));
    if (s.phase === 'writing') {
      if (s.sent) nodes.push(say('Sent! Did you think like the others?'), edit('Edit my answer', s.mine));
      else nodes.push(el('p', {}, 'What will most people say?'), ...answerForm('Your answer', 40));
    } else {
      if (picked && picked.step !== s.step) picked = null;
      if (!s.options.length) nodes.push(say('Nobody answered.'));
      else if (!s.options.some(o => o.scored)) nodes.push(say('No majority this time.'));
      nodes.push(...s.options.map((o, i) => card(el('section', { className: 'answer' + (o.scored ? ' winner' : '') },
        el('b', {}, `${o.text} (${o.authors.length})`), el('p', {}, ...o.authorIds.map(id => faceImg(id)), o.authors.join(', ')),
        host && s.options.length > 1 && el('button', { className: picked?.index === i ? 'on' : '', onclick: () => {
          if (!picked) picked = { step: s.step, index: i };
          else if (picked.index === i) picked = null;
          else { const a = picked.index; picked = null; return send({ action: 'merge', a, b: i }); }
          redraw();
        } }, picked?.index === i ? 'Cancel' : picked ? 'Same as selected' : 'Combine'), like(o.authorIds)), s.options.length - 1 - i)));
      if (host && s.options.length > 1) nodes.push(el('p', { className: 'fine' }, 'Host: if two answers mean the same thing, combine them.'));
      nodes.push(after(scores(s.options.length), s.options.length), onward(s.last ? 'Final scores' : 'Next question'));
    }
  } else if (s.phase === 'writing') {
    nodes.push(el('p', {}, `Turn ${s.index + 1} of ${s.total}`));
    if (s.sittingOut) nodes.push(say("You're in! You'll play the next game, and you can vote at the end of this one."));
    else if (s.sent) nodes.push(say('Sent! Waiting to pass.'), edit('Edit my answer', s.mine));
    else if (!s.prev) nodes.push(say('Write something for the next player to draw.'), ...answerForm('A moose on roller skates', 80, DOODLE_PROMPTS));
    else nodes.push(picture(s.prev.strokes), say('What is this?'), ...answerForm('Describe the drawing', 80));
  } else if (s.phase === 'drawing') {
    nodes.push(el('p', {}, `Turn ${s.index + 1} of ${s.total}`));
    if (s.sittingOut) nodes.push(say("You're in! You'll play the next game, and you can vote at the end of this one."));
    else if (s.sent) nodes.push(say('Nice art! Waiting to pass.'));
    else {
      const pad = sketchpad();
      nodes.push(el('p', {}, 'Draw this:'), say(s.prev.text), ...pad.nodes, button('Send drawing', () => send({ action: 'drawing', strokes: pad.strokes() })));
    }
  } else if (s.phase === 'voting') {
    nodes.push(say(s.sent ? 'Vote locked in.' : 'Pick your favorite drawing'), ...s.gallery.map(d => el('section', { className: 'page' },
      picture(d.strokes), el('p', {}, el('b', {}, d.prompt)), el('p', {}, faceImg(d.byId), `Drawn by ${d.by}`),
      s.favorite === d.key ? el('p', { className: 'fav on' }, 'Your favorite')
        : !s.sent && d.byId !== s.you && el('button', { className: 'fav', onclick: () => send({ action: 'vote', choice: d.key }) }, 'Pick this one'))));
  } else {
    nodes.push(el('h2', {}, `${s.owner}'s book (${s.bookNumber} of ${s.books})`), ...s.entries.map((e, i) => el('section', { className: 'page' },
      el('p', {}, faceImg(e.byId), `${e.by} ${e.strokes ? 'drew' : i ? 'saw' : 'wrote'}${e.skipped ? ' (skipped)' : ''}`),
      e.strokes ? picture(e.strokes) : say(e.text))),
      !s.more && button('Save this book', () => savePicture([{ text: `${s.owner}'s book`, big: true },
        ...s.entries.flatMap((e, i) => [{ text: `${e.by} ${e.strokes ? 'drew' : i ? 'saw' : 'wrote'}` }, e.strokes ? { strokes: e.strokes } : { text: e.text, big: true }])], 'telephone-book'), 'alt'),
      onward(s.last ? 'Vote for a favorite' : s.more ? 'Show next page' : 'Next book'), !host && el('p', {}, 'The host turns the pages.'));
  }
  return nodes;
}
