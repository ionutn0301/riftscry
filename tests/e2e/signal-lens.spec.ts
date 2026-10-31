import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import patch from '../../src/data/patches/26.16.json' with { type: 'json' };
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';

const belveth = patch.champions.find(champion => champion.championId === 'Belveth')!;
const records = belveth.abilities.flatMap(ability => ability.changes);
const azir = patch.champions.find(champion => champion.championId === 'Azir')!.abilities[0]!.changes[0]!;

test('one exact signal remains readable while before/after focus changes by tap and keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/patch/26.16#azir');
  await readyWorld(page);
  const record = page.locator('#azir [data-signal-record]:not([hidden])');
  await expect(record).toHaveCount(1);
  await expect(record.locator('.before')).toHaveText(azir.before!);
  await expect(record.locator('.after')).toHaveText(azir.after!);
  const before = record.getByRole('button', { name:'Before', exact:true });
  const after = record.getByRole('button', { name:'After', exact:true });
  await unobstructed(before);
  await before.click();
  await expect(record).toHaveAttribute('data-signal-side','before');
  await expect(before).toHaveAttribute('aria-pressed','true');
  const range = record.getByRole('slider');
  await range.focus();
  await range.press('End');
  await expect(record).toHaveAttribute('data-signal-side','after');
  await expect(after).toHaveAttribute('aria-pressed','true');
  await expect(range).toHaveAttribute('aria-valuetext', `After: ${azir.after}`);
  await expect(record.locator('.before')).toHaveText(azir.before!);
  await expect(record.locator('.after')).toHaveText(azir.after!);
  await expect(page.locator('#azir').getByRole('link', { name:/^Original source/ })).toHaveAttribute('href',patch.sourceUrl);
  await stationaryWorld(page);
  expect(errors).toEqual([]);
});

test('field choices reveal numeric and prose records without changing the champion or patch', async ({ page }) => {
  await page.goto('/patch/26.16?champions=belveth#belveth');
  await readyWorld(page);
  const lens = page.locator('#belveth [data-signal-lens]');
  await expect(lens).toHaveAttribute('data-signal-ready','true');
  await expect(lens.locator('[data-signal-record]')).toHaveCount(records.length);
  for (const [index, source] of records.entries()) {
    const choice = lens.locator(`[data-signal-choice="${index}"]`);
    await unobstructed(choice);
    await choice.click();
    const active = lens.locator('[data-signal-record]:not([hidden])');
    await expect(active).toHaveCount(1);
    await expect(active.getByRole('heading', { level:3 })).toHaveText(source.label);
    if (source.kind === 'numeric') {
      await expect(active.locator('.before')).toHaveText(source.before!);
      await expect(active.locator('.after')).toHaveText(source.after!);
    } else {
      await expect(active.locator('.prose-text')).toHaveText(source.text!);
      await expect(active.getByRole('slider')).toHaveCount(0);
    }
    await expect(page).toHaveURL(url => url.hash === '#belveth' && url.searchParams.get('champions') === 'belveth');
  }
  const inactive = lens.locator('[data-signal-record][hidden]').first();
  await inactive.evaluate(element => (element as HTMLElement).focus());
  await expect(inactive).not.toBeFocused();
});

test('history selection survives Back and reload and opens the same champion in its patch', async ({ page }) => {
  await page.goto('/champion/ahri');
  await readyWorld(page);
  const choices = page.locator('[data-history-select]');
  expect(await choices.count()).toBeGreaterThan(1);
  const first = choices.first();
  const last = choices.last();
  const firstHash = await first.getAttribute('href');
  const lastHash = await last.getAttribute('href');
  await first.click();
  await last.click();
  await expect(page).toHaveURL(url => url.hash === lastHash);
  await page.goBack();
  await expect(page).toHaveURL(url => url.hash === firstHash);
  await expect(page.locator(firstHash!)).toBeVisible();
  await page.reload();
  await readyWorld(page);
  const selected = page.locator('[data-history-record]:not([hidden])');
  await expect(selected).toHaveAttribute('id',firstHash!.slice(1));
  const patchId = await selected.getAttribute('data-history-record');
  const open = selected.getByRole('link', { name:`Open in patch ${patchId}`, exact:false });
  await unobstructed(open);
  await open.click();
  await readyWorld(page);
  await expect(page).toHaveURL(url => url.pathname === `/patch/${patchId}` && url.hash === '#ahri');
  await expect(page.locator('#ahri')).toBeVisible();
});

for (const interval of ['26.16/26.15', '26.15/26.16']) test(`comparison ${interval} preserves the selected subject and normalized interval`, async ({ page }) => {
  await page.goto(`/compare/${interval}?champions=azir`);
  await readyWorld(page);
  const workspace = page.locator('[data-comparison-workspace]');
  await expect(workspace).toHaveAttribute('data-comparison-ready','true');
  await expect(workspace.locator('[data-comparison-name]')).toHaveText('Azir');
  await expect(workspace.locator('[data-compare-champion]:not([hidden])')).toHaveCount(1);
  await expect(workspace.locator('[data-comparison-trail] a')).toHaveCount(1);
  await expect(workspace.locator('[data-comparison-trail] a')).toHaveAttribute('href','/patch/26.16#azir');
  await expect(workspace.locator('[data-comparison-explore]')).toHaveAttribute('href','/explore?champion=Azir&newer=26.16&older=26.15#change');
  await page.locator('[data-compare-all]').click();
  const choice = workspace.locator('[data-compare-champion="Belveth"] [data-compare-preview]');
  await unobstructed(choice);
  await choice.click();
  await expect(workspace.locator('[data-comparison-name]')).toHaveText("Bel'Veth");
  await expect(workspace.locator('[data-comparison-trail] a')).toHaveAttribute('href','/patch/26.16#belveth');
  await expect(workspace.locator('[data-comparison-history]')).toHaveAttribute('href','/champion/belveth');
  await expect(page).toHaveURL(url => url.hash === '#compare-belveth' && !url.searchParams.has('champions'));
  await page.reload();
  await readyWorld(page);
  await expect(workspace.locator('[data-comparison-name]')).toHaveText("Bel'Veth");
  await workspace.locator('[data-compare-champion="Azir"] [data-compare-preview]').click();
  await expect(page).toHaveURL(url => url.hash === '#compare-azir');
  await page.goBack();
  await expect(workspace.locator('[data-comparison-name]')).toHaveText("Bel'Veth");
  await expect(page).toHaveURL(url => url.hash === '#compare-belveth');
});

for (const entry of ['/compare', '/compare/26.16']) test(`${entry} preserves a shared champion and scene through its redirect`, async ({ page }) => {
  await page.goto(`${entry}?champions=azir#comparison`);
  await readyWorld(page);
  await expect(page).toHaveURL(url => /^\/compare\/\d+\.\d+\/\d+\.\d+\/?$/.test(url.pathname) && url.searchParams.get('champions') === 'azir' && url.hash === '#comparison');
  await expect(page.locator('[data-comparison-name]')).toHaveText('Azir');
  await expect(page.locator('[data-compare-champion]:not([hidden])')).toHaveCount(1);
});

test('patch filters can empty and restore the selected exact record without stale context', async ({ page }) => {
  await page.goto('/patch/26.16?champions=belveth#belveth');
  await readyWorld(page);
  await expect(page).toHaveURL(url => /^\/patch\/\d+\.\d+\/?$/.test(url.pathname) && url.searchParams.get('champions') === 'belveth' && url.hash === '#belveth');
  await expect(page.locator('#belveth')).toBeVisible();
  await page.getByRole('button', { name:'Clear filters', exact:true }).click();
  await expect(page.locator('#belveth')).toBeVisible();
  await page.locator('[data-patch-select="azir"]').click();
  await expect(page.locator('#azir')).toBeVisible();
  const search = page.getByRole('searchbox', { name:'Filter champions by name', exact:true });
  await search.fill('no champion matches this');
  await expect(page.locator('.change-card:not([hidden])')).toHaveCount(0);
  await page.getByRole('button', { name:'Clear filters', exact:true }).click();
  await expect(page.locator('.change-card:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#azir')).toBeVisible();
  await expect(page.locator('#azir')).toHaveJSProperty('inert', false);
  await expect(page.locator('#belveth')).toHaveJSProperty('inert', true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:signal-context:v1') ?? '{}').championId)).toBe('Azir');
  await expect(page).toHaveURL(url => url.hash === '#azir' && !url.searchParams.has('q') && !url.searchParams.has('champions'));
});

test('all original fields and source links remain available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled:false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('/patch/26.16#belveth');
    const lens = page.locator('#belveth [data-signal-lens]');
    await expect(lens.locator('[data-signal-record]:not([hidden])')).toHaveCount(records.length);
    await expect(lens.locator('[data-signal-options]')).toBeHidden();
    for (const [index, source] of records.entries()) {
      const record = lens.locator(`[data-signal-record="${index}"]`);
      if (source.kind === 'numeric') {
        await expect(record.locator('.before')).toHaveText(source.before!);
        await expect(record.locator('.after')).toHaveText(source.after!);
      } else await expect(record.locator('.prose-text')).toHaveText(source.text!);
    }
    await expect(lens.getByRole('link', { name:/^Original source/ })).toHaveAttribute('href',patch.sourceUrl);
    await page.goto('/champion/belveth#record-26-16');
    const history = page.locator('#record-26-16 [data-signal-lens]');
    await expect(history.locator('[data-signal-record]:not([hidden])')).toHaveCount(records.length);
    await expect(history.locator('[data-signal-record="1"] .before')).toHaveText(records[1]!.before!);
    await expect(history.locator('[data-signal-record="1"] .after')).toHaveText(records[1]!.after!);
    await expect(history.locator('[data-signal-record="2"] .prose-text')).toHaveText(records[2]!.text!);
    await expect(history.getByRole('link', { name:/^Original source/ })).toHaveAttribute('href',patch.sourceUrl);
    await page.goto('/compare/26.16/26.15');
    await expect(page.locator('[data-comparison-stage]')).toBeHidden();
    await expect(page.locator('[data-compare-champion="Azir"] .champ')).toBeVisible();
    await expect(page.locator('[data-compare-champion="Azir"] .trail a')).toHaveAttribute('href','/patch/26.16#azir');
  } finally { await context.close(); }
});

test('reduced motion preserves exact interactive records with no animated value transforms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/patch/26.16#belveth');
  await readyWorld(page);
  const lens = page.locator('#belveth [data-signal-lens]');
  const source = records[0]!;
  await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  const active = lens.locator('[data-signal-record]:not([hidden])');
  await active.getByRole('button',{ name:'Before',exact:true }).click();
  await expect(active).toHaveAttribute('data-signal-side','before');
  await expect(active.locator('.signal-value--before')).toHaveCSS('transform','none');
  await expect(active.locator('.before')).toHaveText(source.before!);
  await expect(active.locator('.after')).toHaveText(source.after!);
});

// The latest-patch shortcut has its own moving-data contract; historical record
// assertions above remain tied to their exact archived source.
test('latest patch shortcut preserves the selected champion, scope and fragment', async ({ page }) => {
  const directory = new URL('../../src/data/patches/', import.meta.url);
  const latest = readdirSync(directory).filter(name => /^\d+\.\d+\.json$/.test(name))
    .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))[0]!;
  const record = JSON.parse(readFileSync(new URL(latest, directory), 'utf8')) as typeof patch;
  const champion = record.champions[0]!.championId.toLowerCase();
  await page.goto(`/patch?champions=${champion}#${champion}`);
  await readyWorld(page);
  await expect(page).toHaveURL(url => url.pathname === `/patch/${record.id}`
    && url.searchParams.get('champions') === champion && url.hash === `#${champion}`);
  await expect(page.locator(`[id="${champion}"]`)).toBeVisible();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'champions');
});
