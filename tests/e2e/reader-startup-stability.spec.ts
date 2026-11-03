import { expect, test, type Locator, type Page } from '@playwright/test';

async function holdModules(page: Page) {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'script') await held;
    await route.continue();
  });
  return release;
}

async function readerPaint(page: Page) {
  // Inspect the actual entrance without waiting for document.fonts.ready or
  // the blocked module load; settled screenshots would miss this transition.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function documentBox(locator: Locator) {
  return locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
  });
}

function sameGeometry(before: Awaited<ReturnType<typeof documentBox>>, after: Awaited<ReturnType<typeof documentBox>>, axes: Array<'x' | 'y' | 'width' | 'height'> = ['x', 'y', 'width', 'height']) {
  for (const axis of axes) expect(Math.abs(after[axis] - before[axis]), `${axis} should not move when reader modules arrive`).toBeLessThanOrEqual(1);
}

test('champion artwork stays beside its first record while the full history is enhanced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const release = await holdModules(page);
  try {
    await page.goto('/champion/ahri', { waitUntil: 'commit' });
    const art = page.locator('.journey-champion-art picture');
    const header = page.locator('#route-arrival');
    const chapters = page.locator('.journey-chapters');
    const save = page.locator('[data-direct-save="Ahri"]');
    await expect(art).toBeVisible();
    await expect(page.locator('body')).not.toHaveAttribute('data-journey-ready', 'true');
    expect(await page.locator('[data-history-record]').count()).toBeGreaterThan(1);
    await expect(page.locator('[data-history-record][hidden]')).toHaveCount(0);
    await readerPaint(page);
    const before = { art: await documentBox(art), header: await documentBox(header), chapters: await documentBox(chapters), save: await documentBox(save) };
    expect(before.chapters.height, 'Chapter controls need a reserved row before enhancement').toBeGreaterThan(0);
    await expect(save).toHaveAccessibleName('Save Ahri to My Pool');
    const panel = await documentBox(page.locator('#history'));
    expect(Math.abs(before.art.y - panel.y), 'The full SSR history must not push its artwork down the page').toBeLessThanOrEqual(1);
    const padding = await page.locator('#main').evaluate(element => getComputedStyle(element).paddingTop);

    release();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    await expect(page.locator('[data-history-record]:not([hidden])')).toHaveCount(1);
    await readerPaint(page);
    sameGeometry(before.art, await documentBox(art));
    sameGeometry(before.header, await documentBox(header));
    sameGeometry(before.chapters, await documentBox(chapters));
    sameGeometry(before.save, await documentBox(save));
    await expect(save).toHaveAccessibleName('Save Ahri to My Pool');
    await expect(page.locator('#main')).toHaveCSS('padding-top', padding);
    await expect(page.locator('[data-history-record]:not([hidden])').getByRole('link', { name: /Original source/ })).toHaveAttribute('href', /^https:\/\//);
  } finally { release(); }
});

test('patch chooser reserves its final rows before modules select one record', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const release = await holdModules(page);
  try {
    await page.goto('/patch/26.16', { waitUntil: 'commit' });
    const chooser = page.locator('.journey-record-selector');
    const canvas = page.locator('.journey-record-canvas');
    const chapters = page.locator('.journey-chapters');
    await expect(chooser).toBeVisible();
    await expect(page.locator('body')).not.toHaveAttribute('data-journey-ready', 'true');
    expect(await canvas.locator('.change-card').count()).toBeGreaterThan(1);
    await expect(canvas.locator('.change-card[hidden]')).toHaveCount(0);
    await readerPaint(page);
    const before = { chooser: await documentBox(chooser), canvas: await documentBox(canvas), chapters: await documentBox(chapters) };
    expect(before.chapters.height, 'Chapter controls need a reserved row before enhancement').toBeGreaterThan(0);
    const padding = await page.locator('#main').evaluate(element => getComputedStyle(element).paddingTop);

    release();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
    await expect(canvas.locator('.change-card:not([hidden])')).toHaveCount(1);
    await readerPaint(page);
    const mobile = page.viewportSize()!.width <= 700;
    sameGeometry(before.chooser, await documentBox(chooser), mobile ? ['x', 'y', 'width', 'height'] : ['x', 'y', 'width']);
    // The selected record's height may change; its entrance must stay put.
    sameGeometry(before.canvas, await documentBox(canvas), ['x', 'y', 'width']);
    sameGeometry(before.chapters, await documentBox(chapters));
    await expect(page.locator('#main')).toHaveCSS('padding-top', padding);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally { release(); }
});

for (const record of [
  { path: '/champion/ahri#record-26-3', selector: '[data-history-record]', id: 'record-26-3', link: '[data-history-select="26.3"]' },
  { path: '/patch/26.3#ahri', selector: '.journey-record-canvas .change-card', id: 'ahri', link: '[data-patch-select="ahri"]' },
]) {
  test(`an explicit ${record.id} fragment survives delayed reader enhancement`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const release = await holdModules(page);
    try {
      await page.goto(record.path, { waitUntil: 'commit' });
      const requested = page.locator(`#${record.id}`);
      await expect(requested).toBeVisible();
      await expect(requested.getByRole('link', { name: /Original source/ })).toHaveAttribute('href', /^https:\/\//);
      await expect(page.locator(`${record.selector}[hidden]`)).toHaveCount(0);
      release();
      await expect(page.locator(`${record.selector}:not([hidden])`)).toHaveCount(1);
      await expect(page.locator(`${record.selector}:not([hidden])`)).toHaveAttribute('id', record.id);
      await expect(page.locator(record.link)).toHaveAttribute('aria-current', 'true');
      await expect(page).toHaveURL(url => url.hash === `#${record.id}`);
    } finally { release(); }
  });
}

for (const fallback of ['no JavaScript', 'failed modules'] as const) {
  test.describe(`${fallback} reader fallback`, () => {
    if (fallback === 'no JavaScript') test.use({ javaScriptEnabled: false });
    test('all historical records, native selectors, and original sources remain readable', async ({ page }) => {
      if (fallback === 'failed modules') await page.route('**/*', route => route.request().resourceType() === 'script' ? route.abort() : route.continue());
      for (const route of [
        { path: '/champion/ahri', records: '[data-history-record]', links: '[data-history-select]' },
        { path: '/patch/26.16', records: '.journey-record-canvas .change-card', links: '[data-patch-select]' },
      ]) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).not.toHaveAttribute('data-journey-ready', 'true');
        expect(await page.locator(route.records).count()).toBeGreaterThan(1);
        await expect(page.locator(`${route.records}[hidden]`)).toHaveCount(0);
        const last = page.locator(route.links).last();
        const href = await last.getAttribute('href');
        expect(href).toMatch(/^#/);
        await last.click();
        await expect(page).toHaveURL(url => url.hash === href);
        const selected = page.locator(href!);
        await expect(selected).toBeVisible();
        await expect(selected.getByRole('link', { name: /Original source/ })).toHaveAttribute('href', /^https:\/\//);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    });
  });
}
