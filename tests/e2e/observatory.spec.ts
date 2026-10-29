import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';

async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Rift is shifting.');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-cinema-ready', 'true');
  await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

async function clearPageChrome(page: Page, target: Locator) {
  for (let pass = 0; pass < 2; pass++) {
    await target.evaluate(element => {
      const bottom = Math.max(0, ...Array.from(document.querySelectorAll('.world-controls, .cinema-chapter-bar'))
        .map(node => node.getBoundingClientRect())
        .filter(rect => rect.top < innerHeight && rect.bottom > 0)
        .map(rect => rect.bottom));
      scrollTo({ top: scrollY + element.getBoundingClientRect().top - bottom - 28, behavior: 'instant' });
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
}

test('champion selection connects the artwork, exact source record and archive destination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await ready(page);
  const signals = page.locator('[data-home-signals]');
  const tabs = signals.getByRole('tab');
  const follow = page.locator('[data-signal-follow]');
  let finalChampion = '';
  let finalName = '';

  await clearPageChrome(page, tabs.first());
  for (const tab of await tabs.all()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = signals.getByRole('tabpanel');
    const championId = (await panel.getAttribute('data-champion'))!;
    const patchId = (await panel.getAttribute('data-patch'))!;
    const name = (await panel.locator('h3').innerText()).trim();
    const figure = page.locator('[data-signal-art]:not([hidden])');
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute('data-signal-art', championId);
    await expect(figure.locator('figcaption strong')).toHaveText(name);
    await expect(figure.locator('img')).toHaveAttribute('alt', `${name} — official Riot Games artwork`);
    await expect(follow).toContainText(`Follow ${name} through the archive`);
    const destination = new URL((await follow.getAttribute('href'))!, page.url());
    expect(destination.pathname).toBe('/explore');
    expect(destination.searchParams.get('champion')).toBe(championId);
    expect(destination.hash).toBe('#change');

    // The visual choice may change the framing, never the recorded values.
    const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
    const before = (await panel.locator('[data-signal-before]').innerText()).trim();
    const after = (await panel.locator('[data-signal-after]').innerText()).trim();
    const label = (await panel.locator('.home-signal-label').innerText()).trim();
    const original = patch.champions.find(champion => champion.championId === championId)?.abilities
      .flatMap(ability => ability.changes).find(change => change.kind === 'numeric' &&
        change.label === label && change.before === before && change.after === after);
    expect(original, `${championId} must retain its actual ${patchId} before/after record`).toBeDefined();
    await expect(panel.getByRole('link', { name: 'Riot’s notes', exact: true })).toHaveAttribute('href', patch.sourceUrl);
    finalChampion = championId;
    finalName = name;
  }

  await clearPageChrome(page, follow);
  await follow.click();
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('champion') === finalChampion && url.hash === '#change');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  await expect(page.locator('[data-record-champion]')).toHaveText(finalName);
});

for (const preference of ['device', 'saved'] as const) {
  test(`${preference} reduced motion keeps the scene still and selection usable`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference === 'device' ? 'reduce' : 'no-preference' });
    if (preference === 'saved') await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
    await page.goto('/');
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    const field = page.locator('[data-rift-scene]');
    await expect(field).toHaveAttribute('data-rift-renderer', 'static');
    await expect(field).toHaveAttribute('data-rift-motion', 'still');
    await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
    await expect(page.locator('[data-rift-scene-static]')).toBeVisible();

    const tabs = page.locator('[data-home-signals]').getByRole('tab');
    await clearPageChrome(page, tabs.first());
    for (const tab of await tabs.all()) {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      const champion = await page.locator('[data-home-signals]').getByRole('tabpanel').getAttribute('data-champion');
      await expect(page.locator('[data-signal-art]:not([hidden])')).toHaveAttribute('data-signal-art', champion!);
      expect(await page.locator('[data-signal-aperture]').evaluate(element => element.getAnimations({ subtree: true })
        .filter(animation => animation.playState === 'running').length)).toBe(0);
    }
  });
}

test('without WebGL the real environment and both product entry actions remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
        return Reflect.apply(original, this, [kind, ...args]);
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-renderer', 'static');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  await expect(page.locator('[data-rift-scene-static]')).toBeVisible();
  await expect(page.locator('.rift-perspective-hint')).toBeHidden();
  const environment = page.locator('.rift-scene__landscape img');
  await expect(environment).toBeVisible();
  await expect.poll(() => environment.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  for (const [name, href] of [['Get my briefing', '/next-game'], ['Find my games', '/players']] as const) {
    const link = page.locator('[data-home-launcher]').getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toBeInViewport({ ratio: 1 });
    expect(await link.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    })).toBe(true);
  }
  await page.getByRole('link', { name: 'Follow the signal', exact: true }).click();
  await expect(page).toHaveURL(/#home-signal$/);
  await expect(page.locator('#signal-heading')).toBeFocused();
  expect(errors).toEqual([]);
});

test.describe('the observatory before JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('static artwork, product actions and the first record are usable immediately', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Rift is shifting.');
    await expect(page.locator('[data-rift-scene-static]')).toBeVisible();
    const environment = page.locator('.rift-scene__landscape img');
    await expect(environment).toBeVisible();
    await expect.poll(() => environment.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('[data-home-launcher]').getByRole('link', { name: 'Get my briefing', exact: true })).toHaveAttribute('href', '/next-game');
    await expect(page.locator('[data-home-launcher]').getByRole('link', { name: 'Find my games', exact: true })).toHaveAttribute('href', '/players');
    const figure = page.locator('[data-signal-art]:not([hidden])');
    await expect(figure).toHaveCount(1);
    const panel = page.locator('[data-home-signals]').getByRole('tabpanel');
    await expect(figure).toHaveAttribute('data-signal-art', (await panel.getAttribute('data-champion'))!);
    const art = figure.locator('img');
    await art.scrollIntoViewIfNeeded();
    await expect.poll(() => art.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(panel.locator('[data-signal-before]')).not.toBeEmpty();
    await expect(panel.locator('[data-signal-after]')).not.toBeEmpty();
    await expect(panel.getByRole('link', { name: 'Read the full record', exact: true })).toHaveAttribute('href', /^\/patch\/\d+\.\d+#[a-z0-9]+$/);
    for (const tab of await page.locator('[data-home-signals]').getByRole('tab').all()) await expect(tab).toBeDisabled();
    for (const button of await page.locator('[data-cinema-audio]').all()) await expect(button).toBeHidden();
    const destination = new URL((await page.locator('[data-signal-follow]').getAttribute('href'))!, page.url());
    expect(destination.pathname).toBe('/explore');
    expect(destination.searchParams.get('champion')).toBe(await panel.getAttribute('data-champion'));
  });
});

test('ambient sound requires opt-in, synchronizes its controls and becomes quiet on departure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    Object.defineProperty(window, '__observatoryAudioContexts', { value: contexts });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext;
        contexts.push(context);
        return context;
      },
    });
  });
  await page.goto('/');
  await ready(page);
  const controls = page.locator('[data-cinema-audio]');
  await expect(controls).toHaveCount(2);
  const audioStates = () => page.evaluate(() => (window as unknown as { __observatoryAudioContexts: AudioContext[] })
    .__observatoryAudioContexts.map(context => context.state));
  expect(await audioStates()).toEqual([]);
  for (const control of await controls.all()) {
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    await expect(control).toHaveAccessibleName('Sound off — enable ambient sound');
  }

  await controls.first().click();
  await expect.poll(audioStates).toEqual(['running']);
  for (const control of await controls.all()) {
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(control).toHaveAccessibleName('Sound on — mute ambient sound');
  }
  await controls.last().click();
  await expect.poll(audioStates).toEqual(['suspended']);
  for (const control of await controls.all()) await expect(control).toHaveAttribute('aria-pressed', 'false');
  await controls.last().click();
  await expect.poll(audioStates).toEqual(['running']);

  // BFCache freezes rather than unloads the document. Exercise that lifecycle
  // explicitly so both reload and native Back remain quiet until another opt-in.
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect.poll(audioStates).toEqual(['suspended']);
  for (const control of await controls.all()) await expect(control).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  expect(await audioStates()).toEqual(['suspended']);
  for (const control of await controls.all()) await expect(control).toHaveAccessibleName('Sound off — enable ambient sound');
});
