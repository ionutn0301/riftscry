import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { readyJourney, openScene, unobstructed } from './journey-test-helpers';
import { cinema, cinemaSignals, chooseSignal, closeEvidence, evidence, inspectCinema, openCinemaNavigation, readyCinema, selectedSignal, cinemaFitsViewport } from './cinema-test-helpers';

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

for (const preference of ['device', 'saved'] as const) test(`${preference} reduced motion keeps the world and exact inspection usable`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: preference === 'device' ? 'reduce' : 'no-preference' });
  if (preference === 'saved') await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
  await page.goto('/'); await readyCinema(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'reduced');
  const signal = (await cinemaSignals(page))[1]!;
  await chooseSignal(page, signal); await inspectCinema(page);
  await expect(evidence(page).locator('[data-home-record]:not([hidden]) .before')).toHaveText(signal.before);
  await expect(evidence(page).locator('[data-home-record]:not([hidden]) .after')).toHaveText(signal.after);
  await closeEvidence(page);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signal.championId);
  await expect.poll(() => cinema(page).evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await cinemaFitsViewport(page);
});

test('without WebGL the world poster, personal entry and exact archive destination remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: function(this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } });
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readyCinema(page);
  await expect(cinema(page)).toHaveAttribute('data-renderer', 'fallback');
  const poster = page.locator('[data-cinema-poster]');
  await expect(poster).toBeVisible();
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const personal = page.locator('[data-home-personal]').first();
  await expect(personal).toHaveJSProperty('href', new URL('/next-game', page.url()).href); await unobstructed(personal);
  const menu = await openCinemaNavigation(page);
  const games = menu.locator('[data-station-link="players"]');
  await expect(games).toHaveJSProperty('href', new URL('/players', page.url()).href); await unobstructed(games);
  await page.keyboard.press('Escape');
  const signal = await selectedSignal(page); await inspectCinema(page);
  await evidence(page).locator('[data-home-explore]').click(); await readyJourney(page);
  // Explore canonicalizes its interval while retaining the exact selected
  // champion and event supplied by the native homepage link.
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('champion') === signal.championId && url.searchParams.get('event') === signal.record.id);
  await expect(page.locator('[data-record-before]')).toHaveText(signal.before);
  await expect(page.locator('[data-record-after]')).toHaveText(signal.after);
  await expect(page.locator('[data-current-record]')).toBeVisible(); expect(errors).toEqual([]);
});

test.describe('the world before JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('official artwork and genuine archive and briefing destinations are available immediately', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-cinema-poster]')).toBeVisible();
    const image = page.locator('[data-cinema-poster]');
    await expect.poll(() => image.evaluate((poster: HTMLImageElement) => poster.complete && poster.naturalWidth > 0)).toBe(true);
    const signals = await cinemaSignals(page);
    for (const signal of signals) await expect(page.locator(`[data-home-choice="${signal.championId}"]`)).toHaveAttribute('href', signal.explore);
    await expect(page.locator('[data-home-personal]').first()).toHaveAttribute('href', '/next-game');
    await expect(page.locator('[data-home-keep]')).toBeHidden();
    const signal = signals[0]!;
    await expect(page.locator('[data-cinema-inspect]').first()).toHaveAttribute('href', signal.explore);
    await page.locator('[data-cinema-inspect]').first().click();
    await expect(page).toHaveURL(new URL(signal.explore, page.url()).href);
    await expect(page.locator('[data-record-before]')).not.toBeEmpty();
    await expect(page.locator('[data-record-after]')).not.toBeEmpty();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', /^https:\/\//);
  });
});

test('entering, selecting and restoring the world never creates unsolicited audio', async ({ page }) => {
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
  await page.goto('/'); await readyCinema(page);
  const audio = () => page.evaluate(() => {
    const audit = (window as unknown as { __signalAudio: { contexts: AudioContext[]; mediaPlays: number } }).__signalAudio;
    return { states: audit.contexts.map(context => context.state), mediaPlays: audit.mediaPlays };
  });
  expect(await audio()).toEqual({ states: [], mediaPlays: 0 });
  await chooseSignal(page, (await cinemaSignals(page))[1]!); await inspectCinema(page); await closeEvidence(page);
  await openCinemaNavigation(page); await page.keyboard.press('Escape');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('audio[autoplay], video[autoplay]')).toHaveCount(0);
  expect(await audio()).toEqual({ states: [], mediaPlays: 0 });
});
