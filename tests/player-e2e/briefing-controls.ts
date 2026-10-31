import { expect, type Page } from '@playwright/test';

/** Open the optional player settings through the same native disclosure visitors use. */
export async function openBriefingSettings(page: Page) {
  const settings = page.locator('.signal-player-scope');
  await expect(settings).toBeVisible();
  if (!(await settings.evaluate(element => (element as HTMLDetailsElement).open))) {
    await settings.locator(':scope > summary').click();
  }
  await expect(settings).toHaveJSProperty('open', true);
  await expect(settings.getByLabel('Game mode', { exact: true })).toBeVisible();
  return settings;
}
