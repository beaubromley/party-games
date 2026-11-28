// A decent player for each mini game, used to prove every one can be played well to the end.
export function bot(id, g, t, memory) {
  const since = t - (memory.last ?? -9), act = () => { memory.last = t; };
  if (id === 'cactus') {
    const speed = 255 + 300 / 30 * t;
    // Jump so the middle of the jump lands over the middle of the cactus.
    if (!g.y && g.course.some(o => { const x = o.d - g.d + o.w / 2; return !o.done && !o.fly && x > 0 && x < speed * 0.345; })) g.down();
  }
  if (id === 'turkey') { const gate = g.gates.find(x => 90 + x.d - g.d + 46 > 75); if (g.y > gate.mid + 14 && g.v > 0) g.down(); }
  if (id === 'ski') {
    // Head for the closest clear lane through what's coming.
    const near = g.trees.filter(tr => tr.y - g.d > -15 && tr.y - g.d < 110);
    const free = x => near.every(tr => Math.abs(tr.x - x) > 28);
    for (let k = 0; k < 340; k += 6) { const x = [g.x + k, g.x - k].find(x => x > 12 && x < 348 && free(x)); if (x !== undefined) { g.move(x); break; } }
  }
  if (id === 'hoops' && !g.shot && since > 0.2) { act(); const x = g.hoopX(t + 0.7); g.up(180 + (x - 180) / 315 * 100, 355, { x: 180, y: 455 }); }
  if (id === 'stack' && since > 0.25 && Math.abs(g.position(t) - g.tower.at(-1).x) < 5) { act(); g.down(); }
  if (id === 'pies') {
    // Go under the next good pie, standing clear of any bad one that lands first.
    const soon = g.items.filter(i => !i.done && t >= i.at).map(i => ({ bad: i.bad, eta: g.arrives(i) - t, x: g.across(i, g.arrives(i) - 0.03) })).filter(i => i.eta > -0.05);
    const next = soon.filter(i => !i.bad).sort((a, b) => a.eta - b.eta)[0];
    const danger = soon.filter(i => i.bad && i.eta < 0.2 + (next && next.eta < 0.2 ? 0 : 0.1));
    const free = x => danger.every(d => Math.abs(d.x - x) > 46);
    const goal = next?.x ?? g.x;
    for (let k = 0; k < 340; k += 4) { const x = [goal + k, goal - k].find(x => x >= 36 && x <= 324 && free(x)); if (x !== undefined) { g.move(x); break; } }
  }
  if (id === 'bonk' && since > 0.3) { const m = g.pops.find(m => !m.hit && !m.bunny && t > m.at + 0.2 && t < m.until); if (m) { act(); g.down(g.holes[m.hole].x, g.holes[m.hole].y - 24); } }
  if (id === 'copycat' && !g.showing() && since > 0.25) { act(); const p = g.seq[g.at]; g.down(p % 2 ? 260 : 90, p > 1 ? 400 : 220); }
  if (id === 'derby') { const q = g.current(t); if (q && !q.swung && q.at + q.flight - t < 0.02) g.down(); }
  if (id === 'fieldgoal' && !g.kick && since > 0.4) { act(); const x = g.post(t + 0.8) - (g.windNow || 0); g.up(180 + (x - 180) / 280 * 100, 340, { x: 180, y: 440 }); }
}
