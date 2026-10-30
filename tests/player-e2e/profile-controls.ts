import { expect, type Page } from '@playwright/test';

const familyForQueue = (queue: string) => ['420', '440'].includes(queue) ? 'Ranked'
  : ['450', '2400', '720'].includes(queue) ? 'ARAM'
    : ['400', '480', '490', '430'].includes(queue) ? 'Normal' : 'More';

/** Exercise the visible family control, then its exact queue selector. */
export async function selectQueue(page: Page, queue: string) {
  const modes = page.getByRole('group', { name: 'Game modes', exact: true });
  if (queue === 'all') {
    await modes.getByRole('button', { name: 'All games', exact: true }).click();
  } else {
    const family = modes.getByRole('button', { name: familyForQueue(queue), exact: true });
    if (await family.getAttribute('aria-pressed') !== 'true') await family.click();
    await page.getByLabel('Game mode', { exact: true }).selectOption(queue);
  }
  await expectSelectedQueue(page, queue);
}

export async function expectSelectedQueue(page: Page, queue: string) {
  const modes = page.getByRole('group', { name: 'Game modes', exact: true });
  await expect(modes.getByRole('button', { name: queue === 'all' ? 'All games' : familyForQueue(queue), exact: true })).toHaveAttribute('aria-pressed', 'true');
  const selector = page.getByLabel('Game mode', { exact: true });
  if (queue === 'all') await expect(selector).toHaveCount(0);
  else await expect(selector).toHaveValue(queue);
}

export async function openFilters(page: Page) {
  const summary = page.locator('summary').filter({ hasText: /^Filters/ });
  const disclosure = summary.locator('..');
  if (!(await disclosure.evaluate(element => (element as HTMLDetailsElement).open))) await summary.click();
  await expect(disclosure).toHaveJSProperty('open', true);
}

export async function openStats(page: Page) {
  const summary = page.getByRole('region', { name: 'Recent match sample', exact: true }).locator('summary').filter({ hasText: 'Stats by mode' });
  const disclosure = summary.locator('..');
  if (!(await disclosure.evaluate(element => (element as HTMLDetailsElement).open))) await summary.click();
  await expect(disclosure).toHaveJSProperty('open', true);
}

/** Choose a focused scene through the same tab control a visitor uses. */
export async function openScene(page: Page, id: string) {
  const tab = page.locator(`[data-journey-tab="${id}"]`);
  await expect(tab).toBeVisible();
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click();
  await expect(page.locator(`#${id}`)).toBeVisible();
}
