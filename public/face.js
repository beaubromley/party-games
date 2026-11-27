// Face photos: shrunk on the phone before upload, and fetched only when someone's photo changes.
import { el } from './ui.js';

export async function shrink(file, size = 240) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = el('canvas', { width: size, height: size });
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.7);
  } finally { URL.revokeObjectURL(url); }
}

export const FACE_DAYS = 30;
// A copy stays on this phone so it can be added to the next room automatically.
export function saveFace(data) {
  try {
    if (data) localStorage.setItem('face', JSON.stringify({ data, expires: Date.now() + FACE_DAYS * 86400000 }));
    else localStorage.removeItem('face');
  } catch {}
}
export function savedFace() {
  try {
    const saved = JSON.parse(localStorage.getItem('face'));
    if (saved?.expires > Date.now()) return saved.data;
    if (saved) localStorage.removeItem('face');
  } catch {}
  return '';
}
