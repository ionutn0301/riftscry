import { expect, test, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { installFixtures, sourceMatch, query, makeMatch, puuid, platform, baseTime } from '../player-e2e/fixtures';
import { championArtIsSeparate } from '../e2e/cinema-test-helpers';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const storageKey = 'sb-account-test-auth-token';
type Row = { record_key: string; value: string | null; revision: number };
const settingsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,OPTIONS' };
function session(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: id, exp, role: 'authenticated' })).toString('base64url');
  return { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`, refresh_token: `refresh-${id}`, token_type: 'bearer', expires_at: exp, expires_in: 3600,
    user: { id, email: `${id === alice ? 'alice' : 'bob'}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [{ id, user_id: id, provider: 'google' }], created_at: '2026-01-01T00:00:00Z' } };
}
async function seed(context: BrowserContext, id: string | null, guest = false) {
  await context.addInitScript(({ key, value, guest }) => {
    if (sessionStorage.getItem('account-seeded')) return;
    sessionStorage.setItem('account-seeded', '1');
    if (value) localStorage.setItem(key, JSON.stringify(value));
    if (guest) localStorage.setItem('riftscry:pool', '["Ahri"]');
  }, { key: storageKey, value: id ? session(id) : null, guest });
}
async function backend(context: BrowserContext, rows: Map<string, Map<string, Row>>, network: { offline: boolean; uploadFails?: boolean }, photos = new Map<string, Buffer>()) {
  await context.route('https://account-test.supabase.co/**', async route => {
    if (network.offline) return route.abort('failed');
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    if (url.pathname.endsWith('/settings')) return route.fulfill({ headers, json: { external: { google: true } } });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers });
    const token = request.headers().authorization?.split(' ')[1];
    const id = token ? JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sub as string : '';
    if (!id) return route.fulfill({ status: 401, headers, json: { message: 'No session' } });
    if (url.pathname.endsWith('/user')) return route.fulfill({ headers, json: session(id).user });
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (request.method() === 'DELETE') {
        const prefixes = request.postDataJSON().prefixes;
        if (!Array.isArray(prefixes) || prefixes.some(path => path !== `${id}/avatar.webp`)) return route.fulfill({ status: 403, headers, json: { message: 'Denied' } });
        photos.delete(id); return route.fulfill({ headers, json: [] });
      }
      if (!url.pathname.endsWith(`/account-avatars/${id}/avatar.webp`)) return route.fulfill({ status: 403, headers, json: { message: 'Denied' } });
      if (request.method() === 'GET') return photos.has(id) ? route.fulfill({ headers, contentType: 'image/webp', body: photos.get(id) }) : route.fulfill({ status: 404, headers, json: { message: 'Object not found', statusCode: '404' } });
      if (network.uploadFails) return route.fulfill({ status: 503, headers, json: { message: 'Upload unavailable' } });
      const form = await new Response(new Uint8Array(request.postDataBuffer()!), { headers: { 'content-type': request.headers()['content-type']! } }).formData();
      const image = [...form.values()].find(value => typeof value !== 'string') as File;
      if (!image || image.type !== 'image/webp' || image.size > 524288) return route.fulfill({ status: 400, headers, json: { message: 'Invalid image' } });
      photos.set(id, Buffer.from(await image.arrayBuffer()));
      return route.fulfill({ headers, json: { Key: `account-avatars/${id}/avatar.webp`, Id: id } });
    }
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

test.beforeEach(async ({ context }) => {
  await context.route('https://account-test.supabase.co/auth/v1/settings', route => route.fulfill({
    headers: settingsHeaders, json: { external: { google: true } },
  }));
});

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
  expect(url.searchParams.get('prompt')).toBe('select_account');
  expect(url.searchParams.get('scopes')).toBe('openid email profile');
});

test('a guest page skips the account SDK and resets safely when another tab signs in', async ({ page, context }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await seed(context, null, true);
  await backend(context, new Map(), { offline: false });
  await page.goto('/');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-ready', 'true');
  expect(requests.some(url => /supabase-js|supabase_supabase-js|\/lib\/account\/client/.test(url))).toBe(false);
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: session(alice) });
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Your workspace is synced.', { exact: true })).toBeVisible();
  // Browser data remains separate until the owner explicitly imports it.
  await expect(page.getByRole('button', { name: 'Import this browser’s data' })).toBeVisible();
});

test('a restored guest document rechecks credentials before exposing a workspace', async ({ page, context }) => {
  await seed(context, null, true);
  await backend(context, new Map(), { offline: false });
  await page.goto('/');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-ready', 'true');
  // Model credentials written by a later document in this same tab. Browsers
  // do not dispatch a storage event back to its originating browsing context.
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, { key: storageKey, value: session(alice) });
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Your workspace is synced.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import this browser’s data' })).toBeVisible();
});

test('Google stays unavailable until the hosted provider is enabled and handles availability failures', async ({ page }) => {
  await page.route('https://account-test.supabase.co/auth/v1/settings', route => route.fulfill({ headers: settingsHeaders, json: { external: { google: false } } }));
  await page.goto('/account');
  await expect(page.getByText('Google sign-in is being configured.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
  await page.route('https://account-test.supabase.co/auth/v1/settings', route => route.abort('failed'));
  await page.reload();
  await expect(page.getByText('Sign-in availability could not be checked. Please retry.')).toBeVisible();
  await page.route('https://account-test.supabase.co/auth/v1/settings', route => route.fulfill({ headers: settingsHeaders, json: { external: { google: true } } }));
  await page.getByRole('button', { name: 'Retry sign-in options' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});

test('Account is reachable from the homepage and the profile bookmark offers sign-in to guests', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const accountLink = page.getByRole('link', { name: 'Account and profile', exact: true });
  await expect(accountLink).toBeInViewport();
  const box = await accountLink.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  await accountLink.click();
  await expect(page.getByRole('heading', { name: 'My account.' })).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My profile.' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveCount(0);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});

for (const width of [1440, 390]) test(`My profile saves private preferences and does not assume a recent lookup is an association at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 });
  const rows = new Map([[alice, new Map([['riftscry:recent-player:v1', { record_key: 'riftscry:recent-player:v1', value: JSON.stringify({ platform: 'euw1', puuid: 'p'.repeat(40), name: 'Alice#EUW' }), revision: 1 }]])]]);
  await seed(context, alice); await backend(context, rows, { offline: false });
  await page.goto('/profile');
  await expect(page.getByText('Sign-in: Google')).toBeVisible();
  await page.getByLabel('Display name').fill('Alice');
  await page.getByLabel('Preferred role').selectOption('Support');
  await page.getByLabel('My focus for the next game').fill('Track my first ward.');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.locator('.profile-overview h2')).toHaveText('Alice');
  await expect.poll(() => JSON.parse(rows.get(alice)?.get('riftscry:practice-plan:v1')?.value ?? '{}').profile?.role).toBe('Support');
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Alice');
  await expect(page.getByText('No Riot ID associated yet.')).toBeVisible();
  await expect(page.getByText(/it does not verify Riot account ownership/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/my-profile-${width}.png`, fullPage: true });
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

for (const width of [1440, 390]) test(`personal practice plan saves, survives reload, and is usable at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 });
  const rows = new Map<string, Map<string, Row>>();
  await seed(context, alice); await backend(context, rows, { offline: false });
  await page.goto('/account');
  const plan = page.locator('[data-practice-plan]');
  await page.getByLabel('Display name').fill('Alice');
  await page.getByLabel('Preferred role').selectOption('Mid');
  await page.getByLabel('My focus for the next game').fill('Review my first recall.');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await plan.getByLabel('New practice goal').fill('Inspect one recorded death');
  await plan.getByRole('button', { name: 'Add goal', exact: true }).click();
  await plan.getByRole('checkbox', { name: 'Inspect one recorded death' }).check();
  await expect(plan).toContainText('1 of 1 goals checked');
  await expect.poll(() => JSON.parse(rows.get(alice)?.get('riftscry:practice-plan:v1')?.value ?? '{}').goals?.[0]?.done).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Alice');
  await expect(plan.getByRole('checkbox', { name: 'Inspect one recorded death' })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/practice-plan-${width}.png`, fullPage: true });
  await page.goto('/next-game');
  await expect(plan).toContainText('Alice’s practice plan');
  await expect(plan).toContainText('Review my first recall.');
  await plan.getByRole('button', { name: 'Reset checklist for next session' }).click();
  await expect(plan.getByRole('checkbox', { name: 'Inspect one recorded death' })).not.toBeChecked();
  // The briefing's full-width text-input styles must not stretch checkboxes or
  // leave the goal squeezed into a one-character column.
  const goalGeometry = await plan.locator('.practice-goals label').evaluate(label => {
    const checkbox = label.querySelector('input')!.getBoundingClientRect();
    const text = label.querySelector('span')!.getBoundingClientRect();
    const target = label.getBoundingClientRect();
    return { checkboxWidth: checkbox.width, checkboxHeight: checkbox.height,
      textWidth: text.width, textHeight: text.height, targetHeight: target.height,
      textRight: text.right, targetRight: target.right };
  });
  expect(goalGeometry.checkboxWidth).toBeLessThanOrEqual(24);
  expect(goalGeometry.checkboxHeight).toBeLessThanOrEqual(24);
  expect(goalGeometry.textWidth).toBeGreaterThan(120);
  expect(goalGeometry.textHeight).toBeLessThan(80);
  expect(goalGeometry.targetHeight).toBeGreaterThanOrEqual(44);
  expect(goalGeometry.textRight).toBeLessThanOrEqual(goalGeometry.targetRight + 1);
  await expect(page.locator('.account-sync-status')).toHaveText('Workspace synced');
  await page.screenshot({ path: `player-visuals/practice-briefing-${width}.png`, fullPage: true });
});

test('a practice plan syncs across devices and remains private to its owner', async ({ browser }) => {
  const rows = new Map<string, Map<string, Row>>(); const network = { offline: false };
  const first = await browser.newContext(); const second = await browser.newContext(); const other = await browser.newContext();
  for (const [context, id] of [[first, alice], [second, alice], [other, bob]] as const) { await seed(context, id); await backend(context, rows, network); }
  const page = await first.newPage(); await page.goto('http://127.0.0.1:4325/account');
  await page.getByLabel('My focus for the next game').fill('My private focus');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect.poll(() => rows.get(alice)?.has('riftscry:practice-plan:v1')).toBe(true);
  const same = await second.newPage(); await same.goto('http://127.0.0.1:4325/account');
  await expect(same.getByLabel('My focus for the next game')).toHaveValue('My private focus');
  const different = await other.newPage(); await different.goto('http://127.0.0.1:4325/account');
  await expect(different.getByLabel('My focus for the next game')).toHaveValue('');
  await first.close(); await second.close(); await other.close();
});

test('a new guest sees recorded facts and a sign-in route that preserves the selected match', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`);
  const entry = page.locator('[data-match-ai-entry]');
  await expect(entry).toHaveText('Sign in to use AI');
  await entry.click();
  await expect(page).toHaveURL(url => url.pathname === '/account' && url.searchParams.get('returnTo')?.includes(sourceMatch.metadata.matchId) === true);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to your match’s recorded summary →' }).click();
  await expect(page.locator('.review-mode')).toContainText('Recorded summary');
  expect(requests.filter(request => request.action === 'review')).toEqual([]);
});

test('signed-in analysis sends the session only after an explicit request; an expired session returns to sign-in', async ({ page, context }) => {
  await seed(context, alice); await backend(context, new Map(), { offline: false });
  let expire = false;
  const requests = await installFixtures(page, { response: request => request.action === 'review' && expire ? { status: 401, json: { error: 'Your session has expired. Sign in again to use AI analysis.' } } : undefined });
  await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`);
  const entry = page.locator('[data-match-ai-entry]');
  await expect(entry).toHaveText('Review with AI');
  expect(requests.filter(request => request.action === 'review')).toEqual([]);
  const sent = page.waitForRequest(request => request.url().includes('/api/player/review?'));
  await entry.click();
  const authorization = (await sent).headers().authorization;
  expect(authorization).toMatch(/^Bearer /);
  expect(JSON.parse(Buffer.from(authorization!.split('.')[1]!, 'base64url').toString()).sub).toBe(alice);
  await expect(page.locator('.review-mode')).toContainText('AI-assisted interpretation');
  expire = true;
  await page.locator('#match-review').getByRole('button', { name: 'Review with AI', exact: true }).click();
  await expect(page.locator('#match-review').getByRole('link', { name: 'Sign in to use AI' })).toBeVisible();
  await expect(page.locator('.review-mode')).toContainText('Recorded summary');
  await page.locator('#match-review').getByRole('link', { name: 'Sign in to use AI' }).click();
  await expect(page.getByRole('heading', { name: 'Reconnect your sign-in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in again with Google' })).toBeVisible();
});

test('the real review route rejects a guest or malformed token before any Riot access', async ({ request }) => {
  for (const authorization of ['', 'Bearer forged']) {
    const response = await request.post(`/api/player/review?${query}&id=${sourceMatch.metadata.matchId}`, { headers: { origin: 'http://127.0.0.1:4325', ...(authorization ? { authorization } : {}) } });
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toBe('private, no-store');
  }
});

for (const width of [1440, 390, 320]) test(`account sections support a photo and an explicit Riot ID association at ${width}px`, async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: 900 });
  const rows = new Map<string, Map<string, Row>>(); const photos = new Map<string, Buffer>();
  await seed(context, alice); await backend(context, rows, { offline: false }, photos); await installFixtures(page);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'My account.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Account sections' }).getByRole('link')).toHaveCount(4);
  const file = page.locator('input[type=file]');
  await expect(file).toBeEnabled();
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#c8ad7f' } }).png().toBuffer();
  await file.setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('img', { name: 'New profile photo preview' })).toBeVisible();
  expect(photos.size).toBe(0);
  await page.getByRole('button', { name: 'Save photo', exact: true }).click();
  await expect(page.getByText('Profile photo saved.', { exact: false })).toBeVisible();
  expect((await sharp(photos.get(alice)!).metadata())).toMatchObject({ width: 512, height: 512, format: 'webp' });
  await page.reload();
  await expect(page.getByRole('img', { name: 'Your profile photo', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: 'Riot ID', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your League of Legends player.' })).toBeInViewport();
  const form = page.getByRole('form', { name: 'Associate a Riot ID' });
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await form.getByLabel('Server', { exact: true }).selectOption('eun1');
  await form.getByRole('button', { name: 'Find Riot ID', exact: true }).click();
  await expect(page.locator('.riot-candidate')).toContainText('Fixture Player#TEST');
  expect(rows.get(alice)?.has('riftscry:riot-account:v1')).not.toBe(true);
  await page.getByRole('button', { name: 'Associate this Riot ID', exact: true }).click();
  await expect.poll(() => JSON.parse(rows.get(alice)?.get('riftscry:riot-account:v1')?.value ?? '{}').player?.name).toBe('Fixture Player#TEST');
  await page.reload();
  await expect(page.locator('.associated-player')).toContainText('Fixture Player#TEST');
  await expect(page.getByRole('link', { name: 'Open my briefing', exact: false })).toHaveAttribute('href', /platform=eun1/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/account-riot-${width}.png`, fullPage: true });
  if (width === 1440) {
    await page.goto('/');
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-ready', 'true');
    await expect(page.locator('[data-home-briefing]').first()).toHaveAttribute('href', /platform=eun1.*puuid=/);
  }
  await page.goto('/account#profile');
  await expect(page.getByRole('img', { name: 'Your profile photo', exact: true })).toBeInViewport();
  await page.screenshot({ path: `player-visuals/account-profile-${width}.png`, fullPage: false });
  await page.getByRole('button', { name: 'Remove association', exact: true }).click();
  await expect.poll(() => JSON.parse(rows.get(alice)?.get('riftscry:riot-account:v1')?.value ?? '{}').player).toBeNull();
  await expect(page.getByText('No Riot ID associated yet.')).toBeVisible();
});

test('photo upload validates files, recovers from failure, and removes the saved image', async ({ page, context }) => {
  const rows = new Map<string, Map<string, Row>>(); const photos = new Map<string, Buffer>();
  const network = { offline: false, uploadFails: true };
  await seed(context, alice); await backend(context, rows, network, photos);
  await page.goto('/account');
  const input = page.locator('input[type=file]'); await expect(input).toBeEnabled();
  await input.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg></svg>') });
  await expect(page.getByText('Choose a JPG, PNG, or WebP image.')).toBeVisible();
  expect(photos.size).toBe(0);
  const image = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#c8ad7f' } }).png().toBuffer();
  await input.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Save photo', exact: true }).click();
  await expect(page.getByText('Your photo was not saved.', { exact: false })).toBeVisible();
  expect(photos.size).toBe(0);
  await expect(page.getByRole('img', { name: 'New profile photo preview' })).toBeVisible();
  network.uploadFails = false;
  await page.getByRole('button', { name: 'Save photo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Your profile photo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.getByText('Profile photo removed.')).toBeVisible();
  expect(photos.size).toBe(0);
  await page.reload();
  await expect(page.locator('input[type=file]')).toBeEnabled();
  await expect(page.getByRole('img', { name: 'Your profile photo', exact: true })).toHaveCount(0);
});

test('photos and Riot associations load on another device but not another account', async ({ browser }) => {
  const photo = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#c8ad7f' } }).webp().toBuffer();
  const photos = new Map([[alice, photo]]);
  const association = { version: 1, player: { platform: 'euw1', puuid: 'p'.repeat(40), name: 'Alice#EUW' } };
  const rows = new Map([[alice, new Map([['riftscry:riot-account:v1', { record_key: 'riftscry:riot-account:v1', value: JSON.stringify(association), revision: 1 }]])]]);
  const same = await browser.newContext(); const other = await browser.newContext();
  try {
    await seed(same, alice); await backend(same, rows, { offline: false }, photos);
    await seed(other, bob); await backend(other, rows, { offline: false }, photos);
    const accountPage = await same.newPage(); await accountPage.goto('http://127.0.0.1:4325/account');
    await expect(accountPage.getByRole('img', { name: 'Your profile photo', exact: true })).toBeVisible();
    await expect(accountPage.locator('.associated-player')).toContainText('Alice#EUW');
    const otherPage = await other.newPage(); await otherPage.goto('http://127.0.0.1:4325/account');
    await expect(otherPage.locator('input[type=file]')).toBeEnabled();
    await expect(otherPage.getByRole('img', { name: 'Your profile photo', exact: true })).toHaveCount(0);
    await expect(otherPage.getByText('No Riot ID associated yet.')).toBeVisible();
    expect(photos.get(alice)).toEqual(photo);
  } finally { await same.close(); await other.close(); }
});

function homeRows(championPlayer = { platform, puuid, name: 'My player#TEST' }) {
  const record: Row = { record_key: 'riftscry:riot-account:v1', value: JSON.stringify({ version: 1, player: championPlayer }), revision: 1 };
  return new Map([[alice, new Map([[record.record_key, record]])]]);
}
function homeGames(ids = ['Lux', 'Chogath', 'Lux', 'Chogath', 'Lulu', 'Ashe']) {
  return ids.map((champion, index) => {
    const match = makeMatch(`EUN1_${33000 + index}`, baseTime - index * 3600000);
    match.info.participants[0]!.championName = champion;
    return match;
  });
}
for (const width of [320, 390, 1440]) test(`personal homepage: linked player's top three, useful actions and art at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  const requests = await installFixtures(page, { matches: homeGames() });
  await page.goto('/');
  await expect(page.locator('[data-home-roster-label]')).toHaveText('Most played recently');
  await expect(page.locator('[data-home-choice]:visible')).toHaveCount(3);
  expect(await page.locator('[data-home-choice]:visible').evaluateAll(links => links.map(link => (link as HTMLElement).dataset.homeChoice))).toEqual(['Lux', 'Chogath', 'Lulu']);
  await expect(page.locator('[data-home-roster-status]')).toHaveText('6 recent games');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', 'Lux');
  await expect(page.locator('[data-home-review]')).toHaveAttribute('href', /\/matches\/EUN1_33000\?/);
  await expect(page.locator('[data-home-primary]')).toHaveAttribute('href', /champion=Lux/);
  await page.locator('[data-home-choice="Chogath"]').click();
  // Freeze motion through the real preference control before inspecting art.
  const motion = page.locator('.cinema-footer [data-cinema-motion]');
  if ((await motion.getAttribute('aria-pressed')) === 'false') await motion.click();
  await expect(page.locator('[data-cinema-canvas]')).toHaveAttribute('data-cinema-champion', 'Chogath');
  await expect(page.locator('[data-home-primary]')).toHaveAttribute('href', /champion=Chogath/);
  await expect(page.locator('[data-home-catchup]')).toHaveAttribute('href', '/catch-up?champion=Chogath');
  await expect(page.locator('[data-cinema-poster]')).toHaveAttribute('src', /Chogath_0.jpg$/);
  const targets = page.locator('[data-home-primary], [data-home-review], [data-home-choice]:visible, [data-home-catchup]:visible');
  for (const target of await targets.all()) {
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport({ ratio: .99 });
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    expect(await target.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  }
  expect(requests.some(request => ['timeline', 'review', 'rank', 'items'].includes(request.action))).toBe(false);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/home-personal-${width}.png`, animations: 'disabled' });
  await page.locator('[data-home-review]').click();
  await expect(page).toHaveURL(/\/matches\/EUN1_33000/);
});

for (const [width, height] of [[320, 568], [480, 320], [1024, 600]]) test(`personal homepage: long champion names keep actions separate at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width: width!, height: height! });
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames(['AurelionSol', 'Nunu', 'Renata']) });
  await page.goto('/');
  await expect(page.locator('[data-home-roster-label]')).toHaveText('Most played recently');
  const actions = (await page.locator('.cinema-entry-actions').boundingBox())!;
  const roster = (await page.locator('.cinema-roster').boundingBox())!;
  expect(Math.max(roster.y - actions.y - actions.height, roster.x - actions.x - actions.width)).toBeGreaterThanOrEqual(15);
  for (const target of await page.locator('[data-home-choice]:visible, [data-home-primary], [data-home-review]').all()) {
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport({ ratio: .99 });
    expect(await target.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  }
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/home-personal-long-${width}.png`, animations: 'disabled' });
});

test('personal homepage: signed-in accounts need an associated Riot ID, never a guest or last-viewed identity', async ({ page, context }) => {
  await seed(context, alice, true); await backend(context, new Map(), { offline: false });
  await page.addInitScript(player => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(player)), { platform, puuid, name: 'Someone else#TEST' });
  const requests = await installFixtures(page);
  await page.goto('/');
  await expect(page.locator('[data-home-associate]')).toBeVisible();
  await expect(page.locator('[data-home-roster-label]')).toHaveText('Featured champions');
  expect(requests).toEqual([]);
  await page.locator('[data-home-associate]').click();
  await expect(page).toHaveURL(/\/profile#riot-id$/);
});

test('personal homepage: one played champion stays one, and an empty archive stays honest', async ({ page, context }) => {
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames(['Lulu']) });
  await page.goto('/');
  await expect(page.locator('[data-home-roster-label]')).toHaveText('Most played recently');
  await expect(page.locator('[data-home-choice]:visible')).toHaveCount(1);
  await page.locator('[data-cinema-inspect]').click();
  await expect(page.locator('[data-home-record="Lulu"]')).toContainText('No direct change recorded');
  await expect(page.locator('[data-home-keep]')).toBeHidden();
  await expect(page.locator('[data-home-explore]')).toHaveAttribute('href', '/champion/lulu');
});

test('personal homepage: failed games label the partial sample and retry recovers without invented picks', async ({ page, context }) => {
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames() });
  await page.route('**/api/player/match?**', route => new URL(route.request().url()).searchParams.get('id') === 'EUN1_33000'
    ? route.fulfill({ status: 503, json: { error: 'Temporary failure' } }) : route.fallback());
  await page.goto('/');
  await expect(page.locator('[data-home-roster-status]')).toHaveText('5 recent games · 1 unavailable');
  await expect(page.locator('[data-home-roster-retry]')).toBeVisible();
  await page.unroute('**/api/player/match?**');
  await page.locator('[data-home-roster-retry]').click();
  await expect(page.locator('[data-home-roster-status]')).toHaveText('6 recent games');
  await expect(page.locator('[data-home-roster-retry]')).toBeHidden();
});

test('personal homepage: a delayed import cannot survive an association removal', async ({ page, context }) => {
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames() });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/player/history?**', async route => { await gate; await route.fallback(); });
  await page.goto('/');
  await expect(page.locator('[data-home-roster-status]')).toHaveText('Finding your most played…');
  await page.evaluate(owner => {
    const key = `riftscry:account:v1:${owner}`, records = JSON.parse(localStorage.getItem(key)!);
    records['riftscry:riot-account:v1'].value = JSON.stringify({ version: 1, player: null });
    localStorage.setItem(key, JSON.stringify(records));
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }, alice);
  release();
  await expect(page.locator('[data-home-associate]')).toBeVisible();
  await expect(page.locator('[data-home-roster-label]')).toHaveText('Featured champions');
  await expect(page.locator('[data-home-choice="Akali"]')).toBeVisible();
  await expect(page.locator('[data-home-review]')).toHaveAttribute('href', '/players');
});

test('personal homepage: the first painted roster is the owner’s, including a slow first cloud sync and a cached return', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames(['Urgot', 'Urgot', 'Urgot', 'Riven', 'Riven', 'Malphite']) });
  let syncReady!: () => void, gamesReady!: () => void, artReady!: () => void;
  const cloudGate = new Promise<void>(resolve => { syncReady = resolve; });
  const artGate = new Promise<void>(resolve => { artReady = resolve; });
  let gameGate = new Promise<void>(resolve => { gamesReady = resolve; });
  await context.route('https://account-test.supabase.co/rest/v1/account_records**', async route => { await cloudGate; await route.fallback(); });
  await page.route('**/api/player/history?**', async route => { await gameGate; await route.fallback(); });
  await page.route('**/images/rift-cinema/urgot-figure.webp', async route => { await artGate; await route.fallback(); });
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { paintedHomeChampions: string[] }).paintedHomeChampions = seen;
    function sample() {
      for (const element of document.querySelectorAll<HTMLElement>('[data-home-choice]')) {
        if (getComputedStyle(element).visibility === 'visible' && element.getClientRects().length && !element.hidden) seen.push(element.dataset.homeChoice!);
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  const home = page.locator('[data-rift-cinema]');
  await expect(home).toHaveAttribute('data-home-loading', 'true');
  await expect(page.locator('[data-home-choice]:visible')).toHaveCount(0);
  await expect(page.locator('[data-cinema-poster]')).toBeHidden();
  await expect(page.locator('[data-home-primary]')).toBeVisible();
  await expect(page.locator('[data-cinema-canvas]')).not.toHaveAttribute('data-cinema-champion');
  syncReady();
  await expect(page.locator('[data-home-roster-status]')).toHaveText('Finding your most played…');
  await expect(page.locator('[data-home-choice]:visible')).toHaveCount(0);
  gamesReady();
  await expect(home).toHaveAttribute('data-home-subject', 'Urgot');
  await expect(page.locator('[data-home-roster-status]')).toHaveText('6 recent games');
  await expect(page.locator('[data-cinema-poster]')).toBeHidden();
  artReady();
  for (const champion of ['Urgot', 'Riven', 'Malphite']) {
    await page.locator(`[data-home-choice="${champion}"]`).click();
    await expect(home).toHaveAttribute('data-art-kind', 'cutout');
    await expect(page.locator('[data-cinema-poster]')).toHaveAttribute('src', `/images/rift-cinema/${champion.toLowerCase()}-figure.webp`);
    await expect.poll(() => page.locator('[data-cinema-poster]').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(500);
    await expect(page.locator('[data-cinema-canvas]')).toHaveAttribute('data-cinema-champion', champion);
    await mkdir('player-visuals', { recursive: true });
    await page.screenshot({ path: `player-visuals/home-personal-cutout-${champion}-390.png`, animations: 'disabled' });
  }
  const painted = await page.evaluate(() => (window as unknown as { paintedHomeChampions: string[] }).paintedHomeChampions);
  expect(painted.length).toBeGreaterThan(0);
  expect(painted.every(id => ['Urgot', 'Riven', 'Malphite'].includes(id))).toBe(true);
  gameGate = new Promise<void>(resolve => { gamesReady = resolve; });
  await page.goto('/');
  await expect(home).toHaveAttribute('data-home-subject', 'Urgot');
  await expect(page.locator('[data-home-roster-status]')).toHaveText('6 recent games · Refreshing…');
  await page.locator('[data-home-choice="Riven"]').click();
  gamesReady();
  await expect(page.locator('[data-home-roster-status]')).toHaveText('6 recent games');
  await expect(home).toHaveAttribute('data-home-subject', 'Riven');
  expect(await page.evaluate(() => (window as unknown as { paintedHomeChampions: string[] }).paintedHomeChampions.every(id => ['Urgot', 'Riven', 'Malphite'].includes(id)))).toBe(true);
});

test('personal homepage: Urgot, Riven and Malphite artwork stays separate from text', async ({ page, context }) => {
  test.setTimeout(90_000);
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page, { matches: homeGames(['Urgot', 'Urgot', 'Urgot', 'Riven', 'Riven', 'Malphite']) });
  await page.goto('/');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', 'Urgot');
  // The saved account preference may enable motion. Capture settled artwork,
  // not a crossfade between two champions or a temporarily hidden name.
  const motion = page.locator('.cinema-footer [data-cinema-motion]');
  if ((await motion.getAttribute('aria-pressed')) === 'false') await motion.click();
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-cinema-motion', 'reduced');
  await page.evaluate(() => document.fonts.ready);
  await mkdir('player-visuals', { recursive: true });
  for (const viewport of [{width:390,height:844},{width:1366,height:900},{width:1913,height:917}]) {
    await page.setViewportSize(viewport);
    for (const champion of ['Urgot', 'Riven', 'Malphite']) {
      await page.locator(`[data-home-choice="${champion}"]`).click();
      await expect(page.locator('[data-cinema-canvas]')).toHaveAttribute('data-cinema-champion', champion);
      await expect(page.locator('.cinema-identity')).toHaveCSS('opacity', '1');
      await championArtIsSeparate(page);
      await page.screenshot({path:`player-visuals/home-personal-art-${champion}-${viewport.width}.png`,fullPage:true});
    }
  }
});

test('personal homepage: a failed first import stays neutral and offers recovery', async ({ page, context }) => {
  await seed(context, alice); await backend(context, homeRows(), { offline: false });
  await installFixtures(page);
  await page.route('**/api/player/history?**', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } }));
  await page.goto('/');
  await expect(page.locator('[data-home-roster-status]')).toHaveText('Your games could not load.');
  await expect(page.locator('[data-home-choice]:visible')).toHaveCount(0);
  await expect(page.locator('[data-cinema-poster]')).toBeHidden();
  await expect(page.locator('[data-home-roster-retry]')).toBeVisible();
  await expect(page.locator('[data-home-primary]')).toHaveAttribute('href', new RegExp(`puuid=${puuid}`));
  await expect(page.locator('[data-home-primary]')).not.toHaveAttribute('href', /champion=Akali/);
});
