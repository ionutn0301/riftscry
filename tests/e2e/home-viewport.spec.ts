import { test, expect } from '@playwright/test';

const sizes = [
  [320, 480], [320, 568], [390, 844], [480, 320], [568, 320], [844, 390],
  [768, 1024], [1024, 768], [1101, 879], [1101, 880], [1366, 768], [1440, 900], [1920, 880], [1920, 1080],
] as const;
const player = {
  platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000',
  name: `${'LongPlayerName'.repeat(9)}#TEST`,
};

for (const [width, height] of sizes) {
  test(`the complete homepage opening fits ${width}×${height} for new and returning players`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const state of ['new', 'returning'] as const) {
      if (state === 'returning') await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-home-launcher]')).toHaveAttribute('data-player-state', state);
      await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-ready', 'true');
      await page.evaluate(() => document.fonts.ready);

      const hero = page.locator('.home-arrival');
      const bounds = (await hero.boundingBox())!;
      expect(bounds.y + bounds.height, `The ${state} hero extends below the screen`).toBeLessThanOrEqual(height + 1);
      expect(bounds.height).toBeGreaterThanOrEqual(height - 1);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const header = (await page.locator('.world-controls').boundingBox())!;
      const intro = (await hero.locator('.home-intro').boundingBox())!;
      expect(intro.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      await expect(hero.locator('.home-arrival-footer')).toBeInViewport({ ratio: 1 });

      for (const link of await hero.getByRole('link').all()) {
        const label = await link.getAttribute('aria-label');
        if (label) {
          const visibleLabel = await link.evaluate(element => {
            const text: string[] = [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const parent = walker.currentNode.parentElement;
              if (parent && !parent.closest('[aria-hidden="true"]') && parent.getClientRects().length) text.push(walker.currentNode.textContent ?? '');
            }
            return text.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
          });
          expect(label.replace(/\s+/g, ' ').toLowerCase()).toContain(visibleLabel);
        }
        const target = (await link.boundingBox())!;
        expect(target.height, `${await link.getAttribute('aria-label') ?? await link.innerText()} is too short`).toBeGreaterThanOrEqual(44);
        expect(target.width, `${await link.getAttribute('aria-label') ?? await link.innerText()} is too narrow`).toBeGreaterThanOrEqual(44);
        expect(target.y + target.height).toBeLessThanOrEqual(height + 1);
        expect(target.x).toBeGreaterThanOrEqual(0);
        expect(target.x + target.width).toBeLessThanOrEqual(width + 1);
        expect(await link.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), 'A hero action is covered by another element').toBe(true);
      }

      const proof = (await page.locator('.home-proof').boundingBox())!;
      // The first screen establishes the environment; the source-backed
      // archive example now belongs to the following chapter on every size.
      expect(proof.y).toBeGreaterThanOrEqual(height - 1);
      expect(await hero.evaluate(element => [element, ...element.querySelectorAll('*')].some(node =>
        /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1))).toBe(false);
    }
  });
}

test('the opening refits after rotating a returning player between portrait and landscape', async ({ page }) => {
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-home-launcher]')).toHaveAttribute('data-player-state', 'returning');
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await page.locator('.home-arrival').boundingBox())!.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByRole('link', { name: 'Open my briefing', exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
  }
});

test('remembering a player does not move the homepage heading or footer', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('astro-island[component-url*="HomeReturn"]')).not.toHaveAttribute('ssr', '');
    await page.evaluate(() => document.fonts.ready);
    const position = () => page.evaluate(() => ({
      heading: document.querySelector('#companion-heading')!.getBoundingClientRect().top,
      footer: document.querySelector('.home-arrival-footer')!.getBoundingClientRect().top,
      scroll: scrollY,
    }));
    const before = await position();
    await page.evaluate(selected => {
      localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
      window.dispatchEvent(new Event('riftscry:recent-player-change'));
    }, player);
    await expect(page.locator('[data-home-launcher]')).toHaveAttribute('data-player-state', 'returning');
    const after = await position();
    for (const key of ['heading', 'footer', 'scroll'] as const) expect(Math.abs(after[key] - before[key]), `${key} shifted while loading the selected player at ${viewport.width}px`).toBeLessThanOrEqual(1);
    await page.evaluate(() => localStorage.clear());
  }
});
