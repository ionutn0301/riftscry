import { $account, accountsConfigured, lockAccountScope, setAccountScope } from './storage';
import { accountStorageKey } from './config';

/** A missing credential can establish a guest, never an authenticated user. */
export function needsAccountClient(url: URL, storage: Pick<Storage, 'getItem'>, key: string): boolean {
  if (/^\/(?:account|profile|auth)(?:\/|$)/.test(url.pathname)) return true;
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has('code') || url.searchParams.has('error') || hash.has('access_token') || hash.has('error')) return true;
  try { return storage.getItem(key) !== null || storage.getItem(`${key}-code-verifier`) !== null; }
  catch { return true; } // Unreadable storage is an unknown session, not a guest.
}

export async function bootstrapAccount() {
  if (!accountsConfigured) return;
  try {
    const key = accountStorageKey();
    if (needsAccountClient(new URL(location.href), localStorage, key)) {
      const { initializeAccount } = await import('./client');
      await initializeAccount();
      return;
    }
    // Subscribe before releasing guest storage. Another tab signing in must
    // discard this document's React/SWR/form state before opening its account.
    let resetRequested = false;
    const reopen = () => {
      if (resetRequested) return;
      resetRequested = true;
      lockAccountScope();
      location.replace('/account');
    };
    window.addEventListener('storage', event => {
      if (event.key === key && event.newValue) reopen();
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      // A frozen document may not receive storage events while sign-in runs
      // in a later document in this same tab. Back must recheck its boundary.
      try { if (needsAccountClient(new URL(location.href), localStorage, key)) reopen(); }
      catch { reopen(); }
    });
    setAccountScope(null);
  } catch {
    $account.set({ ...$account.get(), error: 'Your account could not be opened. Return to Account and reload to try again.' });
  }
}
