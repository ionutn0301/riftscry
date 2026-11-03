import { expect, test, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const storageKey = 'sb-account-test-auth-token';
type Row = { record_key: string; value: string | null; revision: number };
function session(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: id, exp, role: 'authenticated' })).toString('base64url');
  return { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`, refresh_token: `refresh-${id}`, token_type: 'bearer', expires_at: exp, expires_in: 3600,
    user: { id, email: `${id === alice ? 'alice' : 'bob'}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
}
async function seed(context: BrowserContext, id: string | null, guest = false) {
  await context.addInitScript(({ key, value, guest }) => {
    if (sessionStorage.getItem('account-seeded')) return;
    sessionStorage.setItem('account-seeded', '1');
    if (value) localStorage.setItem(key, JSON.stringify(value));
    if (guest) localStorage.setItem('riftscry:pool', '["Ahri"]');
  }, { key: storageKey, value: id ? session(id) : null, guest });
}
async function backend(context: BrowserContext, rows: Map<string, Map<string, Row>>, network: { offline: boolean }) {
  await context.route('https://account-test.supabase.co/**', async route => {
    if (network.offline) return route.abort('failed');
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    const token = request.headers().authorization?.split(' ')[1];
    const id = token ? JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sub as string : '';
    if (!id) return route.fulfill({ status: 401, headers, json: { message: 'No session' } });
    if (!rows.has(id)) rows.set(id, new Map());
    const records = rows.get(id)!;
    if (url.pathname.endsWith('/rpc/save_account_record')) {
      const body = request.postDataJSON();
      const current = records.get(body.p_key);
      if ((current?.revision ?? 0) !== body.p_revision) return route.fulfill({ status: 409, headers, json: { code: '40001', message: 'conflict' } });
      const revision = (current?.revision ?? 0) + 1;
      records.set(body.p_key, { record_key: body.p_key, value: body.p_value, revision });
      return route.fulfill({ headers, json: revision });
    }
    const key = url.searchParams.get('record_key')?.replace('eq.', '');
    return route.fulfill({ headers, json: key ? records.get(key) : [...records.values()] });
  });
}

test('social sign-in uses PKCE and the fixed callback on this origin', async ({ page }) => {
  await page.goto('/account');
  const request = page.waitForRequest('https://account-test.supabase.co/auth/v1/authorize**');
  await page.route('https://account-test.supabase.co/auth/v1/authorize**', route => route.fulfill({ body: 'OAuth provider handoff' }));
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const url = new URL((await request).url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4325/auth/callback');
});

for (const width of [1440, 390]) test(`account controls remain usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.locator('.account-panel')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Export workspace' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Export workspace' })).toBeInViewport();
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/account-${width}.png`, fullPage: true });
});

test('guest import is explicit, sync reaches another device, and sign-out restores guest data', async ({ browser }) => {
  const rows = new Map<string, Map<string, Row>>(); const network = { offline: false };
  const first = await browser.newContext(); const second = await browser.newContext();
  await seed(first, alice, true); await seed(second, alice);
  await backend(first, rows, network); await backend(second, rows, network);
  const page = await first.newPage(); await page.goto('http://127.0.0.1:4325/account');
  await expect(page.getByText('Your workspace is synced.', { exact: true })).toBeVisible();
  expect(rows.get(alice)?.size).toBe(0);
  await page.getByRole('button', { name: 'Import this browser’s data' }).click();
  await expect.poll(() => rows.get(alice)?.get('riftscry:pool')?.value).toBe('["Ahri"]');
  const other = await second.newPage(); await other.goto('http://127.0.0.1:4325/pool#edit-pool');
  await expect(other.getByRole('option', { name: /Ahri/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('riftscry:pool'))).toBe('["Ahri"]');
  expect(await page.evaluate(id => localStorage.getItem(`riftscry:account:v1:${id}`), alice)).toBeNull();
  await first.close(); await second.close();
});

test('offline changes survive reload and a cloud conflict preserves both versions', async ({ context, page }) => {
  const rows = new Map([[alice, new Map([['riftscry:pool', { record_key: 'riftscry:pool', value: '["Ahri"]', revision: 1 }]])]]);
  const network = { offline: false };
  await seed(context, alice); await backend(context, rows, network);
  await page.goto('/pool#edit-pool');
  await expect(page.getByRole('option', { name: /Ahri/ })).toHaveAttribute('aria-selected', 'true');
  network.offline = true;
  await page.getByRole('option', { name: /Jinx/ }).click();
  await page.goto('/account');
  // PostgREST retries failed reads with exponential backoff before reporting offline.
  await expect(page.getByText(/Changes remain on this device/)).toBeVisible({ timeout: 15_000 });
  rows.get(alice)!.set('riftscry:pool', { record_key: 'riftscry:pool', value: '["Thresh"]', revision: 2 });
  network.offline = false;
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a saved version' })).toBeVisible();
  expect(rows.get(alice)!.get('riftscry:pool')!.value).toBe('["Thresh"]');
  await page.getByRole('button', { name: 'Keep this device’s version' }).click();
  await expect.poll(() => rows.get(alice)!.get('riftscry:pool')!.value).toBe('["Ahri","Jinx"]');
  await expect(page.getByText('Your workspace is synced.', { exact: true })).toBeVisible();
});

test('different accounts cannot hydrate each other’s workspace', async ({ context, page }) => {
  const rows = new Map([[alice, new Map([['riftscry:pool', { record_key: 'riftscry:pool', value: '["Ahri"]', revision: 1 }]])]]);
  await seed(context, bob, true); await backend(context, rows, { offline: false });
  await page.goto('/pool#edit-pool');
  await expect(page.locator('.account-sync-status')).toHaveText('Workspace synced');
  await expect(page.getByRole('option', { name: /Ahri/ })).toHaveAttribute('aria-selected', 'false');
  await page.getByRole('option', { name: /Jinx/ }).click();
  await expect.poll(() => rows.get(bob)?.get('riftscry:pool')?.value).toBe('["Jinx"]');
  expect(rows.get(alice)!.get('riftscry:pool')!.value).toBe('["Ahri"]');
});
