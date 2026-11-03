// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getUser: vi.fn(), signInWithOAuth: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
let client: typeof import('../../../src/lib/account/client');
let storage: typeof import('../../../src/lib/account/storage');
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://account-test.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('PUBLIC_AUTH_PROVIDERS', 'google');
  client = await import('../../../src/lib/account/client');
  storage = await import('../../../src/lib/account/storage');
  storage.setAccountScope('alice');
  auth.signInWithOAuth.mockResolvedValue({ error: null });
});
afterEach(() => { storage.setAccountScope(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('shows only an explicitly allowed provider that the auth service has enabled', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google: true, github: true } })));
  vi.stubGlobal('fetch', fetch);
  expect(await client.getAvailableSocialProviders()).toEqual(['google']);
  expect(fetch).toHaveBeenCalledWith('https://account-test.supabase.co/auth/v1/settings', expect.objectContaining({
    headers: { apikey: 'sb_publishable_test' }, credentials: 'omit', cache: 'no-store', redirect: 'error',
  }));
});
it.each([false, 'true', null])('does not redirect to a disabled or malformed Google provider (%s)', async enabled => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google: enabled } }))));
  await expect(client.signIn('google')).rejects.toThrow('not available yet');
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
});
it('fails closed on an availability outage and keeps the current workspace', async () => {
  storage.personalStorage.setItem('riftscry:pool', '["Ahri"]');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
  await expect(client.signIn('google')).rejects.toThrow('availability');
  expect(storage.personalStorage.getItem('riftscry:pool')).toBe('["Ahri"]');
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
});
it('uses Google account selection and minimal identity scopes with the fixed PKCE callback', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { google: true } }))));
  await client.signIn('google');
  expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: {
    redirectTo: `${location.origin}/auth/callback`, scopes: 'openid email profile', queryParams: { prompt: 'select_account' },
  } });
});
it('returns only display identity fields and drops a response after an account switch', async () => {
  auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'alice', identities: [{ provider: 'google' }] } }, error: null });
  expect(await client.getProfileIdentity('alice')).toEqual({ userId: 'alice', providers: ['Google'] });
  let finish!: (value: unknown) => void;
  auth.getUser.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const result = client.getProfileIdentity('alice');
  storage.setAccountScope('bob');
  finish({ data: { user: { id: 'alice', identities: [{ provider: 'google' }] } }, error: null });
  await expect(result).rejects.toThrow('could not be refreshed');
});
