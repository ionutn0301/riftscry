import { createClient, type Provider, type SupabaseClient } from '@supabase/supabase-js';
import {
  $account, accountsConfigured, ACCOUNT_WRITE, isPersonalKey, validateRecordLimits, lockAccountScope,
  loadRecords, storeRecords, setAccountScope, getAccountScope, notifyPersonalChange,
  guestRecords, clearAccountCache, type RemoteRecord,
} from './storage';
import { acknowledgeRecord, reconcileRecords } from './sync';

let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!accountsConfigured) return null;
  return client ??= createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
}
const supportedProviders = ['google', 'github', 'discord'] as const;
export const socialProviders = (import.meta.env.PUBLIC_AUTH_PROVIDERS ?? 'google').split(',').map((s: string) => s.trim())
  .filter((s: string): s is typeof supportedProviders[number] => supportedProviders.includes(s as typeof supportedProviders[number]));
let started: Promise<void> | undefined;
let syncing: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const reportError = (message: string) => $account.set({ ...$account.get(), error: message, syncing: false });

export function initializeAccount(): Promise<void> {
  return started ??= initialize().catch(() => reportError('Your account could not be opened. Return to Account and reload to try again.'));
}
async function initialize() {
  const supabase = getSupabase();
  if (!supabase) return;
  // SDK initialization exchanges a PKCE callback before returning the session.
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    reportError('Sign-in could not be completed. Return to Account and try again.');
    return; // Never fall back to a guest workspace for an unknown session.
  }
  setAccountScope(data.session?.user.id ?? null, data.session?.user.email ?? '');
  if (location.pathname === '/auth/callback') history.replaceState(null, '', '/auth/callback');
  supabase.auth.onAuthStateChange((_event, session) => {
    if ((session?.user.id ?? null) !== getAccountScope()) {
      // A full document reset also discards React/SWR and unsaved form state.
      lockAccountScope();
      location.replace('/account');
    }
  });
  window.addEventListener(ACCOUNT_WRITE, scheduleSync);
  window.addEventListener('online', () => void syncAccount());
  window.addEventListener('focus', () => void syncAccount());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncAccount(); });
  await syncAccount();
  if (location.pathname === '/auth/callback') location.replace('/account');
}
function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(() => void syncAccount(), 500);
}

export function syncAccount(): Promise<void> {
  if (syncing) return syncing;
  const userId = getAccountScope();
  if (!userId || !getSupabase()) return Promise.resolve();
  const run = () => syncWorkspace(userId);
  syncing = (navigator.locks?.request ? navigator.locks.request(`riftscry:sync:${userId}`, run) : run())
    .catch(() => reportError('Sync is unavailable. Changes remain on this device. Use Retry sync when you are online.'))
    .finally(() => { syncing = undefined; });
  return syncing;
}
async function syncWorkspace(userId: string) {
  const supabase = getSupabase()!;
  $account.set({ ...$account.get(), syncing: true, error: '' });
  const { data, error } = await supabase.from('account_records').select('record_key,value,revision').eq('user_id', userId);
  if (error) throw error;
  if (getAccountScope() !== userId) return;
  const remote = (data as RemoteRecord[]).filter(row => isPersonalKey(row.record_key));
  storeRecords(userId, reconcileRecords(loadRecords(userId), remote));
  notifyPersonalChange();
  // Writes made during an upload remain dirty and get their own CAS revision.
  for (let pass = 0; pass < 5; pass++) {
    const pending = Object.entries(loadRecords(userId)).filter(([, record]) => record.dirty && !record.conflict);
    if (!pending.length) break;
    for (const [key, sent] of pending) {
      if (getAccountScope() !== userId) return;
      const { data: result, error: failure } = await supabase.rpc('save_account_record', {
        p_key: key, p_value: sent.value, p_revision: sent.revision,
      });
      if (failure) {
        if (failure.code === '40001') {
          const { data: latest, error: fetchError } = await supabase.from('account_records').select('record_key,value,revision').eq('user_id', userId).eq('record_key', key).single();
          if (fetchError) throw fetchError;
          storeRecords(userId, reconcileRecords(loadRecords(userId), [latest as RemoteRecord]));
          continue;
        }
        throw failure;
      }
      if (getAccountScope() !== userId) return;
      const current = loadRecords(userId);
      if (current[key]) current[key] = acknowledgeRecord(current[key], sent, Number(result));
      storeRecords(userId, current);
    }
  }
  $account.set({ ...$account.get(), syncing: false });
  if ($account.get().pending > $account.get().conflicts.length) scheduleSync();
}

export async function signIn(provider: Provider) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Accounts have not been configured yet.');
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
  if (error) throw new Error('Could not start sign-in. Please try again.');
}
export async function signOut() {
  await syncAccount();
  const state = $account.get();
  if (state.pending) throw new Error('Some changes have not synced. Retry sync or resolve conflicts before signing out.');
  const { error } = await getSupabase()!.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Could not sign out. Please try again.');
  if (state.userId) clearAccountCache(state.userId);
  location.replace('/account');
}
export async function importGuestData() {
  const userId = getAccountScope();
  if (!userId) throw new Error('Sign in before importing.');
  await syncAccount();
  if ($account.get().error) throw new Error('Sync your account before importing browser data.');
  let imported = 0;
  const { validateGuestRecord } = await import('./validation');
  const records = loadRecords(userId);
  // Explicit, additive migration. Existing account records, including deleted
  // records, win; the original guest data remains available after sign-out.
  for (const [key, value] of Object.entries(guestRecords())) {
    if (!records[key]) {
      validateGuestRecord(key, value);
      records[key] = { value, revision: 0, dirty: true };
      imported++;
    }
  }
  validateRecordLimits(records);
  if (getAccountScope() !== userId) throw new Error('Your account changed. Please retry the import.');
  storeRecords(userId, records);
  notifyPersonalChange();
  await syncAccount();
  return imported;
}
export async function resolveConflict(key: string, choice: 'local' | 'cloud') {
  const userId = getAccountScope();
  if (!userId) return;
  const records = loadRecords(userId);
  const current = records[key];
  if (!current?.conflict) return;
  records[key] = { value: choice === 'local' ? current.value : current.conflict.value,
    revision: current.conflict.revision, dirty: choice === 'local' };
  storeRecords(userId, records);
  notifyPersonalChange(key);
  await syncAccount();
}
