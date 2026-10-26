import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("record two branches, actual alternative records, return, and real collection", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Single full-motion desktop evidence capture.",
  );
  const root = "/tmp/agent-browser/incision-final-v4";
  await mkdir(root, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
    recordVideo: { dir: root, size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  const video = page.video()!;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const data = {
      lcp: 0,
      cls: 0,
      longTasks: 0,
      maxEventDuration: 0,
      frames: [] as number[],
    };
    (window as any).evidenceMetrics = data;
    new PerformanceObserver((list) =>
      list.getEntries().forEach((entry) => (data.lcp = entry.startTime)),
    ).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) =>
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) data.cls += entry.value;
      }),
    ).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver(
      (list) => (data.longTasks += list.getEntries().length),
    ).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) =>
      list
        .getEntries()
        .forEach(
          (entry) =>
            (data.maxEventDuration = Math.max(
              data.maxEventDuration,
              entry.duration,
            )),
        ),
    ).observe({ type: "event", buffered: true, durationThreshold: 16 } as any);
    let previous = performance.now();
    function frame(now: number) {
      data.frames.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await page.goto("/");
  await expect(
    page.locator("astro-island:has(.incision-experience)"),
  ).not.toHaveAttribute("ssr", "");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".actor-silhouette img")).every(
      (el) => (el as HTMLImageElement).complete,
    ),
  );
  await page.screenshot({ path: `${root}/overview.png` });
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Azir/ })
    .click();
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${root}/reveal-start.png` });
  await page.getByRole("button", { name: "Reveal this change" }).click();
  await page.waitForTimeout(240);
  await page.screenshot({ path: `${root}/reveal-middle.png` });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${root}/reveal-end.png` });
  await expect(page.locator(".record-values")).toContainText(
    "75 / 95 / 115 / 135 / 155",
  );
  await page.getByRole("button", { name: "Add to My Pool" }).click();
  await expect(page.locator(".collection-rail .saved-identity")).toContainText(
    "Azir",
  );
  await expect(
    page
      .locator(".champion-branches")
      .getByRole("button", { name: /Explore Camille/ }),
  ).toBeInViewport();
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Camille/ })
    .click();
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${root}/camille-encounter.png` });
  await page.getByRole("button", { name: "Reveal this change" }).click();
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${root}/camille-record.png` });
  await expect(page.locator('[data-change="W-1"]')).toBeInViewport();
  await page.locator('[data-change="W-1"]').click();
  await page.waitForTimeout(850);
  await expect(page.locator(".record-difference")).toContainText(
    "+1 percentage point",
  );
  await page.screenshot({ path: `${root}/camille-alternative.png` });
  await page.getByRole("button", { name: "Add to My Pool" }).click();
  await page.getByRole("button", { name: "Other changes" }).click();
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Back to patch" }).click();
  await page.waitForTimeout(850);
  await page
    .locator(".incision-header nav")
    .getByRole("button", { name: /My Pool/ })
    .click();
  await page.waitForTimeout(650);
  await expect(page.locator(".pool-identities li")).toHaveCount(2);
  await page.screenshot({ path: `${root}/pool.png` });
  await page.getByRole("button", { name: "Remove Azir from My Pool" }).click();
  await expect(page.locator(".pool-identities li")).toHaveCount(1);
  const metrics = await page.evaluate(() => {
    const m = (window as any).evidenceMetrics;
    const frames = m.frames.slice(5).sort((a: number, b: number) => a - b);
    return {
      ...m,
      frames: undefined,
      frameP95: frames[Math.floor(frames.length * 0.95)],
      ttfb: (
        performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming
      ).responseStart,
    };
  });
  await page.reload();
  await expect(page.locator(".pool-identities li")).toHaveCount(1);
  expect(errors).toEqual([]);
  await context.close();
  await video.saveAs(`${root}/walkthrough.webm`);
  await writeFile(
    `${root}/metrics.json`,
    JSON.stringify(
      {
        mode: "Production build; GSAP-driven CSS 2.5D layers; full motion",
        viewport: "1440x1000 Chromium",
        metrics,
        errors,
      },
      null,
      2,
    ),
  );
});
test("portrait touch, reduced motion and missing artwork retain useful branches", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Explicit Chromium touch context.",
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.locator("astro-island:has(.incision-experience)"),
  ).not.toHaveAttribute("ssr", "");
  await page.screenshot({
    path: "/tmp/agent-browser/incision-final-v4/portrait-overview.png",
    fullPage: true,
  });
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Camille/ })
    .tap();
  await page.getByRole("button", { name: "Reveal this change" }).tap();
  await expect(page.locator(".record-values")).toContainText(
    "12 / 11.5 / 11 / 10.5 / 10s",
  );
  await page.waitForTimeout(850);
  await page.screenshot({
    path: "/tmp/agent-browser/incision-final-v4/portrait-record.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-change="passive-0"]').tap();
  await expect(page.locator(".record-difference")).toContainText(
    "levels 1 / 7 / 13 / 19",
  );
  expect(
    await page
      .locator(".incision-record")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.screenshot({
    path: "/tmp/agent-browser/incision-final-v4/portrait-reduced.png",
    fullPage: true,
  });
  await page.route("**/*-figure.webp", (route) => route.abort());
  await page.reload();
  await expect(
    page.locator("astro-island:has(.incision-experience)"),
  ).not.toHaveAttribute("ssr", "");
  await expect(
    page.locator(".actor-silhouette img[data-fallback]"),
  ).toHaveCount(2);
  await expect(page.locator(".record-values")).toBeVisible();
  await context.close();
});
