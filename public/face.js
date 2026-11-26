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
