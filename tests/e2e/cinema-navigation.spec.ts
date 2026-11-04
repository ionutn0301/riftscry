import { test, expect, type Page } from '@playwright/test';
import { cinema, cinemaSignals, chooseSignal, cinemaFitsViewport, openCinemaNavigation, readyCinema } from './cinema-test-helpers';
import { wheelAt } from './gesture-test-helpers';

const menu = (page: Page) => page.locator('[data-cinema-menu]');
const opener = (page: Page) => page.getByRole('button', { name: 'Open navigation menu', exact: true });
const close = (page: Page) => page.getByRole('button', { name: 'Close navigation', exact: true });

test.use({ contextOptions: { reducedMotion: 'reduce' } });

for (const [width, height] of [[320, 480], [390, 844], [480, 320], [568, 320], [844, 390]] as const) {
  test(`cinema navigation fits one screen and every action is reachable at ${width}×${height}`, async ({ page, isMobile, browserName }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/'); await readyCinema(page);
    const dialog = await openCinemaNavigation(page);
    const destinations = dialog.getByRole('navigation', { name: 'RiftScry destinations', exact: true });
    for (const href of ['/', '/next-game', '/champions', '/players', '/pool#findings']) {
      await expect(destinations.locator(`a[href="${href}"]`)).toBeVisible();
    }
    const actions = dialog.locator('a[href]:visible, button:visible, label:has(input):visible');
    const targets = await actions.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        name: element.getAttribute('aria-label') || element.textContent?.trim(),
        x: box.x, y: box.y, width: box.width, height: box.height,
        hit: hit === element || Boolean(hit && element.contains(hit)),
      };
    }));
    expect(targets.length).toBeGreaterThanOrEqual(8);
    for (const target of targets) {
      expect(target.width, `${target.name}: touch width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${target.name}: touch height`).toBeGreaterThanOrEqual(44);
      expect(target.x, target.name).toBeGreaterThanOrEqual(-1);
      expect(target.y, target.name).toBeGreaterThanOrEqual(-1);
      expect(target.x + target.width, target.name).toBeLessThanOrEqual(width + 1);
      expect(target.y + target.height, target.name).toBeLessThanOrEqual(height + 1);
      expect(target.hit, `${target.name}: centre must hit the action`).toBe(true);
    }
    // Trial taps use the browser's real actionability checks without following
    // every destination; bounds above are checked before Playwright can scroll.
    for (const action of await actions.all()) {
      if (isMobile) await action.tap({ trial: true });
      else await action.click({ trial: true });
    }
    for (const input of await dialog.locator('input:visible').all()) await expect(input).toBeEnabled();
    await wheelAt(page, { x: width / 2, y: height / 2 }, 650, isMobile && browserName === 'webkit');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const scrolling = await dialog.evaluate(element => ({
      top: element.scrollTop, left: element.scrollLeft,
      overflowY: element.scrollHeight - element.clientHeight,
      overflowX: element.scrollWidth - element.clientWidth,
      nested: [...element.querySelectorAll<HTMLElement>('*')].filter(child => {
        const style = getComputedStyle(child);
        return /(auto|scroll)/.test(style.overflowY) && child.scrollHeight > child.clientHeight + 1
          || /(auto|scroll)/.test(style.overflowX) && child.scrollWidth > child.clientWidth + 1;
      }).length,
    }));
    expect(scrolling.top).toBe(0); expect(scrolling.left).toBe(0);
    expect(scrolling.overflowY).toBeLessThanOrEqual(1); expect(scrolling.overflowX).toBeLessThanOrEqual(1);
    expect(scrolling.nested).toBe(0);
    await cinemaFitsViewport(page);
    await page.screenshot({ path: info.outputPath(`menu-${width}x${height}.png`) });
    await close(page).click();
    await expect(dialog).toBeHidden(); await expect(opener(page)).toBeFocused();
  });
}

type MenuFrame = { state: string; open: boolean; paint: string };

// Inspect the real CSS animation at known timeline positions, then let it run
// normally to verify modal lifetime and completion. Software WebKit can miss
// every rAF during the 380ms exit; that is not evidence of unchanged keyframes.
async function traceMenu(page: Page, trigger: string, endState: 'open' | 'closed'): Promise<MenuFrame[]> {
  return page.evaluate(async ({ trigger, endState }) => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
    const body = dialog.querySelector<HTMLElement>('.cinema-navigation-body') ?? dialog;
    const frames: { state: string; open: boolean; paint: string }[] = [];
    const sample = () => {
      const style = getComputedStyle(dialog), content = getComputedStyle(body);
      frames.push({
        state: dialog.dataset.menuState ?? '', open: dialog.open,
        paint: [style.opacity, style.transform, style.clipPath, content.opacity, content.transform, content.clipPath].join('|'),
      });
    };
    document.querySelector<HTMLButtonElement>(trigger)!.click();
    sample();
    const name = endState === 'open' ? 'cinema-menu-enter' : 'cinema-menu-exit';
    const animation = dialog.getAnimations().find(candidate =>
      candidate instanceof CSSAnimation && candidate.animationName === name);
    const duration = animation?.effect?.getTiming().duration;
    if (!animation || typeof duration !== 'number' || duration <= 0) {
      throw new Error(`Missing navigation animation: ${name}`);
    }
    animation.pause();
    for (const progress of [.25, .75]) {
      animation.currentTime = duration * progress;
      sample();
    }
    animation.currentTime = 0;
    animation.play();
    const start = performance.now();
    return new Promise<typeof frames>(resolve => {
      const next = () => {
        sample();
        if (dialog.dataset.menuState === endState || performance.now() - start > 4000) resolve(frames);
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
  }, { trigger, endState });
}

test('navigation visibly enters and exits, retains its modal through exit, and survives a quick reopen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await readyCinema(page);
  await opener(page).focus();
  const entering = await traceMenu(page, '[data-cinema-menu-open]', 'open');
  expect(entering[0]).toMatchObject({ state: 'opening', open: true });
  expect(entering.at(-1)).toMatchObject({ state: 'open', open: true });
  expect(new Set(entering.filter(frame => frame.state === 'opening').map(frame => frame.paint)).size,
    'Opening must visibly progress, rather than only delay an unchanged dialog').toBeGreaterThan(1);
  expect(await menu(page).evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);

  const leaving = await traceMenu(page, '[data-cinema-menu-close]', 'closed');
  expect(leaving[0]).toMatchObject({ state: 'closing', open: true });
  const midClose = leaving.filter(frame => frame.state === 'closing');
  expect(midClose.every(frame => frame.open), 'The native modal must remain open during its visible exit').toBe(true);
  expect(new Set(midClose.map(frame => frame.paint)).size,
    'Closing must visibly progress before dialog.close()').toBeGreaterThan(1);
  expect(leaving.at(-1)).toMatchObject({ state: 'closed', open: false });
  await expect(opener(page)).toBeFocused();

  await opener(page).click(); await expect(menu(page)).toHaveAttribute('data-menu-state', 'open');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden(); await expect(opener(page)).toBeFocused();

  await opener(page).click(); await expect(menu(page)).toHaveAttribute('data-menu-state', 'open');
  const reversed = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
    document.querySelector<HTMLButtonElement>('[data-cinema-menu-close]')!.click();
    const closing = { state: dialog.dataset.menuState, open: dialog.open };
    // The background is intentionally inert while the modal exits. Invoke the
    // same opener to exercise re-entry before a pending close can finish.
    document.querySelector<HTMLButtonElement>('[data-cinema-menu-open]')!.click();
    return { closing, reopened: { state: dialog.dataset.menuState, open: dialog.open } };
  });
  expect(reversed.closing).toEqual({ state: 'closing', open: true });
  expect(reversed.reopened).toEqual({ state: 'opening', open: true });
  await expect(menu(page)).toHaveAttribute('data-menu-state', 'open');
  await expect(menu(page)).toBeVisible();
  await close(page).click(); await expect(menu(page)).toBeHidden();
  await expect(opener(page)).toBeFocused(); await cinemaFitsViewport(page);
});

test('reduced motion opens and closes navigation immediately without an invisible modal', async ({ page }) => {
  await page.goto('/'); await readyCinema(page);
  await opener(page).focus();
  const result = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
    document.querySelector<HTMLButtonElement>('[data-cinema-menu-open]')!.click();
    const opened = { state: dialog.dataset.menuState, open: dialog.open };
    document.querySelector<HTMLButtonElement>('[data-cinema-menu-close]')!.click();
    return { opened, closed: { state: dialog.dataset.menuState, open: dialog.open } };
  });
  expect(result.opened).toEqual({ state: 'open', open: true });
  expect(result.closed).toEqual({ state: 'closed', open: false });
  await expect(opener(page)).toBeFocused();
  await expect(menu(page)).toBeHidden();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');
});

test('menu destinations and search handoff preserve native history and return to the selected world', async ({ page, isMobile }) => {
  // Two native departures and Back restorations include the moving world;
  // software graphics can make these successful browser calls expensive.
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await readyCinema(page);
  const selected = (await cinemaSignals(page))[1]!;
  await chooseSignal(page, selected);
  const homeUrl = page.url();
  const dialog = await openCinemaNavigation(page);
  const atlas = dialog.getByRole('navigation', { name: 'RiftScry destinations', exact: true }).locator('a[href="/champions"]');
  // A desktop modified click must keep its ordinary new-tab behavior and must
  // not start a delayed same-tab departure or dismiss the active menu.
  if (!isMobile) {
    // Native modified-click tabs need not have a window.opener. Observe the
    // context's page event rather than requiring an opener-specific popup.
    // Still assert the exact destination and unchanged original world/menu.
    const opened = page.context().waitForEvent('page');
    await atlas.click({ modifiers: ['ControlOrMeta'] });
    const other = await opened;
    await expect(other).toHaveURL(url => url.pathname === '/champions');
    await other.close();
    await expect(page).toHaveURL(homeUrl);
    await expect(dialog).toHaveAttribute('data-menu-state', 'open');
  }
  const departure = await atlas.evaluate(link => {
    (link as HTMLAnchorElement).click();
    const navigation = document.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
    return { state: navigation.dataset.menuState, open: navigation.open, url: location.href };
  });
  expect(departure).toEqual({ state: 'closing', open: true, url: homeUrl });
  await expect(page).toHaveURL(url => url.pathname === '/champions');
  await expect(page.locator('#main h1')).toBeVisible();
  await page.goBack(); await readyCinema(page);
  await expect(page).toHaveURL(homeUrl);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', selected.championId);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(dialog).toBeHidden(); await expect(menu(page)).toHaveJSProperty('open', false);

  // Wait for the shortcut controller, then hand focus from one modal to the
  // other; the palette must not appear on top of a still-closing menu.
  await expect(page.locator('[data-search-host]')).toHaveAttribute('data-search-ready', 'true');
  await openCinemaNavigation(page);
  const handoff = await dialog.locator('[data-palette-trigger]').evaluate(button => {
    (button as HTMLButtonElement).click();
    const navigation = document.querySelector<HTMLDialogElement>('[data-cinema-menu]')!;
    return {
      state: navigation.dataset.menuState, open: navigation.open,
      searchAlreadyOpen: Boolean(document.querySelector('[cmdk-dialog]')),
    };
  });
  expect(handoff).toEqual({ state: 'closing', open: true, searchAlreadyOpen: false });
  const search = page.locator('[cmdk-input]');
  await expect(search).toBeFocused(); await expect(dialog).toBeHidden();
  await search.fill('Camille');
  const result = page.locator('[cmdk-item]').filter({ has: page.locator('.item-label', { hasText: /^Camille$/ }) });
  await expect(result).toBeVisible(); await result.click();
  await expect(page).toHaveURL(url => url.pathname === '/champion/camille');
  await expect(page.locator('#main h1')).toContainText('Camille');
  await page.goBack(); await readyCinema(page);
  await expect(page).toHaveURL(homeUrl);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', selected.championId);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(dialog).toBeHidden(); await expect(page.locator('[cmdk-dialog]')).toBeHidden();
  await expect(menu(page)).toHaveJSProperty('open', false);
  await opener(page).click({ trial: true });
  await cinemaFitsViewport(page);
});
