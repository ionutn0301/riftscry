import { test, expect } from "@playwright/test";
test("missing artwork and unsupported view transitions preserve navigation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.route("**/cdn/img/champion/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".champion-art")).toContainText(
    "Artwork unavailable",
  );
  await page.locator(".record-place").first().click();
  await expect(page.locator(".evidence-main")).toBeVisible();
  const direct = page.url();
  await page.goto(direct);
  await expect(page.locator(".evidence-main")).toBeVisible();
  await page.getByRole("button", { name: /Gather your findings/ }).click();
  await expect(page.locator(".findings")).toContainText("105");
});
const ready = async (page: any) => {
  await expect(
    page.locator("astro-island:has(.investigation)"),
  ).not.toHaveAttribute("ssr", "");
};
for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [390, 844],
])
  test(`opening fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    await ready(page);
    await expect(page.locator(".record-place")).toHaveCount(
      height! <= 790 || width! <= 700 ? 4 : 6,
    );
    expect(
      await page.evaluate(() => ({
        x: document.documentElement.scrollWidth <= innerWidth,
        y: document.documentElement.scrollHeight <= innerHeight,
      })),
    ).toEqual({ x: true, y: true });
    await expect(
      page.getByRole("button", { name: /Choose your champion/ }),
    ).toBeInViewport();
    await expect(page.getByLabel("After patch")).toBeInViewport();
    await expect(page.locator(".champion-art img")).toHaveCSS(
      "object-fit",
      "contain",
    );
  });
test("connected and unrelated records accumulate; deep links and history restore", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page
    .getByRole("button", { name: /BASE STATS Health Growth 105/ })
    .click();
  await expect(page.locator(".evidence-main")).toContainText("105");
  await page
    .getByRole("button", { name: "26.16 · Health Growth →", exact: true })
    .click();
  await page
    .getByRole("button", { name: /26.16 · R · True Form Total Attack Speed/ })
    .click();
  await page.getByRole("button", { name: /Gather your findings/ }).click();
  await expect(page.locator(".findings")).toContainText(
    "returned to its earlier",
  );
  await expect(page.locator(".findings")).toContainText(
    "True Form Total Attack Speed",
  );
  const url = page.url();
  await page.reload();
  await expect(page.locator(".findings")).toContainText(
    "True Form Total Attack Speed",
  );
  await page.goBack();
  await expect(page.locator(".evidence-main")).toContainText(
    "True Form Total Attack Speed",
  );
  await expect(page.locator(".evidence-main h2")).toBeFocused();
  await page.goto(url);
  await expect(page.locator(".findings")).toContainText(
    "returned to its earlier",
  );
});
test("picker Escape restores opener; overview and invalid states", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const opener = page.getByRole("button", { name: /Choose your champion/ });
  await opener.click();
  await expect(page.getByLabel(/Search all/)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.goto("/?champion=NotAChampion");
  await expect(
    page.getByRole("heading", { name: "Champion not found" }),
  ).toBeVisible();
  await page.goto("/?champion=Belveth&older=26.16&newer=26.15");
  await expect(
    page.getByRole("heading", { name: "Choose a valid interval" }),
  ).toBeVisible();
  await page.goto("/?champion=Belveth&beat=ending");
  await expect(page.locator(".evidence-scroll")).toContainText(
    "NO VISIT TRAIL",
  );
  await page.goto("/?champion=Ahri&older=26.15&newer=26.16");
  await expect(page.locator(".empty-reading")).toContainText(
    "No direct records",
  );
});
test("reduced motion keeps branches and return available", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".patch-place").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.locator(".record-place").first().click();
  await expect(page.locator(".evidence-main")).toBeVisible();
  await page.getByRole("button", { name: /history/ }).click();
  await expect(page.locator(".record-place[aria-current=true]")).toBeVisible();
});
test("short viewport remains reachable in document flow", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /My Pool/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your champions" }),
  ).toBeVisible();
});
