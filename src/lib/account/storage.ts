import { atom } from 'nanostores';

// These are the personal records that may leave the device. Never include API
// response caches, AI responses, tokens, animation state, or arbitrary storage.
const keys = new Set([
  'riftscry:pool', 'riftscry:companion:v1', 'riftscry:kept-findings',
  'riftscry:recent-player:v1', 'riftscry:remembered-player:v1',
  'riftscry:last-reviewed-patch', 'riftscry:resume', 'riftscry:signal-context:v1',
  'riftscry:practice-plan:v1',
]);
export function isPersonalKey(key: string): boolean {
  return keys.has(key) || /^riftscry:(?:build-memory|momentum):v1:[A-Za-z0-9:_-]{1,180}$/.test(key);
}
export const accountsConfigured = Boolean(import.meta.env?.PUBLIC_SUPABASE_URL && import.meta.env?.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const ACCOUNT_WRITE = 'riftscry:account-write';
export type RemoteRecord = { record_key: string; value: string | null; revision: number };
export type LocalRecord = { value: string | null; revision: number; dirty: boolean; conflict?: RemoteRecord };
export type Records = Record<string, LocalRecord>;
export type AccountStatus = {
  ready: boolean; userId: string | null; email: string; syncing: boolean;
  pending: number; conflicts: string[]; error: string;
};
export const $account = atom<AccountStatus>({ ready: !accountsConfigured, userId: null, email: '', syncing: false, pending: 0, conflicts: [], error: '' });
let scope: string | null | undefined = accountsConfigured ? undefined : null;
const cacheKey = (userId: string) => `riftscry:account:v1:${userId}`;

export function loadRecords(userId: string): Records {
  const raw = localStorage.getItem(cacheKey(userId));
  if (!raw) return {};
  const records: unknown = JSON.parse(raw);
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Your local account cache could not be read. It has been kept untouched.');
  for (const [key, record] of Object.entries(records)) {
    if (!isPersonalKey(key) || !record || typeof record !== 'object' ||
      !(record.value === null || typeof record.value === 'string') ||
      !Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.dirty !== 'boolean') {
      throw new Error('Your local account cache could not be read. It has been kept untouched.');
    }
  }
  return records as Records;
}
export function storeRecords(userId: string, records: Records): void {
  // A single write keeps each value and its durable outbox entry atomic.
  localStorage.setItem(cacheKey(userId), JSON.stringify(records));
  if (scope === userId) updateCounts(records);
}
function updateCounts(records: Records) {
  $account.set({ ...$account.get(), pending: Object.values(records).filter(r => r.dirty).length,
    conflicts: Object.keys(records).filter(key => records[key]!.conflict) });
}
export function notifyPersonalChange(key: string | null = null) {
  window.dispatchEvent(new StorageEvent('storage', { key }));
}
export function setAccountScope(userId: string | null, email = '') {
  scope = userId;
  $account.set({ ready: true, userId, email, syncing: false, pending: 0, conflicts: [], error: '' });
  if (userId) {
    try { updateCounts(loadRecords(userId)); }
    catch (error) { $account.set({ ...$account.get(), error: (error as Error).message }); }
  }
  notifyPersonalChange();
}
export function getAccountScope() { return scope; }
export function lockAccountScope() {
  scope = undefined;
  $account.set({ ...$account.get(), ready: false, userId: null, email: '' });
  notifyPersonalChange();
}
export function clearAccountCache(userId: string) { localStorage.removeItem(cacheKey(userId)); }

export const personalStorage = {
  getItem(key: string): string | null {
    if (!isPersonalKey(key)) throw new Error('Unknown personal record.');
    if (typeof window === 'undefined' || scope === undefined) return null;
    return scope === null ? localStorage.getItem(key) : loadRecords(scope)[key]?.value ?? null;
  },
  setItem(key: string, value: string): void {
    if (!isPersonalKey(key)) throw new Error('Unknown personal record.');
    if (scope === undefined) throw new Error('Your account is still loading. Please try saving again in a moment.');
    if (scope === null) { localStorage.setItem(key, value); return; }
    if (new TextEncoder().encode(value).length > 2_000_000) throw new Error('This record exceeds the 2 MB limit. Export a backup and remove older entries.');
    const records = loadRecords(scope);
    if (records[key]?.value === value) return;
    records[key] = { ...records[key], value, revision: records[key]?.revision ?? 0, dirty: true };
    validateRecordLimits(records);
    storeRecords(scope, records);
    window.dispatchEvent(new Event(ACCOUNT_WRITE));
  },
};

export function validateRecordLimits(records: Records) {
  if (Object.keys(records).length > 200 || Object.values(records).reduce((size, record) => size + new TextEncoder().encode(record.value ?? '').length, 0) > 4_000_000) {
    throw new Error('Your account storage limit has been reached. Export a backup and remove older entries.');
  }
}

export function guestRecords(): Record<string, string> {
  const records: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isPersonalKey(key)) records[key] = localStorage.getItem(key)!;
  }
  return records;
}

// Translate only this account's cache events into the existing feature events.
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (scope && event.key === cacheKey(scope)) {
    try { updateCounts(loadRecords(scope)); notifyPersonalChange(); }
    catch { /* Keep unreadable data untouched; the next explicit operation reports it. */ }
  }
});
