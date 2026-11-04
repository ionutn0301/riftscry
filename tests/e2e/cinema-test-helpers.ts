import { expect, type Page } from '@playwright/test';
import type { OpeningSignal } from './journey-test-helpers';

export const cinema = (page: Page) => page.locator('[data-rift-cinema]');
export const evidence = (page: Page) => page.locator('[data-cinema-evidence]');

export async function readyCinema(page: Page, { fonts = true } = {}) {
  await expect(cinema(page)).toBeVisible();
  await expect(cinema(page)).toHaveAttribute('data-home-ready', 'true');
  await expect(cinema(page)).toHaveAttribute('data-home-subject', /^[A-Za-z0-9]+$/);
  if (fonts) await page.evaluate(() => document.fonts.ready);
}

export async function cinemaSignals(page: Page): Promise<OpeningSignal[]> {
  return JSON.parse(await page.locator('#home-signals-data').textContent() ?? '[]') as OpeningSignal[];
}

export async function selectedSignal(page: Page): Promise<OpeningSignal> {
  const id = await cinema(page).getAttribute('data-home-subject');
  const selected = (await cinemaSignals(page)).find(signal => signal.championId === id);
  expect(selected, 'The focused champion must have a real serialized archive record').toBeDefined();
  return selected!;
}

export async function chooseSignal(page: Page, signal: OpeningSignal) {
  await page.locator(`[data-home-choice="${signal.championId}"]`).click();
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signal.championId);
  await expect(page.locator(`[data-home-choice="${signal.championId}"]`)).toHaveAttribute('aria-current', 'true');
}

export async function inspectCinema(page: Page) {
  if (!await evidence(page).isVisible()) await page.locator('[data-cinema-inspect]').first().click();
  await expect(evidence(page)).toBeVisible();
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'inspect');
  return evidence(page);
}

export async function closeEvidence(page: Page) {
  await page.locator('[data-cinema-close]').click();
  await expect(evidence(page)).toBeHidden();
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(page).not.toHaveURL(/#(?:inspect|reveal|carry)$/);
}

export async function openCinemaNavigation(page: Page) {
  const menu = page.getByRole('dialog', { name: 'RiftScry navigation', exact: true });
  if (!await menu.isVisible()) await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-menu-state', 'open');
  return menu;
}

/** The homepage is a single screen. Every visible control must fit without
 * scrolling, including short landscape and effective zoom viewports. */
export async function cinemaFitsViewport(page: Page) {
  // Dynamic viewport units settle on the next rendering update after rotation.
  await expect.poll(() => cinema(page).evaluate(el => Math.abs(el.getBoundingClientRect().height-innerHeight))).toBeLessThanOrEqual(1);
  await championArtIsSeparate(page);
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-rift-cinema]')!;
    const visible = (el: Element) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const controls = [...root.querySelectorAll('a,button')].filter(el => !el.closest('dialog') && visible(el));
    return {
      horizontal: document.documentElement.scrollWidth - innerWidth,
      vertical: document.documentElement.scrollHeight - innerHeight,
      height: root.getBoundingClientRect().height,
      viewport: innerHeight,
      escaped: controls.filter(el => { const r = el.getBoundingClientRect(); return r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1; }).map(el => el.textContent?.trim()),
      nested: [...root.querySelectorAll('.cinema-main *, .cinema-bottom *, .cinema-footer *')].filter(el => visible(el) && /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2).map(el => el.className),
    };
  });
  expect(geometry.horizontal).toBeLessThanOrEqual(1);
  expect(geometry.vertical, 'The homepage must not scroll').toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.height - geometry.viewport)).toBeLessThanOrEqual(1);
  expect(geometry.escaped, 'Visible homepage actions must fit without scrolling').toEqual([]);
  expect(geometry.nested, 'The homepage must not contain scrolling sections').toEqual([]);
}

/** Figures stay clear of copy while the original world fills the whole homepage. */
export async function championArtIsSeparate(page: Page) {
  const report = await page.locator('[data-rift-cinema]').evaluate(root => {
    const art = root.querySelector('.cinema-art')!;
    const box = art.getBoundingClientRect();
    const collisions: string[] = [];
    const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const node = text.currentNode, el = node.parentElement;
      if (!node.textContent?.trim() || !el?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        || el.closest('script,style,svg,dialog,[aria-hidden="true"],.sr-only,.visually-hidden')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      if ([...range.getClientRects()].some(r => Math.min(box.right,r.right)-Math.max(box.left,r.left)>1
        && Math.min(box.bottom,r.bottom)-Math.max(box.top,r.top)>1)) collisions.push(node.textContent.trim());
    }
    const escaped = [...art.querySelectorAll('[data-cinema-poster]')].filter(el => {
      if (!el.getClientRects().length) return false;
      const r = el.getBoundingClientRect();
      return r.left < box.left-1 || r.right > box.right+1 || r.top < box.top-1 || r.bottom > box.bottom+1;
    }).map(el => el.tagName);
    const scene=root.querySelector(':scope > .cinema-world')!, canvas=scene.querySelector('canvas')!;
    const world=canvas.getBoundingClientRect(), page=root.getBoundingClientRect(), style=getComputedStyle(art);
    return { collisions, escaped, clip: style.overflow, width: box.width, height: box.height,
      background:style.backgroundColor,border:style.borderTopWidth,
      fullBleed:Math.abs(world.width-page.width)<1&&Math.abs(world.height-page.height)<1 };
  });
  expect(report.collisions, 'Homepage text must never paint over the champion art').toEqual([]);
  expect(report.escaped, 'The fallback figure must stay in its reserved scene space').toEqual([]);
  expect(report.fullBleed, 'One continuous cinematic world must fill the homepage').toBe(true);
  expect(report.background, 'The champion must never appear inside a background card').toBe('rgba(0, 0, 0, 0)');
  expect(report.border, 'There must be no frame around the champion').toBe('0px');
  expect(report.clip).toBe('hidden');
  expect(report.width).toBeGreaterThan(0);
  expect(report.height).toBeGreaterThan(0);
}
