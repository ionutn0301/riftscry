import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';

async function ready(page: Page) {
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-ready', 'true');
  await expect(page.locator('main h1')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
}

async function staticScene(page: Page) {
  const scene = page.locator('[data-rift-scene]');
  await expect(scene).toHaveCount(1);
  await expect(scene).toHaveAttribute('aria-hidden', 'true');
  await expect(scene).toHaveAttribute('data-rift-renderer', 'static');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  const fallback = page.locator('[data-rift-scene-static]');
  await expect(fallback).toBeVisible();
  expect(await fallback.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const drawing = (element as SVGGraphicsElement).getBBox();
    return rect.width > 0 && rect.height > 0 && drawing.width > 0 && drawing.height > 0
      && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  }), 'The fallback must contain a rendered scene, not an empty canvas').toBe(true);
  await expect(scene.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
}

async function unobstructed(control: Locator) {
  await expect(control).toBeVisible();
  expect(await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  }), 'The scene must not intercept the useful control').toBe(true);
}

async function localDestination(link: Locator, pathname: string) {
  await expect.poll(() => link.evaluate(element => {
    const url = new URL((element as HTMLAnchorElement).href, location.href);
    return url.origin === location.origin ? url.pathname + url.search + url.hash : url.href;
  })).toBe(pathname);
}

async function observeSceneRendering(page: Page) {
  await page.addInitScript(() => {
    const activity = { contexts: 0, paints: 0 };
    Object.defineProperty(window, '__livingRiftActivity', { value: activity });
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (/^(webgl2?|experimental-webgl)$/.test(kind) && this.matches('[data-rift-scene-canvas]')) activity.contexts++;
        return Reflect.apply(getContext, this, [kind, ...args]);
      },
    });
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue;
      const drawArrays = Context.prototype.drawArrays;
      Object.defineProperty(Context.prototype, 'drawArrays', {
        configurable: true,
        value: function (this: WebGLRenderingContext, ...args: Parameters<WebGLRenderingContext['drawArrays']>) {
          if (this.canvas instanceof HTMLCanvasElement && this.canvas.matches('[data-rift-scene-canvas]')) activity.paints++;
          return Reflect.apply(drawArrays, this, args);
        },
      });
    }
  });
}

const activity = (page: Page) => page.evaluate(() => (window as unknown as {
  __livingRiftActivity: { contexts: number; paints: number };
}).__livingRiftActivity);

test.describe('the shared scene before JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the static environment leaves archive navigation immediately usable', async ({ page }) => {
    await page.goto('/patches');
    await staticScene(page);
    const latest = page.locator('[data-archive-focus-link]');
    await latest.scrollIntoViewIfNeeded();
    await unobstructed(latest);
    const target = await latest.getAttribute('href');
    expect(target).toMatch(/^\/patch\/\d+\.\d+$/);
    await latest.click();
    await expect(page).toHaveURL(url => url.pathname === target);
    await staticScene(page);
    await expect(page.getByRole('link', { name: /Riot.?s notes/ }).first()).toHaveAttribute('href', /^https:\/\//);
  });
});

test('without WebGL the scene stays visible and the champion task still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
        return Reflect.apply(getContext, this, [kind, ...args]);
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/champions');
  await ready(page);
  await staticScene(page);
  const search = page.getByRole('searchbox', { name: 'Find a champion', exact: true });
  await unobstructed(search);
  await search.fill('nunu');
  await expect(page.locator('[data-roster-row]:not([hidden])')).toHaveCount(1);
  await page.locator('[data-roster-row]:not([hidden]) a').click();
  await expect(page).toHaveURL(/\/champion\/nunu\/?$/);
  await ready(page);
  await staticScene(page);
  await expect(page.locator('main h1')).toContainText('Nunu & Willump');
  expect(errors).toEqual([]);
});

for (const preference of ['device', 'saved'] as const) {
  test(`${preference} reduced motion keeps the shared scene visible without allocating WebGL`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference === 'device' ? 'reduce' : 'no-preference' });
    if (preference === 'saved') await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
    await observeSceneRendering(page);
    await page.goto('/champions');
    await ready(page);
    await staticScene(page);
    const scene = page.locator('[data-rift-scene]');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(scene).toHaveAttribute('data-rift-motion', 'still');
    await expect(scene).toHaveAttribute('data-rift-paused', 'true');
    await page.getByRole('searchbox', { name: 'Find a champion', exact: true }).fill('Ahri');
    await expect(page.locator('[data-roster-count]')).toHaveText('1');
    expect(await activity(page)).toEqual({ contexts: 0, paints: 0 });
    expect(await scene.evaluate(element => element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length)).toBe(0);
  });
}

test('full motion paints while visible, pauses for the back-forward cache and resumes once', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await observeSceneRendering(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/champions');
  await ready(page);
  const scene = page.locator('[data-rift-scene]');
  const webglSupported = await page.evaluate(() => {
    try {
      const probe = document.createElement('canvas').getContext('webgl');
      if (!probe) return false;
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch { return false; }
  });
  if (webglSupported) await expect(scene).toHaveAttribute('data-rift-renderer', 'webgl');
  else await expect(scene).toHaveAttribute('data-rift-renderer', /^(webgl|static)$/);
  const renderer = await scene.getAttribute('data-rift-renderer');
  await testInfo.attach('scene-renderer', {
    body: JSON.stringify({ webglSupported, renderer }), contentType: 'application/json',
  });
  await unobstructed(page.getByRole('searchbox', { name: 'Find a champion', exact: true }));

  // A browser without a usable GPU must keep the same readable fallback.
  // GPU-capable runs additionally verify actual draws, rather than a CSS flag.
  if (renderer === 'static') {
    await staticScene(page);
    expect(errors).toEqual([]);
    return;
  }

  await expect(page.locator('[data-rift-scene-canvas]')).toBeVisible();
  await expect(scene).toHaveAttribute('data-rift-motion', 'animated');
  await expect(scene).toHaveAttribute('data-rift-paused', 'false');
  const initial = await activity(page);
  await expect.poll(async () => (await activity(page)).paints).toBeGreaterThan(initial.paints);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(scene).toHaveAttribute('data-rift-paused', 'true');
  const paused = await activity(page);
  // Observe a period longer than several normal frames to catch a leaked loop.
  await page.waitForTimeout(200);
  expect((await activity(page)).paints).toBe(paused.paints);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(scene).toHaveAttribute('data-rift-paused', 'false');
  await expect.poll(async () => (await activity(page)).paints).toBeGreaterThan(paused.paints);
  expect((await activity(page)).contexts).toBe(initial.contexts);
  await expect(page.locator('[data-rift-scene-canvas]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('map focus previews a destination and native navigation preserves the filtered return', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/champions?q=Ahri&role=mid');
  await ready(page);
  const open = page.getByRole('button', { name: 'Open the Rift map', exact: true });
  await open.click();
  const map = page.getByRole('dialog', { name: 'Where next?', exact: true });
  await expect(map).toBeVisible();
  await expect(page.locator('#main')).toBeHidden();
  await expect(map.locator('a[aria-current="page"]')).toHaveAttribute('href', '/champions');
  const preview = map.locator('.navigator-focus');
  if (!isMobile) await expect(preview).toBeVisible();
  const title = preview.locator('[data-world-title]');
  const notebook = map.locator('.journey-map-footer a[href="/notebook"]');
  const patches = map.locator('[data-world-link="patches"]');
  await patches.focus();
  await expect(map.locator('[data-navigator]')).toHaveAttribute('data-selected', 'patches');
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-preview', 'patches');
  await expect(title).not.toBeEmpty();
  await notebook.focus();
  await expect(notebook).toBeFocused();
  await expect(notebook).toHaveAttribute('href', '/notebook');
  await expect(map.locator('a[aria-current="page"]')).toHaveAttribute('href', '/champions');
  await notebook.press('Enter');
  await expect(page).toHaveURL(/\/notebook\/?$/);
  await ready(page);
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'notebook');
  await expect(page.locator('#main')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === '/champions' && url.searchParams.get('q') === 'Ahri' && url.searchParams.get('role') === 'mid');
  await ready(page);
  await expect(map).not.toBeVisible();
  await expect(page.locator('#main')).toBeVisible();
  await expect(page.locator('[data-rift-scene]')).not.toHaveAttribute('data-rift-preview', 'patches');
  await expect(page.getByRole('searchbox', { name: 'Find a champion', exact: true })).toHaveValue('Ahri');
  await expect(page.locator('[data-roster-count]')).toHaveText('1');
  await open.click();
  await expect(page.locator('#main')).toBeHidden();
  await expect(map.locator('a[aria-current="page"]')).toHaveAttribute('href', '/champions');
  await page.keyboard.press('Escape');
  await expect(map).not.toBeVisible();
  await expect(page.locator('#main')).toBeVisible();
  await expect(open).toBeFocused();
  await expect(page.locator('[data-rift-scene]')).not.toHaveAttribute('data-rift-preview', 'patches');
});

test('reader spotlights follow the chosen champion and exact archived patch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/champions');
  await ready(page);
  const lenses = page.locator('[data-reader-champion-lens]');
  await expect(lenses).toHaveCount(1);
  for (const lens of await lenses.all()) await expect(lens).toHaveAttribute('data-reader-ready', 'true');
  const search = page.getByRole('searchbox', { name: 'Find a champion', exact: true });
  // Consecutive exact searches must update lenses after the roster reveals the
  // new result, including a champion hidden by the previous search.
  for (const [query, key, name] of [
    ['nunu & willump', 'Nunu', 'Nunu & Willump'],
    ['Ahri', 'Ahri', 'Ahri'],
    ['Nunu', 'Nunu', 'Nunu & Willump'],
  ] as const) {
    await search.fill(query);
    const result = page.locator('[data-roster-row]:not([hidden])');
    await expect(result).toHaveCount(1);
    await expect(result).toHaveAttribute('data-roster-key', key);
    for (const lens of await lenses.all()) {
      await expect(lens).toHaveAttribute('data-reader-key', key);
      await expect(lens.locator('[data-reader-champion-name]')).toHaveText(name);
      await expect(lens.locator('[data-reader-champion-art]')).toHaveAttribute('src', new RegExp(`/${key}_0\\.jpg$`));
      await localDestination(lens.locator('[data-reader-champion-link]'), `/champion/${key.toLowerCase()}`);
    }
  }

  await search.clear();
  const ahri = page.locator('[data-roster-key="Ahri"] > a');
  await ahri.focus();
  await expect(ahri).toBeFocused();
  for (const lens of await lenses.all()) {
    await expect(lens).toHaveAttribute('data-reader-key', 'Ahri');
    await expect(lens.locator('[data-reader-champion-name]')).toHaveText('Ahri');
    await expect(lens.locator('[data-reader-champion-art]')).toHaveAttribute('src', /\/Ahri_0\.jpg$/);
    await localDestination(lens.locator('[data-reader-champion-link]'), '/champion/ahri');
  }
  await expect(page.locator('[data-reader-champion-lens="arrival"] [data-reader-champion-link]')).toBeInViewport({ ratio: 1 });

  await page.goto('/patches');
  await ready(page);
  const instrument = page.locator('[data-archive-instrument]');
  await expect(instrument).toHaveAttribute('data-reader-ready', 'true');
  // A stationary pointer in the list column must not take over the preview
  // when keyboard focus scrolls a different patch into view beneath it.
  const list = (await page.locator('.patch-chronology').boundingBox())!;
  await page.mouse.move(list.x + list.width / 2, page.viewportSize()!.height - 100);
  for (const patchId of ['26.16', '26.15']) {
    const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
    const entry = page.locator(`[data-reader-patch-key="${patchId}"] > a`);
    await entry.focus();
    // Scroll-triggered boundary events arrive at the next rendering update.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(entry).toBeFocused();
    await expect(instrument).toHaveAttribute('data-reader-key', patch.id);
    await expect(instrument.locator('[data-archive-focus-id]')).toHaveText(patch.id);
    await expect(instrument.locator('[data-archive-focus-date]')).toHaveAttribute('datetime', patch.releaseDate);
    for (const category of ['champions', 'items', 'systems'] as const) {
      await expect(instrument.locator(`[data-archive-count="${category}"]`)).toHaveText(String(patch[category].length));
    }
    await localDestination(instrument.locator('[data-archive-focus-link]'), `/patch/${patch.id}`);
    if (patchId === '26.16') {
      // Real pointer movement can intentionally change the preview even while
      // keyboard focus remains on the prior entry.
      await page.locator('[data-reader-patch-key="26.14"] > a').hover();
      await expect(instrument).toHaveAttribute('data-reader-key', '26.14');
      await expect(entry).toBeFocused();
    }
  }
  await instrument.locator('[data-archive-focus-link]').click();
  await expect(page).toHaveURL(/\/patch\/26\.15\/?$/);
  await expect(page.locator('main h1')).toContainText('Patch 26.15');
});
