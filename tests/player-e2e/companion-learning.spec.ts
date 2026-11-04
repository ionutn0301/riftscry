import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { installFixtures, sourceMatch, platform, puuid, itemMetadata } from './fixtures';

const learningMatch = structuredClone(sourceMatch);
learningMatch.info.participants[0]!.item1 = 3006;
const learningItems = { ...itemMetadata, data: { ...itemMetadata.data,
  3006: { ...itemMetadata.data[3006], maps: { '11': true }, stats: { PercentAttackSpeedMod: .3, FlatMovementSpeedMod: 45 }, gold: { total: 1100, purchasable: true } },
  3047: { name: 'Armor boots', maps: { '11': true }, stats: { FlatArmorMod: 25, FlatMovementSpeedMod: 45 }, gold: { total: 1200, purchasable: true }, description: 'Synthetic fixture passive.' },
} };
const matchUrl = `/matches/${sourceMatch.metadata.matchId}?${new URLSearchParams({ platform, puuid })}`;
for (const width of [320, 390, 1440]) {
  test(`companion learning: guest review and item learning at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = await installFixtures(page, { matches: [learningMatch], response: request => request.action === 'items' ? { status: 200, json: learningItems } : undefined });
    await page.goto(matchUrl);
    const quick = page.locator('[data-quick-review]');
    await quick.locator('summary').click();
    expect(requests.filter(request => request.action === 'timeline')).toHaveLength(0);
    await quick.getByRole('button', { name: 'Find a review moment', exact: true }).click();
    await expect(quick.getByLabel('Choose a moment')).toBeVisible();
    await expect(quick.locator('.review-moment>strong')).toHaveText('0:30');
    await quick.getByLabel('Choose a moment').selectOption('event-0');
    await expect(quick.locator('.review-moment>strong')).toHaveText('0:00');
    await quick.getByRole('button', { name: 'Inspect recorded event', exact: false }).click();
    await expect(page.locator('#fact-event-0')).toBeVisible();
    await expect(page.locator('#fact-event-0')).toBeFocused();
    expect(requests.filter(request => request.action === 'timeline')).toHaveLength(1);
    expect(requests.filter(request => request.action === 'review')).toHaveLength(0);

    await page.goto(`${matchUrl}#match-overview`);
    const build = page.locator('[data-build-learning]');
    await build.locator(':scope > summary').click();
    const choices = build.getByRole('group').getByRole('button');
    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(build.locator('h3')).toHaveText(await choices.nth(1).innerText());
    const comparison = build.locator('[data-item-comparison]');
    await comparison.locator('summary').click();
    await comparison.getByLabel('Compare', { exact: false }).selectOption('3047');
    await expect(comparison.getByRole('table')).toContainText('Not listed');
    await expect(comparison.getByRole('status')).toContainText('+100 gold');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await mkdir('player-visuals', { recursive: true });
    await build.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `player-visuals/learning-build-${width}.png`, fullPage: true });
    await build.locator(':scope > summary').click();
    // Returning to the overview is a same-document chapter change. The
    // opened review and fetched timeline should survive it without a refetch.
    await expect(quick).toHaveJSProperty('open', true);
    await expect(quick.getByLabel('Choose a moment')).toBeVisible();
    expect(requests.filter(request => request.action === 'timeline')).toHaveLength(1);
    await quick.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `player-visuals/learning-review-${width}.png`, fullPage: true });
    await quick.getByRole('link', { name: 'Write my takeaway in Notebook', exact: false }).click();
    await expect(page).toHaveURL(/\/notebook\?champion=Ahri&queue=420#notes$/);
  });
}

test('companion learning: timeline failure is recoverable and never requests AI', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.route('**/api/player/timeline?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) }));
  await page.goto(matchUrl);
  const quick = page.locator('[data-quick-review]');
  await quick.locator('summary').click();
  await quick.getByRole('button', { name: 'Find a review moment', exact: true }).click();
  await expect(quick.getByText(/Timeline unavailable/)).toBeVisible();
  await page.unroute('**/api/player/timeline?**');
  await quick.getByRole('button', { name: 'Retry review moments', exact: true }).click();
  await expect(quick.getByLabel('Choose a moment')).toBeVisible();
  expect(requests.filter(request => request.action === 'review')).toHaveLength(0);
});
