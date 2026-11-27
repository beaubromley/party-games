// Turns drawings into a picture the phone can keep.
import { picture } from './canvas.js';

function wrap(ctx, text, width) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width <= width || !lines.at(-1)) lines[lines.length - 1] = next; else lines.push(word);
  }
  return lines;
}
// parts: [{ text, big }] or [{ strokes }], stacked top to bottom. Stays well within iPhone canvas limits.
export function compose(parts) {
  const WIDTH = 800, PAD = 40, SIDE = WIDTH - PAD * 2;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const font = p => `${p.big ? '800 44px' : '600 28px'} "Avenir Next", sans-serif`;
  const sized = parts.map(p => {
    if (p.strokes) return { ...p, height: SIDE + 24 };
    ctx.font = font(p);
    const lines = wrap(ctx, p.text, SIDE);
    return { ...p, lines, height: lines.length * (p.big ? 54 : 36) + 16 };
  });
  canvas.width = WIDTH; canvas.height = PAD * 2 + sized.reduce((n, p) => n + p.height, 0);
  ctx.fillStyle = '#f4efe3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = PAD;
  for (const p of sized) {
    if (p.strokes) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(PAD, y, SIDE, SIDE);
      ctx.drawImage(picture(p.strokes), PAD, y, SIDE, SIDE);
      ctx.strokeStyle = '#1d1b16'; ctx.lineWidth = 3; ctx.strokeRect(PAD, y, SIDE, SIDE);
    } else {
      ctx.fillStyle = '#1d1b16'; ctx.font = font(p); ctx.textBaseline = 'top';
      p.lines.forEach((line, i) => ctx.fillText(line, PAD, y + i * (p.big ? 54 : 36), SIDE));
    }
    y += p.height;
  }
  return canvas;
}
// Opens the share sheet (with Save Image on iPhone), or downloads where sharing isn't offered.
export async function savePicture(parts, name) {
  const url = compose(parts).toDataURL('image/png'); // synchronous, so the tap still counts for sharing
  const bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
  const file = new File([bytes], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  Object.assign(document.createElement('a'), { href: url, download: file.name }).click();
}
