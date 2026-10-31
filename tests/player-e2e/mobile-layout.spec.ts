import { test, expect, type Locator } from '@playwright/test';
import { installFixtures, profilePath, query, recentAramWin, visualMatches } from './fixtures';
import { openFilters, openScene, selectQueue } from './profile-controls';

async function expectContained(locator: Locator) {
  const outside = await locator.evaluateAll(elements => elements.flatMap(element => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    const parent = element.closest('.match-row, .profile-controls, .player-form')?.getBoundingClientRect();
    const left = Math.max(0, parent?.left ?? 0);
    const right = Math.min(innerWidth, parent?.right ?? innerWidth);
    return box.left < left - 1 || box.right > right + 1 || element.scrollWidth > element.clientWidth + 1
      ? [{ text: element.textContent?.slice(0, 80), left: box.left, right: box.right, available: right - left }]
      : [];
  }));
  expect(outside).toEqual([]);
}

async function expectReadableFields(locator: Locator) {
  await expect(locator.first()).toBeVisible();
  const fields = await locator.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { font: parseFloat(style.fontSize), height: element.getBoundingClientRect().height };
  }));
  expect(fields.length).toBeGreaterThan(0);
  for (const field of fields) {
    expect(field.font).toBeGreaterThanOrEqual(16);
    expect(field.height).toBeGreaterThanOrEqual(44);
  }
  await expectContained(locator);
}

for (const width of [320, 768]) {
  test(`${width}px: profile controls and match rows stay inside their panels`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    // Long champion names and a full inventory expose clipping that a document
    // scrollWidth check cannot see when the page clips horizontal overflow.
    const matches = visualMatches.map(match => ({ ...match, info: { ...match.info,
      participants: match.info.participants.map(player => ({ ...player, championName: 'Nunu' })),
    } }));
    await installFixtures(page, { matches });
    await page.goto(profilePath);
    await expect(page.locator('.match-row')).toHaveCount(matches.length);
    await page.evaluate(() => document.fonts.ready);
    await expectContained(page.locator('.match-row, .match-row > *, .match-identity h3, .match-score strong'));
    const nameAndStatus = await page.locator('.match-row').evaluateAll(rows => rows.map(row => {
      const identity = row.querySelector('.match-identity h3')!.getBoundingClientRect();
      const status = row.querySelector('.match-status')!.getBoundingClientRect();
      return identity.right <= status.left || identity.bottom <= status.top || status.bottom <= identity.top;
    }));
    expect(nameAndStatus.every(Boolean)).toBe(true);

    await selectQueue(page, '420');
    await openFilters(page);
    await expectReadableFields(page.locator('.profile-controls select'));
    await page.getByLabel('Champion', { exact: true }).selectOption('Nunu');
    await expect(page.locator('.match-row')).toHaveCount(1);
  });

  test(`${width}px: expanded purchase evidence scrolls the document and notes stay readable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const timeline = { info: { frames: [{ timestamp: 1_500_000, events: Array.from({ length: 24 }, (_, index) => ({
      type: 'ITEM_PURCHASED', timestamp: (index + 1) * 60_000, participantId: 1, itemId: 3047,
    })) }] } };
    const requests = await installFixtures(page, { matches: visualMatches,
      response: request => request.action === 'timeline' ? { status: 200, json: timeline } : undefined,
    });
    await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`);
    await openScene(page, 'match-evidence');
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
    await page.getByText('Recorded item and death events · 24', { exact: true }).click();
    const events = page.locator('.purchase-timeline');
    await expect(events.locator('li')).toHaveCount(24);
    const dimensions = await events.evaluate(element => ({
      height: element.getBoundingClientRect().height, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
    }));
    expect(dimensions.height).toBeGreaterThan(560);
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
    await events.locator('li').first().scrollIntoViewIfNeeded();
    const row = await events.locator('li').first().boundingBox();
    await page.mouse.move(row!.x + row!.width / 2, row!.y + row!.height / 2);
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 250);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
    expect(await events.evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);

    await openScene(page, 'match-memory');
    await page.getByText('Save an adjustment from this match', { exact: true }).click();
    await expect(page.locator('.signal-adjustment-details')).toHaveJSProperty('open', true);
    await expectReadableFields(page.locator('.memory-draft input, .memory-draft select, .memory-draft textarea'));
    await page.getByLabel('Decision being reconsidered', { exact: true }).fill('Review the recorded boots purchase');
    await expect(page.getByLabel('Decision being reconsidered', { exact: true })).toHaveValue('Review the recorded boots purchase');
    expect(requests.filter(request => request.action === 'review')).toEqual([]);
  });
}
