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

/** The scene fits the document width; short/zoomed windows use native scrolling.
 * Check real section geometry so a vertically overlapping layout cannot pass. */
export async function cinemaFitsViewport(page: Page) {
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const header=rect('.cinema-header'), main=rect('.cinema-main'), actions=rect('.cinema-entry-actions'),
      bottom=rect('.cinema-bottom'), roster=rect('.cinema-roster'), footer=rect('.cinema-footer');
    return {
      horizontal: document.documentElement.scrollWidth-innerWidth,
      headerGap: main.top-header.bottom,
      taskGap: bottom.top-actions.bottom,
      footerGap: footer.top-roster.bottom,
      nested: [...document.querySelectorAll('.cinema-main *, .cinema-bottom *, .cinema-footer *')]
        .filter(el=>/^(auto|scroll)$/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+2)
        .map(el=>el.className),
    };
  });
  expect(geometry.horizontal).toBeLessThanOrEqual(1);
  expect(geometry.headerGap).toBeGreaterThanOrEqual(-1);
  expect(geometry.taskGap, 'The briefing and continuation need space before champion selection').toBeGreaterThanOrEqual(15);
  expect(geometry.footerGap, 'The champion picker must clear utility controls').toBeGreaterThanOrEqual(15);
  expect(geometry.nested, 'Only the document should scroll outside dialogs').toEqual([]);
}
