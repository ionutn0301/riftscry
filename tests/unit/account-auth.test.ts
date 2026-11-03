import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requireAccount } from '../../src/lib/account/server';

const authFetch = vi.fn();
const user = { id: '00000000-0000-4000-8000-000000000001', role: 'authenticated', is_anonymous: false };
const request = (authorization?: string) => new Request('https://riftscry.example/api/player/review', { headers: authorization ? { authorization } : {} });
beforeEach(() => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://account-test.supabase.co');
  vi.stubEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fixture');
  vi.stubGlobal('fetch', authFetch);
  authFetch.mockReset().mockResolvedValue(new Response(JSON.stringify(user), { headers: { 'content-type': 'application/json' } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([undefined, 'Basic abc', 'Bearer abc', 'Bearer a.b.c extra', `Bearer ${'a'.repeat(8192)}.b.c`])('rejects a missing or malformed bearer token without upstream work', async authorization => {
  await expect(requireAccount(request(authorization))).rejects.toMatchObject({ status: 401 });
  expect(authFetch).not.toHaveBeenCalled();
});
it('uses the Auth server response, with no locally trusted token claims', async () => {
  expect(await requireAccount(request('Bearer a.b.c'))).toBe(user.id);
  expect(String(authFetch.mock.calls[0]![0])).toBe('https://account-test.supabase.co/auth/v1/user');
  expect(new Headers(authFetch.mock.calls[0]![1].headers).get('authorization')).toBe('Bearer a.b.c');
});
it.each([401, 403])('rejects expired, revoked, wrong-project or forged tokens rejected by Auth (%s)', async status => {
  authFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid JWT' }), { status }));
  await expect(requireAccount(request('Bearer a.b.c'))).rejects.toMatchObject({ status: 401 });
});
it.each([{ ...user, is_anonymous: true }, { ...user, id: '' }, { ...user, role: 'anon' }])('rejects anonymous or missing identities', async rejected => {
  authFetch.mockResolvedValue(new Response(JSON.stringify(rejected)));
  await expect(requireAccount(request('Bearer a.b.c'))).rejects.toMatchObject({ status: 401 });
});
it('fails closed when account configuration is missing', async () => {
  vi.stubEnv('PUBLIC_SUPABASE_URL', '');
  await expect(requireAccount(request('Bearer a.b.c'))).rejects.toMatchObject({ status: 503 });
  expect(authFetch).not.toHaveBeenCalled();
});
it('fails closed when verification is unavailable', async () => {
  authFetch.mockResolvedValue(new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 }));
  await expect(requireAccount(request('Bearer a.b.c'))).rejects.toMatchObject({ status: 503 });
});
