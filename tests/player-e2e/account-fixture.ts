import type { Page } from '@playwright/test';

export const fixtureAccountId = '00000000-0000-4000-8000-000000000001';
/** A test session only. API security is exercised separately against Auth responses. */
export async function signInFixture(page: Page, values: Record<string, string> = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: fixtureAccountId, exp, role: 'authenticated' })).toString('base64url');
  const user = { id: fixtureAccountId, email: 'player@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user };
  const rows = new Map(Object.entries(values).map(([record_key, value]) => [record_key, { record_key, value, revision: 1 }]));
  await page.addInitScript(({ session, values }) => {
    if (sessionStorage.getItem('player-account-seeded')) return;
    sessionStorage.setItem('player-account-seeded', '1');
    localStorage.setItem('sb-account-test-auth-token', JSON.stringify(session));
    localStorage.setItem(`riftscry:account:v1:${session.user.id}`, JSON.stringify(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, revision: 1, dirty: false }]))));
  }, { session, values });
  await page.route('https://account-test.supabase.co/**', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/user')) return route.fulfill({ headers, json: user });
    if (path.endsWith('/rpc/save_account_record')) {
      const body = request.postDataJSON();
      const revision = (rows.get(body.p_key)?.revision ?? 0) + 1;
      rows.set(body.p_key, { record_key: body.p_key, value: body.p_value, revision });
      return route.fulfill({ headers, json: revision });
    }
    return route.fulfill({ headers, json: [...rows.values()] });
  });
}
