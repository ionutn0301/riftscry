import type { Page } from '@playwright/test';

/**
 * Playwright cannot send native mouse-wheel input to an isMobile WebKit context.
 * Exercise the DOM gesture contract there, and native input on other projects.
 * The fallback deliberately does not simulate the browser's default scrolling.
 */
export async function wheelAt(
  page: Page,
  point: { x: number; y: number },
  deltaY: number,
  mobileWebKit: boolean,
): Promise<{ native: boolean; prevented: boolean | null }> {
  if (mobileWebKit) {
    const prevented = await page.evaluate(({ x, y, deltaY }) => {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error(`No wheel target at ${x}, ${y}`);
      const event = new WheelEvent('wheel', {
        deltaY, clientX: x, clientY: y, bubbles: true, cancelable: true,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    }, { ...point, deltaY });
    return { native: false, prevented };
  }
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, deltaY);
  return { native: true, prevented: null };
}
