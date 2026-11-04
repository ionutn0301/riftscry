// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('../../../src/lib/account/client', () => ({ getSupabase: () => ({ storage: { from: () => storage } }) }));
import { avatarPath, downloadAvatar, MAX_AVATAR_BYTES, MAX_PHOTO_BYTES, uploadAvatar, validatePhoto } from '../../../src/lib/account/avatar';
import { getAccountScope, setAccountScope } from '../../../src/lib/account/storage';
import { parseRiotAssociation, readRiotAssociation, saveRiotAssociation } from '../../../src/lib/account/riot-account';
import { readPreferredPlayer, rememberRecentPlayer } from '../../../src/lib/player/identity';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const player = { platform: 'euw1', puuid: 'p'.repeat(40), name: 'Alice#EUW' };
beforeEach(() => { localStorage.clear(); setAccountScope(alice); vi.clearAllMocks(); });
describe('account photo boundaries', () => {
  it('rejects unsafe formats and oversized input before decoding', () => {
    expect(() => validatePhoto({ type: 'image/svg+xml', size: 100 })).toThrow('JPG, PNG, or WebP');
    expect(() => validatePhoto({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 })).toThrow('5 MB');
    expect(() => validatePhoto({ type: 'image/png', size: 0 })).toThrow('5 MB');
    expect(() => validatePhoto({ type: 'image/jpeg', size: 100 })).not.toThrow();
    expect(() => avatarPath('../other')).toThrow();
  });
  it('only uploads the bounded prepared image to the current account path', async () => {
    storage.upload.mockResolvedValue({ error: null });
    await expect(uploadAvatar(alice, new Blob(['x'], { type: 'image/png' }))).rejects.toThrow('valid photo');
    await expect(uploadAvatar(alice, new Blob(['x'.repeat(MAX_AVATAR_BYTES + 1)], { type: 'image/webp' }))).rejects.toThrow('valid photo');
    const image = new Blob(['webp'], { type: 'image/webp' });
    await uploadAvatar(alice, image);
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(storage.upload).toHaveBeenCalledWith(`${alice}/avatar.webp`, image, { upsert: true, contentType: 'image/webp', cacheControl: '0' });
    await expect(uploadAvatar(bob, image)).rejects.toThrow('account changed');
  });
  it('distinguishes an empty profile from a failed download', async () => {
    storage.download.mockResolvedValue({ error: { statusCode: '404', message: 'Object not found' } });
    expect(await downloadAvatar(alice)).toBeNull();
    storage.download.mockResolvedValue({ error: { statusCode: '403', message: 'Denied' } });
    await expect(downloadAvatar(alice)).rejects.toThrow('could not be loaded');
  });
  it('discards a photo response if the signed-in owner changed in flight', async () => {
    storage.download.mockImplementation(async () => { setAccountScope(bob); return { data: new Blob(['webp'], { type: 'image/webp' }), error: null }; });
    await expect(downloadAvatar(alice)).rejects.toThrow('account changed');
    expect(getAccountScope()).toBe(bob);
  });
});
describe('explicit Riot ID association', () => {
  it('survives ordinary lookups and remains isolated from another account', () => {
    saveRiotAssociation(alice, player, null);
    rememberRecentPlayer({ ...player, name: 'Someone else#EUW' });
    expect(readRiotAssociation()).toEqual(player);
    expect(readPreferredPlayer()).toEqual(player);
    setAccountScope(bob); expect(readRiotAssociation()).toBeNull();
    expect(() => saveRiotAssociation(alice, player, null)).toThrow('account changed');
  });
  it('requires the owner to resolve a concurrent association change', () => {
    saveRiotAssociation(alice, player, null);
    expect(() => saveRiotAssociation(alice, { ...player, name: 'Other#EUW' }, null)).toThrow('another device');
    expect(readRiotAssociation()).toEqual(player);
    saveRiotAssociation(alice, null, player); expect(readRiotAssociation()).toBeNull();
  });
  it('rejects invalid region, identifiers and malformed records', () => {
    for (const value of [{ version: 2, player }, { version: 1, player: { ...player, platform: 'invalid' } }, { version: 1, player: { ...player, puuid: '../bad' } }, { version: 1, player: { ...player, name: 'No tag' } }]) expect(() => parseRiotAssociation(JSON.stringify(value))).toThrow();
    expect(parseRiotAssociation('{"version":1,"player":null}')).toEqual({ version: 1, player: null });
  });
});
