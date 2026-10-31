import { test, expect } from '@playwright/test';
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';
import patch from '../../src/data/patches/26.16.json' with { type: 'json' };

const belveth = patch.champions.find(champion => champion.championId === 'Belveth')!;
const changes = belveth.abilities.flatMap(ability => ability.changes);

for (const [width, height] of [[320,568],[359,603],[390,844],[700,800],[844,390],[1440,900]] as const) {
  test(`filtered champion deep link remains readable at ${width}x${height}`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('riftscry:pool', JSON.stringify(['Belveth'])));
    await page.goto('/patch/26.16?pool=1#belveth', { waitUntil: 'domcontentloaded' });
    await readyWorld(page);
    await page.waitForSelector('.filter-bar[data-ready="true"]');
    const matching = page.locator('.change-card[data-champion-id]:not([data-filtered])');
    const record = page.locator('#belveth');
    await expect(matching).toHaveCount(1);
    await expect(matching).toHaveAttribute('data-champion-id', 'belveth');
    await expect(record).not.toHaveAttribute('hidden');
    await expect(record).toHaveAttribute('data-classification', belveth.classification);
    await expect(page.locator('[data-patch-select="belveth"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-journey-panel]:not([hidden])')).toHaveAttribute('id', 'champions');

    // A fragment now reveals evidence inside the stationary scene. Its document
    // top is intentionally not the old sticky-header scroll offset.
    const panel = (await page.locator('#champions').boundingBox())!;
    const canvas = (await page.locator('.journey-record-canvas').boundingBox())!;
    const main = (await page.locator('#main').boundingBox())!;
    expect(canvas.x).toBeGreaterThanOrEqual(panel.x);
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
    expect(panel.y).toBeGreaterThanOrEqual(main.y);
    expect(panel.y + panel.height).toBeLessThanOrEqual(main.y + main.height + 1);
    expect(await page.locator('.journey-record-canvas').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await stationaryWorld(page);
    await expect(page.locator('.filter-bar')).toHaveCSS('position','static');

    await expect(record.locator('[data-signal-record]')).toHaveCount(changes.length);
    await expect(record.locator('[data-signal-record]:not([hidden])')).toHaveCount(1);
    for (const [index, change] of changes.entries()) {
      const choice = record.locator(`[data-signal-choice="${index}"]`);
      await unobstructed(choice);
      await choice.click();
      const row = record.locator(`[data-signal-record="${index}"]`);
      await expect(row).toBeVisible();
      if (change.kind === 'numeric') {
        await expect(row.locator('.before')).toHaveText(change.before!);
        await expect(row.locator('.after')).toHaveText(change.after!);
      } else await expect(row.locator('.prose-text')).toHaveText(change.text!);
      expect(await row.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
    await record.locator('[data-signal-choice="0"]').click();
    const healthValues = record.locator('[data-signal-record="0"] .signal-aperture');
    await healthValues.scrollIntoViewIfNeeded();
    await expect(healthValues).toBeInViewport({ ratio: 0.99 });

    if(width <= 700) {
      const name = await page.locator('#belveth > header h2').boundingBox();
      const badge = await page.locator('#belveth > header > :last-child').boundingBox();
      // The responsive header may put its badge beside or below the name; both
      // must remain distinct, within the same evidence column.
      expect(badge!.x >= name!.x + name!.width - 1 || badge!.y >= name!.y + name!.height - 1).toBe(true);
      expect(badge!.x + badge!.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
      const dock=await page.locator('.journey-header').boundingBox();
      expect(dock!.y).toBeGreaterThanOrEqual(-1);
      expect(dock!.y + dock!.height).toBeLessThanOrEqual(height);
      await unobstructed(healthValues);
    }
    await page.screenshot({path:testInfo.outputPath(`patch-record-${width}.png`)});
    await page.getByRole('button',{name:'Open the Rift map',exact:true}).click();
    await expect(page.locator('#rift-map-dialog')).toBeVisible();
    await page.getByRole('button',{name:'Close the Rift map',exact:true}).click();
    await expect(page).toHaveURL(url => url.hash === '#belveth' && url.searchParams.get('pool') === '1');
    const options = page.locator('.patch-filter-options');
    await unobstructed(options.locator('summary'));
    await options.locator('summary').click();
    const pool = page.getByRole('button',{name:'My pool (1)',exact:true});
    await unobstructed(pool);
    await pool.click();
    await expect(pool).toHaveAttribute('aria-pressed', 'false');
    await expect(page).not.toHaveURL(/pool=/);
    await options.locator('summary').click();
    await page.getByRole('searchbox',{name:'Filter champions by name'}).fill('Bel');
    await expect(matching).toHaveCount(1);
    await expect(matching).toHaveAttribute('data-champion-id', 'belveth');
    await stationaryWorld(page);
  });
}
