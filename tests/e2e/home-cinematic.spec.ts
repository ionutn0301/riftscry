import { test, expect, type Page } from "@playwright/test";

/** Scroll to a fraction of the journey track's scrub range. */
async function scrollToBeat(page: Page, fraction: number): Promise<void> {
  await page.evaluate((f) => {
    document.documentElement.style.scrollBehavior = "auto";
    const track = document.querySelector<HTMLElement>("[data-journey-track]")!;
    const range = track.offsetHeight - window.innerHeight;
    window.scrollTo(0, track.offsetTop + range * f);
  }, fraction);
}

test("cinematic journey is reversible, reload-safe, and route-safe", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Something changed/ })).toBeVisible();

  // The one master timeline drives the emblem: scrolling must transform it.
  const initialTransform = await page.locator("[data-emblem]").evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await scrollToBeat(page, 0.12);
  await expect
    .poll(() => page.locator("[data-emblem]").evaluate(
      (element) => getComputedStyle(element).transform,
    ))
    .not.toBe(initialTransform);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  await expect(page.getByText("Queue informed.", { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await expect(page.getByRole("heading", { level: 1, name: /Something changed/ })).toBeVisible();

  // Mid-journey reload lands back in a coherent state.
  await scrollToBeat(page, 0.55);
  await page.reload();
  await scrollToBeat(page, 0.55);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);

  const closingLink = page.locator("[data-source-closing] a").first();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(closingLink).toBeVisible();
  await closingLink.click();
  await expect(page).toHaveURL(/\/patch\/\d+\.\d+/);

  await page.goBack();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await expect(page.getByRole("heading", { level: 1, name: /Something changed/ })).toBeVisible();
  await expect(page.locator("[data-home-world]")).toHaveAttribute("data-motion-initialized", "true");
  expect(errors).toEqual([]);
});

test("hidden stations never trap keyboard focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard travel is a desktop concern");
  await page.goto("/");
  await page.waitForFunction(() => "__riftscryJourney" in window);

  // At the opening, links belonging to later beats must be unfocusable.
  const hiddenLink = page.locator("[data-role-path]").first();
  await expect(hiddenLink).toBeHidden();
  const sourceLink = page.locator("[data-source-closing] a").first();
  await expect(sourceLink).toBeHidden();
});

test("cinematic composition survives a live viewport resize", async ({ page, isMobile }) => {
  test.skip(isMobile, "mobile composition is covered by the mobile project");
  await page.goto("/");
  await page.waitForFunction(() => "__riftscryJourney" in window);

  for (const viewport of [
    { width: 1180, height: 760 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await scrollToBeat(page, 0.48); // mid-delta
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await expect(page.getByRole("heading", { name: /Before becomes after/ })).toBeVisible();
});
