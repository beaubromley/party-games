// Screens for Odd One Out, Down the Middle, Who Said It?, Midnight Snack and Last One Standing.
import { el } from './ui.js';

export const MORE_GAMES = {
  oddone: { title: 'Odd One Out', blurb: 'One of you is faking. Talk it over and catch them. 3 or more.', min: 3,
    starts: [3, 5, 8].map(n => [`Start: ${n} rounds`, n]) },
  split: { title: 'Down the Middle', blurb: 'Write a dilemma that divides the room. 3 or more.', min: 3,
    starts: [['Start: 1 round', 1], ['Start: 2 rounds', 2]] },
  whosaid: { title: 'Who Said It?', blurb: 'Match each answer to the person who wrote it. 3 or more.', min: 3,
    starts: [3, 5, 8].map(n => [`Start: ${n} questions`, n]) },
  snack: { title: 'Midnight Snack', blurb: 'Secret pie thieves are among you. 4 or more, 6 is better.', min: 4,
    starts: [['Start the first night', 0]] },
  survival: { title: 'Last One Standing', blurb: 'Trivia where a miss puts you in danger.',
    starts: [8, 12, 16].map(n => [`Start: ${n} questions`, n]) },
};

let guesses = { key: '', picks: {} }; // Who Said It? choices survive redraws
let peeking = ''; // the Midnight Snack screen whose role is showing

export function moreScreen({ s, host, send, button, faceImg, scores, redraw, like, card, after, say, answerForm, edit, onward }) {
  const nodes = [];
  const count = () => el('p', {}, `Round ${s.index + 1} of ${s.total}`);
  const choose = (label, choice, extra = '') => button(label, () => send({ action: 'vote', choice }), extra);
  const sitting = () => say("You're in! You'll join the next round.");

  if (s.game === 'oddone') {
    nodes.push(count());
    if (s.phase === 'writing') {
      if (s.sittingOut) nodes.push(sitting());
      else {
        nodes.push(say(s.question), s.faking && el('p', {}, `Blend in. Your only clue: ${s.clue}.`), !s.faking && el('p', {}, 'One of you never saw this. Answer without making it too obvious.'));
        if (s.sent) nodes.push(say('Sent!'), edit('Edit my answer', s.mine));
        else nodes.push(...answerForm('Your answer', 40));
      }
    } else if (s.phase === 'voting') {
      if (s.sittingOut) nodes.push(sitting());
      nodes.push(el('p', {}, 'The real prompt was:'), say(s.question), el('p', {}, "Talk it over. Who didn't know it?"));
      if (s.sent) nodes.push(...s.options.map(o => el('section', { className: 'answer' }, el('b', {}, o.text), el('p', {}, faceImg(o.id), o.name))), !s.sittingOut && say('Vote locked in.'));
      else nodes.push(...s.options.map(o => Object.assign(choose(`${o.name}: ${o.text}`, o.id), { disabled: o.mine })));
    } else {
      nodes.push(say(s.question), card(el('section', { className: 'answer winner' }, el('b', {}, `${s.faker} was faking!`), faceImg(s.fakerId, 'large'),
        el('p', {}, s.caught ? 'Caught!' : 'And got away with it.')), 0),
        ...s.options.map((o, i) => card(el('section', { className: 'answer' }, el('b', {}, o.text), el('p', {}, faceImg(o.id), o.name),
          el('p', { className: 'fine' }, o.voters.length ? `Suspected by ${o.voters.join(', ')}` : 'Nobody suspected them'), like([o.id])), i + 1)),
        after(scores(s.options.length + 1), s.options.length + 1), onward(s.last ? 'Final scores' : 'Next round'));
    }
  } else if (s.game === 'split') {
    const round = s.rounds > 1 ? `Round ${s.round} of ${s.rounds}` : 'Down the Middle';
    if (s.phase === 'writing') {
      nodes.push(el('p', {}, round), say(s.question));
      if (s.sittingOut) nodes.push(el('p', {}, "You're in! Get ready to vote."));
      else if (s.sent) nodes.push(say('Sent!'), edit('Edit my answer', s.mine));
      else nodes.push(el('p', {}, 'Fill in the blank. The closer the vote, the more you score.'), ...answerForm('...but only when', 60));
    } else if (s.phase === 'voting') {
      nodes.push(el('p', {}, `${round}. ${s.matchup} of ${s.matchups}, by ${s.author}`), say(s.question));
      if (!s.canVote) nodes.push(say('This one is yours. Poker face.'));
      else if (s.sent) nodes.push(say('Vote locked in.'));
      else nodes.push(choose('Yes', 'yes'), choose('No', 'no', 'alt'));
    } else {
      const side = (label, names, i) => card(el('section', { className: 'answer' }, el('b', {}, `${label}: ${names.length}`), el('p', {}, names.join(', ') || 'Nobody')), i);
      nodes.push(say(s.question), side('Yes', s.yes, 0), side('No', s.no, 1),
        card(el('section', { className: 'answer winner' }, el('b', {}, s.author), el('p', {}, faceImg(s.authorId), s.gains[s.authorId] ? `+${s.gains[s.authorId]}` : 'No points this time'), like([s.authorId])), 2),
        after(scores(3), 3), onward(s.last ? 'Final scores' : 'Next'));
    }
  } else if (s.game === 'whosaid') {
    nodes.push(count(), say(`${s.question}...`));
    if (s.phase === 'writing') {
      if (s.sittingOut) nodes.push(sitting());
      else if (s.sent) nodes.push(say('Sent!'), edit('Edit my answer', s.mine));
      else nodes.push(el('p', {}, 'Finish the sentence. Your name stays hidden.'), ...answerForm('Your answer', 60));
    } else if (s.phase === 'voting') {
      if (s.sent) nodes.push(...s.answers.map(a => el('section', { className: 'answer' }, el('b', {}, a.text))), say(s.sittingOut ? "You're in! You'll join the next round." : 'Guesses locked in.'));
      else {
        const key = `${s.you}:${s.step}`;
        if (guesses.key !== key) guesses = { key, picks: {} };
        const open = s.answers.filter(a => !a.mine);
        const lock = button('Lock in my guesses', () => send({ action: 'vote', choice: guesses.picks }));
        const ready = () => { lock.disabled = !open.every(a => guesses.picks[a.n]); };
        nodes.push(el('p', {}, 'Who wrote each one?'), ...open.map(a => {
          const select = el('select', { ariaLabel: `Who wrote "${a.text}"?`, onchange: () => { guesses.picks[a.n] = select.value; ready(); } },
            el('option', { value: '' }, 'Choose a name'), s.suspects.map(p => el('option', { value: p.id }, p.name)));
          select.value = guesses.picks[a.n] ?? '';
          return el('section', { className: 'answer' }, el('b', {}, a.text), select);
        }), lock);
        ready();
      }
    } else {
      if (s.options.length < 2) nodes.push(say('Not enough answers to guess this time.'));
      nodes.push(...s.options.map((o, i) => card(el('section', { className: 'answer' }, el('b', {}, o.text),
        el('p', {}, faceImg(o.authorId), `${o.author}${s.gains[o.authorId] ? ` +${s.gains[o.authorId]}` : ''}`),
        el('p', { className: 'fine' }, o.right.length ? `Guessed by ${o.right.join(', ')}` : 'Nobody guessed it'), like([o.authorId])), i)),
        after(scores(s.options.length), s.options.length), onward(s.last ? 'Final scores' : 'Next question'));
    }
  } else if (s.game === 'snack') {
    // Roles stay covered so a neighbor can't glance them.
    const key = `${s.you}:${s.step}`;
    const showing = peeking === key;
    const secret = s.role && el('section', { className: 'answer secret' }, showing ? [el('b', {}, `You are: ${s.role}`),
      el('p', {}, { thief: 'At night, pick who to raid. By day, act innocent.', dog: 'At night, sniff one person to learn if they are a thief.',
        grandma: 'At night, guard one person (you can pick yourself).', family: 'Find the thieves. At night, tap anyone: your pick does nothing, but it keeps others guessing.' }[s.roleId]),
      s.partners && el('p', {}, s.partners.length ? `Fellow thieves: ${s.partners.join(', ')}` : 'You work alone.'),
      s.peeks?.map(p => el('p', {}, `${p.name} ${p.thief ? 'IS a pie thief' : 'is not a thief'}.`))] : [],
    el('button', { className: 'like', onclick: () => { peeking = showing ? '' : key; redraw(); } }, showing ? 'Hide my role' : 'Peek at my role'));
    const standing = el('p', { className: 'fine' }, `Still up: ${s.living.join(', ')}`);
    if (s.phase === 'writing' || s.phase === 'voting') {
      nodes.push(say(s.question), secret);
      if (s.sittingOut) nodes.push(say("You're in! You'll get a role next game."));
      else if (!s.isAlive) nodes.push(say("You've been sent to bed. No talking!"));
      else if (s.sent) nodes.push(say(s.phase === 'writing' ? 'Done. Eyes on your own phone.' : 'Vote locked in.'));
      else if (s.phase === 'writing') nodes.push(el('p', {}, 'Peek at your role, then tap a name. Everyone taps.'), ...s.targets.map(t => choose(t.mine ? `${t.name} (you)` : t.name, t.id, 'alt')));
      else nodes.push(el('p', {}, 'Talk it over out loud, then vote.'), ...s.targets.map(t => choose(t.name, t.id)), choose('Skip: send nobody', 'skip', 'alt'));
      nodes.push(standing);
    } else {
      const news = s.goneName ? `${s.goneName} ${s.stage === 'morning' ? 'was raided in the night' : 'is sent to bed'}. They were ${s.goneRole === 'Family' ? 'family' : `the ${s.goneRole}`}.`
        : s.stage === 'morning' ? (s.saved ? 'Grandma kept watch. Nobody was raided!' : 'A quiet night. Nobody was raided.') : 'No agreement. Nobody is sent to bed.';
      nodes.push(say(s.stage === 'morning' ? 'Morning!' : 'The family has spoken'), card(el('section', { className: 'answer winner' }, el('b', {}, news)), 0),
        s.tally && el('p', { className: 'fine' }, s.tally.join('. ')), secret, standing,
        s.stage === 'morning' && !s.over && el('p', {}, 'Discuss, then the host opens the vote.'),
        onward(s.over ? 'See who won' : s.stage === 'morning' ? 'Open the vote' : 'Night falls'));
    }
  } else { // survival
    nodes.push(el('p', {}, `Question ${s.index + 1} of ${s.total}`), !s.isAlive && el('p', { className: 'note' }, "You're a ghost. Keep answering for points."));
    const standing = el('p', { className: 'fine' }, `Still standing: ${s.living.join(', ')}`);
    if (s.phase === 'voting') {
      if (s.stage === 'danger') nodes.push(el('h2', {}, 'Danger round'), el('p', {}, `In danger: ${s.inDanger.join(', ')}`));
      nodes.push(say(s.question));
      if (!s.canVote) nodes.push(say("You're safe. Enjoy the show."));
      else if (s.sent) nodes.push(say('Locked in.'));
      else nodes.push(...s.choices.map((c, i) => choose(c, i)));
      nodes.push(standing);
    } else if (s.stage === 'answers') {
      nodes.push(say(s.question), card(el('section', { className: 'answer winner' }, el('b', {}, s.answer), el('p', {}, s.right.length ? `Got it: ${s.right.join(', ')}` : 'Nobody got it')), 0),
        card(el('section', { className: 'answer' }, el('b', {}, s.inDanger.length ? 'In danger' : 'Everyone standing is safe'), el('p', {}, s.inDanger.join(', '))), 1),
        after(scores(2), 2), onward(s.inDanger.length ? 'Start the danger round' : s.last ? 'See who won' : 'Next question'));
    } else {
      nodes.push(say(s.answer), el('p', { className: 'fine' }, s.picks.join('. ')),
        card(el('section', { className: 'answer winner' }, el('b', {}, s.spared ? 'Lucky! Everyone is spared.' : s.fallen.length ? `Out: ${s.fallen.join(', ')}` : 'Everyone made it!')), 0),
        standing, onward(s.last ? 'See who won' : 'Next question'));
    }
  }
  return nodes;
}
