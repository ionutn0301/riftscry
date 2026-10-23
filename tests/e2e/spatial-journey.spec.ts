import { test, expect } from '@playwright/test';

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
}

test('camera travels without replacing its canvas and supports reversal and skip', async ({ page }) => {
  await ready(page);
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: /Enter the observatory/ }).click();
  await expect(page.locator('.observatory')).toHaveAttribute('data-phase', 'travelling');
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  await page.getByRole('button', { name: /Chapter 1:/ }).click();
  await page.getByRole('button', { name: 'Skip travel', exact: true }).click();
  await expect(page.locator('.observatory')).toHaveAttribute('data-chapter', '0');
  await expect(page.locator('.observatory')).toHaveAttribute('data-phase', 'ready');
  expect(await canvas?.evaluate(node => node === document.querySelector('canvas'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Reduce motion', exact: true })).toHaveCount(1);
});

test('all destinations retain a single real-time scene', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await ready(page);
  for (let chapter = 0; chapter < 5; chapter++) {
    await page.getByRole('button', { name: new RegExp(`Chapter ${chapter + 1}:`) }).click();
    await expect(page.locator('.observatory')).toHaveAttribute('data-chapter', String(chapter), { timeout: 10000 });
    await expect(page.locator('.observatory')).toHaveAttribute('data-phase', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('.cinematic-frame')).toHaveCount(0);
    await page.screenshot({ path: `/tmp/agent-browser/${testInfo.project.name}-spatial-${chapter}.png` });
  }
});

test('WebGL context loss leaves records navigable and offers retry', async ({ page }) => {
  await ready(page);
  await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.getByRole('button', { name: 'Retry scene' })).toBeVisible();
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  await expect(page.locator('.observatory')).toHaveAttribute('data-chapter', '3');
  const toggle = page.getByRole('button', { name: /Tap to explore the record/ });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByRole('link', { name: 'Open this record' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry scene' }).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
});
