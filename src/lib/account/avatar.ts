import { getSupabase } from './client';
import { getAccountScope } from './storage';

export const AVATAR_BUCKET = 'account-avatars';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 512 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validatePhoto(file: Pick<File, 'type' | 'size'>) {
  if (!allowedTypes.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error('Choose an image smaller than 5 MB.');
}
export function avatarPath(owner: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) throw new Error('Open your account before changing your photo.');
  return `${owner}/avatar.webp`;
}
function ownerClient(owner: string) {
  const client = getSupabase();
  if (!client || getAccountScope() !== owner) throw new Error('Your account changed. Reopen your profile before continuing.');
  return client;
}
export async function preparePhoto(file: File): Promise<Blob> {
  validatePhoto(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be opened. Choose another JPG, PNG, or WebP.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('Choose an image no larger than 40 megapixels.');
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the photo. Please try another browser.');
    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, 512, 512);
    // Re-encoding removes image metadata and only sends a small square image.
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob || blob.type !== 'image/webp' || blob.size > MAX_AVATAR_BYTES) throw new Error('The photo could not be prepared. Please try a smaller image.');
    return blob;
  } finally { bitmap.close(); }
}
export async function downloadAvatar(owner: string): Promise<Blob | null> {
  const { data, error } = await ownerClient(owner).storage.from(AVATAR_BUCKET).download(avatarPath(owner));
  ownerClient(owner);
  if (error) {
    if (('statusCode' in error && String(error.statusCode) === '404') || /object not found/i.test(error.message)) return null;
    throw new Error('Your photo could not be loaded. Retry when you are online.');
  }
  if (!data || data.type !== 'image/webp' || data.size > MAX_AVATAR_BYTES) throw new Error('Your photo could not be loaded. Please upload a new image.');
  return data;
}
export async function uploadAvatar(owner: string, photo: Blob) {
  if (photo.type !== 'image/webp' || !photo.size || photo.size > MAX_AVATAR_BYTES) throw new Error('Prepare a valid photo before saving.');
  const { error } = await ownerClient(owner).storage.from(AVATAR_BUCKET).upload(avatarPath(owner), photo, { upsert: true, contentType: 'image/webp', cacheControl: '0' });
  ownerClient(owner);
  if (error) throw new Error('Your photo was not saved. Check your connection and try again.');
}
export async function removeAvatar(owner: string) {
  const { error } = await ownerClient(owner).storage.from(AVATAR_BUCKET).remove([avatarPath(owner)]);
  ownerClient(owner);
  if (error) throw new Error('Your photo could not be removed. Please try again.');
}
