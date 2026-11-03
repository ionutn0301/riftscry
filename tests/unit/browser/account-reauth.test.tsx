// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../src/lib/account/storage', async original => ({ ...await original<typeof import('../../../src/lib/account/storage')>(), accountsConfigured: true }));
vi.mock('../../../src/lib/account/client', () => ({
  socialProviders: ['google'], getAvailableSocialProviders: vi.fn().mockResolvedValue(['google']), signIn: vi.fn().mockResolvedValue(undefined), signOut: vi.fn(),
  syncAccount: vi.fn(), importGuestData: vi.fn(), resolveConflict: vi.fn(),
}));
import AccountPanel from '../../../src/components/account/AccountPanel';
import { $account, loadRecords, personalStorage, setAccountScope } from '../../../src/lib/account/storage';
import { signIn, signOut, syncAccount } from '../../../src/lib/account/client';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks();
  localStorage.clear(); setAccountScope('alice', 'alice@example.test');
  personalStorage.setItem('riftscry:pool', '["Ahri"]');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setAccountScope(null); vi.unstubAllGlobals(); });
it.each([false, true])('can reconnect with pending edits via account controls or a rejected AI session (reauth=%s)', async reauth => {
  history.replaceState(null, '', `/account${reauth ? '?reauth=1' : ''}`);
  await act(async () => root.render(createElement(AccountPanel)));
  if (!reauth) await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Reconnect account')!.click());
  const reconnect = [...container.querySelectorAll('button')].find(button => button.textContent?.endsWith('Sign in again with Google'))!;
  expect(reconnect.disabled).toBe(false); expect($account.get().pending).toBe(1);
  await act(async () => reconnect.click());
  expect(signIn).toHaveBeenCalledWith('google');
  expect(signOut).not.toHaveBeenCalled(); expect(syncAccount).not.toHaveBeenCalled();
  expect(loadRecords('alice')['riftscry:pool']).toMatchObject({ value: '["Ahri"]', dirty: true });
});
