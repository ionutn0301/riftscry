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
  if (!await menu.isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-menu-state', 'open');
  return menu;
}

export async function cinemaFitsViewport(page: Page) {
  const bounds = (await cinema(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => scrollY)).toBe(0);
}
