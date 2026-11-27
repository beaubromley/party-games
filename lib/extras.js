// Night standings, end-of-game awards and reactions.
export const REACTIONS = 4;

// Adds one to a player's tally for the current game.
export function count(room, id, stat, by = 1) {
  const mine = ((room.stats ??= {})[id] ??= {});
  mine[stat] = (mine[stat] || 0) + by;
}

// Once per finished game: 3, 2 and 1 night points for the podium places. Kept by name, so rejoining keeps your total.
export function tally(room) {
  if (room.phase !== 'done' || room.counted || room.game === 'telephone') return;
  room.counted = true;
  const places = [...new Set(room.players.map(p => p.score).filter(s => s > 0))].sort((a, b) => b - a).slice(0, 3);
  for (const p of room.players) {
    const place = places.indexOf(p.score);
    if (!places.length) return;
    const mine = ((room.night ??= {})[p.name.toLowerCase()] ??= { name: p.name, points: 0, wins: 0 });
    if (place >= 0) { mine.points += 3 - place; if (!place) mine.wins++; }
  }
}
export const standings = room => Object.values(room.night ?? {}).sort((a, b) => b.points - a.points || b.wins - a.wins);

const LIKED = ['liked', 'Fan Magnet', 'collected the most likes'];
const AWARDS = {
  bluff: [['fooled', 'Best Bluffer', 'fooled people the most'], ['found', 'Sharpest Detective', 'found the truth the most'], ['gullible', 'Most Gullible', 'fell for the most fakes'], LIKED],
  doodle: [['guessed', 'Clearest Artist', 'drawings were figured out the most'], ['fooled', 'Best Bluffer', 'fooled people the most'], ['gullible', 'Most Gullible', 'fell for the most fakes'], LIKED],
  faceoff: [['votes', 'Crowd Favorite', 'collected the most votes'], ['sweeps', 'Clean Sweeper', 'took every vote in the most matchups'], LIKED],
  majority: [['matched', 'Hive Mind', 'matched the crowd the most'], ['alone', 'Free Spirit', 'gave the most answers nobody else did'], LIKED],
};
// Ties share an award. One that everybody ties for says nothing, so it is left out.
export function awards(room) {
  return (AWARDS[room.game] ?? []).flatMap(([stat, title, detail]) => {
    const value = p => room.stats?.[p.id]?.[stat] ?? 0;
    const best = Math.max(0, ...room.players.map(value));
    const names = room.players.filter(p => value(p) === best).map(p => p.name);
    return best && (names.length < room.players.length || room.players.length === 1) ? [{ title, detail, names, times: best }] : [];
  });
}

// The best of the night, kept in the room. Drawings are big, so fewer of those are kept.
const KEEP = 30, KEEP_DRAWINGS = 10;
export function highlight(room, item) {
  const list = room.highlights ??= [];
  room.highlightCount = (room.highlightCount || 0) + 1;
  list.push({ n: room.highlightCount, game: room.game, ...item });
  if (list.filter(h => h.strokes).length > KEEP_DRAWINGS) list.splice(list.findIndex(h => h.strokes), 1);
  if (list.length > KEEP) list.shift();
}
const people = n => `${n} ${n === 1 ? 'person' : 'people'}`;
// A finished Bluff or Doodle round: the fake that fooled the most, plus the drawing itself.
export function roundHighlight(room) {
  const r = room.rounds[room.index];
  const name = id => room.players.find(p => p.id === id)?.name ?? room.gone?.[id];
  const picks = Object.values(room.votes);
  const fakes = room.options.map((o, i) => ({ ...o, fooled: picks.filter(c => c === i).length })).filter(o => !o.truth && o.fooled);
  const best = fakes.sort((a, b) => b.fooled - a.fooled)[0];
  const by = best && `${best.authors.map(name).join(' & ')} fooled ${people(best.fooled)}`;
  if (r.drawing) highlight(room, { heading: r.answer, strokes: r.drawing, text: best?.text, credit: `Drawn by ${name(r.artist)}${best ? `. ${by} with the title below.` : ''}` });
  else if (best) highlight(room, { heading: r.question, text: best.text, credit: by });
}

export function react(room, player, kind, now = Date.now()) {
  const list = room.reactions ??= [];
  const last = list.findLast(r => r.id === player.id);
  if (last && now - last.at < 1500) return false;
  room.reactionCount = (room.reactionCount || 0) + 1;
  list.push({ n: room.reactionCount, id: player.id, name: player.name, kind, at: now });
  if (list.length > 12) list.shift();
  return true;
}
