import { test, expect, type Page } from '@playwright/test';

async function settleLayout(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('failed champion portraits have a clean fixed-size fallback even before the page script starts', async ({ page }) => {
  let releaseScripts = () => {};
  const scriptsHeld = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'script') await scriptsHeld;
    await route.continue();
  });
  await page.route('https://ddragon.leagueoflegends.com/**/img/champion/*.png', route => route.abort());
  try {
    await page.goto('/', { waitUntil: 'commit' });
    const portraits = page.locator('.home-signal-portrait');
    await expect(portraits).toHaveCount(3);
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('.home-signal-portrait img')).every(image => image.complete && image.naturalWidth === 0));
    const sizes = await portraits.evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
    for (const portrait of await portraits.all()) {
      await expect(portrait.locator('img')).toHaveCSS('opacity', '0');
      await expect(portrait.locator('span')).toBeVisible();
      await expect(portrait).toHaveAttribute('aria-hidden', 'true');
    }
    releaseScripts();
    const signals = page.locator('[data-home-signals]');
    await expect(signals).toHaveAttribute('data-ready', 'true');
    for (const [index, portrait] of (await portraits.all()).entries()) {
      await expect(portrait.locator('img')).toBeHidden();
      await expect(portrait.locator('img')).toHaveAttribute('data-loaded', 'false');
      const bounds = await portrait.boundingBox();
      expect(bounds!.width).toBe(sizes[index]!.width);
      expect(bounds!.height).toBe(sizes[index]!.height);
    }
    const tabs = signals.getByRole('tab');
    for (const tab of await tabs.all()) {
      const name = await tab.locator('.home-signal-portrait + span').innerText();
      await expect(tab).toHaveAccessibleName(name);
    }
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(signals.getByRole('tabpanel')).toHaveCount(1);
  } finally { releaseScripts(); }
});

test('homepage champion examples change without moving the page, tabs or following content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const signals = page.locator('[data-home-signals]');
  await expect(signals).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('astro-island[component-url*="HomeReturn"]')).not.toHaveAttribute('ssr', '');
  await page.evaluate(() => document.fonts.ready);
  const tabs = signals.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  // Put the controls fully below the fixed header. A test runner's automatic
  // scroll into view must not obscure an actual tab-selection jump.
  await tabs.first().evaluate(element => {
    const headerBottom = document.querySelector('.world-controls')!.getBoundingClientRect().bottom;
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - headerBottom - 32, behavior: 'instant' });
  });
  await settleLayout(page);
  const position = () => signals.evaluate(element => ({
    scroll: window.scrollY,
    height: element.getBoundingClientRect().height,
    tabs: element.querySelector('.home-signal-tabs')!.getBoundingClientRect().top,
    note: element.querySelector('.home-signal-note')!.getBoundingClientRect().top,
  }));
  const baseline = await position();
  const expectStationary = async () => {
    await settleLayout(page);
    const current = await position();
    for (const key of ['scroll', 'height', 'tabs', 'note'] as const) {
      expect(Math.abs(current[key] - baseline[key]), `${key} moved while selecting a champion`).toBeLessThanOrEqual(1);
    }
    await expect(signals.getByRole('tabpanel')).toHaveCount(1);
    const inactive = signals.locator('[role="tabpanel"][hidden]');
    await expect(inactive).toHaveCount(2);
    for (const panel of await inactive.all()) {
      await expect(panel).toHaveAttribute('inert', '');
      await expect(panel).toHaveAttribute('aria-hidden', 'true');
    }
  };

  for (const index of [1, 2, 0, 2, 1, 0]) {
    await tabs.nth(index).click();
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
    await expectStationary();
  }
  await tabs.first().evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
  for (const [key, index] of [['ArrowRight', 1], ['End', 2], ['ArrowRight', 0], ['ArrowLeft', 2], ['Home', 0]] as const) {
    await page.keyboard.press(key);
    await expect(tabs.nth(index)).toBeFocused();
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
    await expectStationary();
  }
});
