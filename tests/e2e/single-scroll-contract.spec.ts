import {mapControl} from '../shared/navigation';
import { expect, test, type Page } from '@playwright/test';
import { cinema, cinemaFitsViewport, closeEvidence, evidence, inspectCinema, openCinemaNavigation, readyCinema } from './cinema-test-helpers';
import { reachableTarget, readyWorld } from './journey-test-helpers';

const routes = [
  '/', '/explore', '/champions', '/champion/ahri', '/patches', '/patch/26.16',
  '/compare/26.16/26.14', '/pool', '/notebook', '/players', '/next-game', '/nonexistent-room',
] as const;

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 &&
        style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('[hidden]');
    };
    const containers = [...document.querySelectorAll('main *, .journey-map-inner *')]
      .filter(el => visible(el) && /^(auto|scroll)$/.test(getComputedStyle(el).overflowY)
        && el.scrollHeight > el.clientHeight + 3)
      .map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 60));
    return {
      containers,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      world: document.querySelector('[data-rift-cinema]')?.getBoundingClientRect().toJSON(),
    };
  });
}
test('application rooms and the cinematic home keep one document scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Chromium geometry sweep; other suites cover WebKit');
  test.setTimeout(180_000);
  for (const { width, height } of [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 568, height: 320 }, { width: 844, height: 390 },
    { width: 1366, height: 768 }, { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await readyWorld(page);
      await expect.poll(async () => (await audit(page)).horizontalOverflow,
        { message: route + ' at ' + width + 'x' + height + ' must never scroll horizontally' })
        .toBeLessThanOrEqual(1);
      const measured = await audit(page);
      expect(measured.containers, route + ' at ' + width + 'x' + height + ' has nested scrolling').toEqual([]);
      if (route === '/') await cinemaFitsViewport(page);
    }
  }
});
test('the jump map keeps all destinations reachable with one modal scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Chromium geometry sweep; WebKit tested by main suite');
  test.setTimeout(90_000);
  for (const { width, height } of [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 568, height: 320 }, { width: 844, height: 390 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/explore');
    await mapControl(page).click();
    const map = page.locator('#rift-map-dialog');
    const overflow = await map.evaluate(el => [...el.querySelectorAll('*')]
      .filter(node => /^(auto|scroll)$/.test(getComputedStyle(node).overflowY)
        && node.scrollHeight > node.clientHeight + 2).length);
    expect(overflow).toBe(0);
    for (const link of await map.locator('[data-world-link]').all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport({ ratio: .99 });
    }
    await map.getByRole('button', { name: 'Close the Rift map' }).click();
  }
});

test('the champion search stays within one screen on phones and desktop', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Chromium and WebKit geometry runs cover this case');
  test.setTimeout(180_000);
  for (const { width, height } of [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 568, height: 320 }, { width: 844, height: 390 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/explore');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    await page.locator('[data-roster-open]').click();
    const roster = page.locator('#voyage-roster');
    await expect(roster).toBeVisible();
    await expect.poll(() => roster.locator('[data-choose-champion]').count()).toBeGreaterThan(0);
    expect(await roster.locator('[data-choose-champion]').count()).toBeLessThanOrEqual(12);
    const scroll = await roster.evaluate(dialog => [dialog, ...dialog.querySelectorAll('*')]
      .filter(el => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY)
        && el.scrollHeight > el.clientHeight + 2)
      .map(el => String(el.className)));
    expect(scroll, 'Champion search must not contain a scrollable inner panel').toEqual([]);
    const search = roster.getByRole('searchbox', { name: 'Find a champion' });
    await expect(search).toBeFocused();
    await search.fill('Khazix');
    await expect(roster.locator('[data-choose-champion]')).toHaveCount(1);
    await expect(roster.locator('[data-choose-champion="Khazix"]')).toBeInViewport({ ratio: 1 });
    await roster.getByRole('button', { name: 'Close champion selection' }).click();
    await expect(roster).not.toBeVisible();
  }
});

test('home world controls and modal evidence stay tappable on short screens', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-chromium', 'Chromium and WebKit geometry runs cover this case');
  test.setTimeout(180_000);
  for (const { width, height } of [
    { width: 320, height: 480 }, { width: 320, height: 568 },
    { width: 390, height: 844 }, { width: 844, height: 390 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await readyCinema(page);
    for (const control of await cinema(page).locator('a:visible,button:visible').all()) await reachableTarget(control, page);
    await cinemaFitsViewport(page);
    await inspectCinema(page);
    for (const control of await evidence(page).locator('a:visible,button:visible').all()) await reachableTarget(control, page);
    const scrolls = await evidence(page).evaluate(dialog => [dialog, ...dialog.querySelectorAll('*')]
      .filter(element => element.getClientRects().length && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 3)
      .map(element => element.className));
    expect(scrolls.length, 'Evidence may use one modal scroll, never competing nested scroll areas').toBeLessThanOrEqual(1);
    await closeEvidence(page); await cinemaFitsViewport(page);
    const menu = await openCinemaNavigation(page);
    for (const control of await menu.locator('a:visible,button:visible').all()) await reachableTarget(control, page);
    await page.keyboard.press('Escape'); await cinemaFitsViewport(page);
  }
});

test('phone chapter controls have no overlapping or horizontally scrolling tab strip', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Cross-device Chromium geometry sweep');
  test.setTimeout(120_000);
  for (const width of [320, 359, 390]) {
    await page.setViewportSize({ width, height: 568 });
    // Chapter controls belong to application readers; the immersive home has no rail.
    for (const route of ['/explore', '/pool', '/notebook']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
      const tabs = page.locator('[data-journey-tab]');
      await expect(tabs.first()).toHaveAttribute('data-scene-number', '01');
      const geometry = await page.locator('[data-journey-controls]').evaluate((controls) => {
        const rail = controls.querySelector<HTMLElement>('[data-journey-tabs]')!;
        const visible = [...controls.querySelectorAll<HTMLElement>('button')].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
        });
        const positions = visible.map(el => {
          const rect = el.getBoundingClientRect();
          return { label: el.getAttribute('aria-label'), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
        });
        const overlaps: string[] = [];
        for (let a = 0; a < positions.length; a++) {
          for (let b = a + 1; b < positions.length; b++) {
            if (Math.min(positions[a]!.right, positions[b]!.right) - Math.max(positions[a]!.left, positions[b]!.left) > 1
              && Math.min(positions[a]!.bottom, positions[b]!.bottom) - Math.max(positions[a]!.top, positions[b]!.top) > 1)
              overlaps.push(positions[a]!.label + ' / ' + positions[b]!.label);
          }
        }
        return { overlap: overlaps, innerOverflow: rail.scrollWidth - rail.clientWidth, positions };
      });
      expect(geometry.innerOverflow, route + ' at ' + width + 'px has horizontal chapter scrolling').toBeLessThanOrEqual(1);
      expect(geometry.overlap, route + ' at ' + width + 'px has overlapping chapter controls').toEqual([]);
      for (const position of geometry.positions) expect(position.height).toBeGreaterThanOrEqual(43.99);
      const finalTab = tabs.last();
      await finalTab.click();
      await expect(finalTab).toHaveAttribute('aria-selected', 'true');
      await expect(finalTab).toHaveAttribute('aria-label', /.+/);
    }
  }
});

test('archive entry is immediately reachable and has readable text contrast', async ({ page }) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/patches');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    const entry = page.locator('[data-archive-focus-link]');
    await expect(entry).toBeInViewport({ ratio: 1 });
    const contrast = await entry.evaluate(element => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (value: string) => {
        const [r, g, b] = rgb(value).map(channel => {
          const normalized = channel / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        return .2126 * (r ?? 0) + .7152 * (g ?? 0) + .0722 * (b ?? 0);
      };
      const styles = getComputedStyle(element);
      const foreground = luminance(styles.color);
      const background = luminance(styles.backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(contrast, 'Primary archive action must have WCAG AA text contrast').toBeGreaterThanOrEqual(4.5);
  }
});
