import { expect, test, type Page } from '@playwright/test';
import { openScene, readyJourney, stationaryWorld, unobstructed } from './journey-test-helpers';

const source15 = 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-15-notes/';
const source16 = 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/';
const health15 = { label: 'Health Growth', event: '26.15:Belveth:0:base:9', patch: '26.15', date: '2026-07-28', text: '105 → 110', source: source15 };
const health16 = { label: 'Health Growth', event: '26.16:Belveth:0:base:0', patch: '26.16', date: '2026-08-11', text: '110 → 105', source: source16 };
const azirBefore = '60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP)';
const azirAfter = '75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)';
const azirDamage = { label: 'Damage', event: '26.16:Azir:0:Q:0', patch: '26.16', date: '2026-08-11', text: `${azirBefore} → ${azirAfter}`, source: source16 };
const remora = { label: 'True Form Remora Indicator', event: '26.16:Belveth:1:R:1', patch: '26.16', date: '2026-08-11', text: 'Resource bar now turns purple when True Form can spawn Remora', source: source16 };

async function expectTrace(page: Page, record: typeof health15) {
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'history');
  await expect(page.locator('[data-trace-values]')).toBeVisible();
  await expect(page.locator('[data-trace-values]')).toHaveText(record.text);
  await expect(page.locator('[data-trace-caption]')).toContainText(record.label);
  await expect(page.locator('[data-trace-patch]')).toHaveText(`PATCH ${record.patch}`);
  await expect(page.locator('[data-trace-date]')).toHaveText(record.date);
  await expect(page.locator('[data-trace-date]')).toHaveAttribute('datetime', record.date);
  await expect(page.locator('[data-trace-source]')).toHaveAttribute('href', record.source);
  await expect(page.locator('[data-select-record][aria-pressed="true"]')).toHaveAttribute('data-select-record', record.event);
  await expect(page).toHaveURL(url => url.hash === '#history' && url.searchParams.get('event') === record.event);
  const clipping = await page.locator('[data-trace-values]').evaluate(element => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight,
  }));
  expect(clipping.horizontal).toBeLessThanOrEqual(1);
  expect(clipping.vertical).toBeLessThanOrEqual(1);
}

test('the shared field control keeps chronological evidence, source and interval through reload and Back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/explore?champion=Belveth&older=26.14&newer=26.16&ref=continuous-evidence#history');
  await readyJourney(page);
  const field = page.locator('[data-field-choice]');
  await expect(field).toHaveCount(1);
  await unobstructed(field);
  // Consecutive selections must leave the final field in the current scene.
  await field.selectOption({ label: 'Base stats / Attack Speed' });
  await field.selectOption({ label: 'Base stats / Health Growth' });
  await expectTrace(page, health15);
  await expect(page).toHaveURL(url => url.searchParams.get('champion') === 'Belveth'
    && url.searchParams.get('older') === '26.14' && url.searchParams.get('newer') === '26.16'
    && url.searchParams.get('ref') === 'continuous-evidence');
  const stops = page.locator('[data-history-trace] [data-select-record]');
  await expect(stops).toHaveCount(2);
  await expect(stops.locator('strong')).toHaveText(['26.15', '26.16']);
  await expect(stops.first()).toHaveAccessibleName(`${health15.date}, patch ${health15.patch}: ${health15.text}`);
  await expect(stops.last()).toHaveAccessibleName(`${health16.date}, patch ${health16.patch}: ${health16.text}`);
  await expect(stops.first()).not.toContainText('105');
  await expect(stops.last()).not.toContainText('110');

  await stops.last().click();
  await expectTrace(page, health16);
  const exactReading = page.url();
  await page.reload();
  await readyJourney(page);
  await expect(page).toHaveURL(exactReading);
  await expectTrace(page, health16);
  await expect(field.locator('option:checked')).toHaveText('Base stats / Health Growth');

  await page.locator('[data-period-older]').selectOption('26.15');
  await expect(page).toHaveURL(url => url.searchParams.get('older') === '26.15' && url.hash === '#history');
  await expect(stops).toHaveCount(1);
  await expectTrace(page, health16);
  await page.goBack();
  await readyJourney(page);
  await expect(page).toHaveURL(exactReading);
  await expect(stops).toHaveCount(2);
  await expectTrace(page, health16);

  const context = page.locator('details.trace-context');
  await expect(context).toHaveJSProperty('open', false);
  await context.locator('summary').click();
  await expect(context).toHaveJSProperty('open', true);
  await expect(context.locator('[data-trace-connection]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('champion changes retain History and complete numeric or prose evidence with reduced motion', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore?champion=Belveth&older=26.15&newer=26.16&ref=history-perspective#history');
  await readyJourney(page);
  const field = page.locator('[data-field-choice]');
  await field.selectOption({ label: 'R / True Form Remora Indicator' });
  await expectTrace(page, remora);

  await page.locator('.quick-perspectives [data-choose-champion="Azir"]').click();
  await readyJourney(page);
  await expect(page.locator('[data-field-champion]')).toHaveText('Azir');
  await expect(field).toBeVisible();
  await expectTrace(page, azirDamage);
  await expect(page).toHaveURL(url => url.searchParams.get('champion') === 'Azir'
    && url.searchParams.get('older') === '26.15' && url.searchParams.get('newer') === '26.16'
    && url.searchParams.get('ref') === 'history-perspective');
  await expect(page.locator('[data-select-record][aria-pressed="true"]')).toHaveAccessibleName(`${azirDamage.date}, patch ${azirDamage.patch}: ${azirDamage.text}`);

  await page.locator('.quick-perspectives [data-choose-champion="Belveth"]').click();
  await readyJourney(page);
  await field.selectOption({ label: 'R / True Form Remora Indicator' });
  await expectTrace(page, remora);
  await expect(page.locator('[data-trace-reading]')).toHaveAttribute('data-kind', 'prose');
  await expect(page.locator('[data-select-record][aria-pressed="true"]')).toHaveAccessibleName(`${remora.date}, patch ${remora.patch}: ${remora.text}`);
  await expect(page).toHaveURL(url => url.searchParams.get('champion') === 'Belveth'
    && url.searchParams.get('older') === '26.15' && url.searchParams.get('newer') === '26.16'
    && url.searchParams.get('ref') === 'history-perspective');
  await page.reload();
  await readyJourney(page);
  await expectTrace(page, remora);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`unavailable artwork preserves the identity and usable field control at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    let blockedArt = 0;
    await page.route('**/cdn/*/img/champion/Azir.png', route => route.abort());
    await page.route(/https:\/\/ddragon\.leagueoflegends\.com\/cdn\/img\/champion\/(splash|loading)\/Azir_0\.jpg$/, route => {
      blockedArt++;
      return route.abort();
    });
    await page.goto('/explore?champion=Azir&older=26.15&newer=26.16#change');
    await readyJourney(page);
    await expect(page.locator('.perspective-media [data-art-fallback]')).toBeVisible();
    await expect(page.locator('[data-champion-splash]')).toBeHidden();
    expect(blockedArt).toBeGreaterThan(0);
    const perspective = page.locator('.quick-perspectives [data-choose-champion="Azir"]');
    await expect(perspective).toHaveAccessibleName('Azir');
    await expect(perspective.locator('[data-featured-fallback]')).toBeVisible();
    await expect(perspective.locator('[data-featured-art]')).toBeHidden();
    await unobstructed(perspective);
    const target = await perspective.boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    const field = page.locator('[data-field-choice]');
    await expect(field).toHaveCount(1);
    await unobstructed(field);
    expect(await field.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      const media = box('.perspective-media'), fallback = box('[data-art-fallback]');
      const caption = box('.perspective-identity figcaption'), context = box('.voyage-field-context');
      return {
        fallbackInside: fallback.left >= media.left - 1 && fallback.right <= media.right + 1
          && fallback.top >= media.top - 1 && fallback.bottom <= media.bottom + 1,
        captionOverlapsControl: Math.min(caption.right, context.right) > Math.max(caption.left, context.left)
          && Math.min(caption.bottom, context.bottom) > Math.max(caption.top, context.top),
      };
    });
    expect(layout.fallbackInside).toBe(true);
    expect(layout.captionOverlapsControl).toBe(false);
    await field.selectOption({ label: 'Q / Damage' });
    await expect(page.locator('[data-record-before]')).toHaveText(azirBefore);
    await expect(page.locator('[data-record-after]')).toHaveText(azirAfter);
    await openScene(page, 'history');
    await unobstructed(field);
    await expectTrace(page, azirDamage);
    await stationaryWorld(page);
    expect(errors).toEqual([]);
  });
}
