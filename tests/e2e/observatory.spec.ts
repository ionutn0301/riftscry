import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { homeSignals, readySignal, readyJourney, openScene, unobstructed, stationaryWorld } from './journey-test-helpers';

test('champion selection connects artwork, exact source record and native archive destination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore?champion=Azir&older=26.15&newer=26.16#change'); await readyJourney(page);
  for (const [championId, name] of [['Azir', 'Azir'], ['Belveth', "Bel'Veth"]] as const) {
    await page.locator(`.quick-perspectives [data-choose-champion="${championId}"]`).click(); await readyJourney(page);
    await openScene(page, 'change');
    await expect(page.locator('[data-champion-name]')).toHaveText(name);
    await expect(page.locator('[data-champion-splash]')).toHaveAttribute('alt', `${name} — official Riot Games artwork`);
    const patchId = (await page.locator('[data-record-patch]').innerText()).replace('PATCH ', '');
    const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
    const before = await page.locator('[data-record-before]').innerText();
    const after = await page.locator('[data-record-after]').innerText();
    const label = await page.locator('[data-record-label]').innerText();
    expect(patch.champions.find(champion => champion.championId === championId)?.abilities.flatMap(ability => ability.changes)
      .find(change => change.kind === 'numeric' && change.label === label && change.before === before && change.after === after)).toBeDefined();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', patch.sourceUrl);
  }
  await openScene(page, 'history'); await page.locator('[data-champion-link]').click();
  await expect(page).toHaveURL(url => url.pathname === '/champion/belveth');
  await expect(page.locator('h1')).toContainText("Bel'Veth");
});

for (const preference of ['device', 'saved'] as const) test(`${preference} reduced motion keeps the three acts usable and the environment still`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: preference === 'device' ? 'reduce' : 'no-preference' });
  if (preference === 'saved') await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const environment = page.locator('[data-rift-scene]');
  await expect(environment).toHaveAttribute('data-rift-renderer', 'static');
  await expect(environment).toHaveAttribute('data-rift-motion', 'still');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  await expect(page.locator('[data-rift-scene-static]')).toBeVisible();
  const subject = await page.locator('[data-home-signals]').getAttribute('data-home-subject');
  await page.locator('[data-journey-next]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'reveal');
  await expect(page.locator('[data-home-record]:visible .before')).not.toBeEmpty();
  await expect(page.locator('[data-home-record]:visible .after')).not.toBeEmpty();
  await page.locator('[data-journey-next]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'carry');
  await expect(page.locator('[data-journey-next]')).toBeDisabled();
  await page.locator('[data-journey-prev]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'reveal');
  await page.locator('[data-journey-prev]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'signal');
  await expect(page.locator('[data-journey-prev]')).toBeEnabled();
  await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-home-subject', subject!);
  await expect.poll(() => environment.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await expect.poll(() => page.locator('[data-home-signals]').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await stationaryWorld(page);
});

test('without WebGL the environment, personal entry and exact archive journey remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: function(this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } });
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-renderer', 'static');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  const environment = page.locator('.rift-scene__landscape img');
  await expect(environment).toBeVisible();
  await expect.poll(() => environment.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const personal = page.locator('#signal [data-home-personal]');
  await expect(personal).toHaveJSProperty('href', new URL('/next-game', page.url()).href); await unobstructed(personal);
  await page.locator('[data-map-open]').click();
  const games = page.locator('#rift-map-dialog [data-station-link="players"]');
  await expect(games).toHaveJSProperty('href', new URL('/players', page.url()).href); await unobstructed(games);
  await page.locator('[data-map-close]').click();
  await openScene(page, 'carry');
  await page.locator('[data-home-explore]').click(); await readyJourney(page);
  await expect(page.locator('[data-current-record]')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('the signal journey before JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('static atmosphere, native destinations and exact source records are available immediately', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#atlas [data-passage-still]')).toBeVisible();
    const environment = page.locator('.rift-scene__landscape img');
    await expect(environment).toBeVisible();
    await expect.poll(() => environment.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const links = page.locator('.world-nojs-nav a');
    await expect(links).toHaveCount(7);
    for (const link of await links.all()) await expect(link).toHaveAttribute('href', /^\/(next-game|players|champions|patches|pool|notebook|explore)(?:#briefing)?$/);
    await expect(page.locator('[data-home-keep]')).toBeHidden();
    const signal = (await homeSignals(page))[0]!;
    const record = page.locator('[data-home-record]:not([hidden])');
    await page.locator('[data-home-reveal]').click();
    await expect(page).toHaveURL(url => url.hash === '#reveal');
    await expect(record.locator('.before')).toHaveText(signal.before);
    await expect(record.locator('.after')).toHaveText(signal.after);
    await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', signal.sourceUrl);
    await page.locator('[data-home-explore]').click();
    await expect(page.locator('[data-record-before]')).not.toBeEmpty();
    await expect(page.locator('[data-record-after]')).not.toBeEmpty();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', /^https:\/\//);
  });
});

test('entering, choosing and restoring scenes never creates unsolicited audio', async ({ page }) => {
  await page.addInitScript(() => {
    const audit = { contexts: [] as AudioContext[], mediaPlays: 0 };
    Object.defineProperty(window, '__signalAudio', { value: audit });
    const NativeAudioContext = window.AudioContext;
    if (typeof NativeAudioContext === 'function') window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) { const context = Reflect.construct(target, args) as AudioContext; audit.contexts.push(context); return context; },
    });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(this: HTMLMediaElement) { audit.mediaPlays += 1; return Reflect.apply(play, this, []); };
  });
  await page.goto('/'); await readySignal(page);
  const audio = () => page.evaluate(() => {
    const audit = (window as unknown as { __signalAudio: { contexts: AudioContext[]; mediaPlays: number } }).__signalAudio;
    return { states: audit.contexts.map(context => context.state), mediaPlays: audit.mediaPlays };
  });
  expect(await audio()).toEqual({ states: [], mediaPlays: 0 });
  await page.locator('[data-home-choice]').nth(1).click();
  await page.locator('[data-journey-next]').click();
  await page.locator('[data-journey-prev]').click();
  await page.locator('[data-map-open]').click(); await page.locator('[data-map-close]').click();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('audio[autoplay], video[autoplay]')).toHaveCount(0);
  expect(await audio()).toEqual({ states: [], mediaPlays: 0 });
});
