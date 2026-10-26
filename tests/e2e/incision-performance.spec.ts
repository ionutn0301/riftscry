import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("measure production reveal without video or screenshots", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Isolated measurements use Chromium.",
  );
  const results = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const metrics = {
        lcp: 0,
        cls: 0,
        maxEventDuration: 0,
        frames: [] as number[],
        shifts: [] as unknown[],
      };
      (window as any).lab = metrics;
      new PerformanceObserver((list) =>
        list.getEntries().forEach((entry) => (metrics.lcp = entry.startTime)),
      ).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) =>
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            metrics.cls += entry.value;
            metrics.shifts.push({
              value: entry.value,
              sources: entry.sources?.map((s: any) => s.node?.className),
            });
          }
        }),
      ).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) =>
        list
          .getEntries()
          .forEach(
            (entry) =>
              (metrics.maxEventDuration = Math.max(
                metrics.maxEventDuration,
                entry.duration,
              )),
          ),
      ).observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as any);
    });
    await page.goto("/");
    await expect(
      page.locator("astro-island:has(.incision-experience)"),
    ).not.toHaveAttribute("ssr", "");
    await page
      .locator(".champion-branches")
      .getByRole("button", { name: /Explore Azir/ })
      .click();
    await page.waitForTimeout(700);
    await page
      .getByRole("button", { name: "Reveal this change" })
      .scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      let last = performance.now();
      const end = last + 1000;
      function frame(now: number) {
        (window as any).lab.frames.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    await page.getByRole("button", { name: "Reveal this change" }).click();
    await page.waitForTimeout(1100);
    results.push({
      viewport,
      metrics: await page.evaluate(() => {
        const m = (window as any).lab;
        const sorted = m.frames.sort((a: number, b: number) => a - b);
        return {
          ...m,
          frames: undefined,
          frameP95: sorted[Math.floor(sorted.length * 0.95)],
          ttfb: (
            performance.getEntriesByType(
              "navigation",
            )[0] as PerformanceNavigationTiming
          ).responseStart,
        };
      }),
    });
    await context.close();
  }
  await mkdir("/tmp/agent-browser/incision-v4", { recursive: true });
  await writeFile(
    "/tmp/agent-browser/incision-v4/performance.json",
    JSON.stringify(
      {
        mode: "Production Chromium, no video/screenshot capture, unthrottled VM; lab measurements, not field INP",
        results,
      },
      null,
      2,
    ),
  );
});
