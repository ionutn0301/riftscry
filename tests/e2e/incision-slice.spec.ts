import { test, expect } from "@playwright/test";
test.use({ video: { mode: "on", size: { width: 1440, height: 900 } } });
test("source artwork opens into a readable record and closes to its source", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator("astro-island:has(.incision-experience)"),
  ).not.toHaveAttribute("ssr", "");
  await page.screenshot({ path: "/tmp/agent-browser/v4-slice-overview.png" });
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Azir/ })
    .click();
  await expect(page).toHaveURL(/view=champion/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/agent-browser/v4-slice-encounter.png" });
  await page.getByRole("button", { name: "Reveal this change" }).click();
  await page.waitForTimeout(230);
  await page.screenshot({ path: "/tmp/agent-browser/v4-slice-middle.png" });
  await expect(page.getByText("+15 base damage at every rank.")).toBeVisible();
  await page.waitForTimeout(650);
  await page.screenshot({ path: "/tmp/agent-browser/v4-slice-record.png" });
  await page.getByRole("button", { name: "Other changes" }).click();
  await expect(
    page.getByRole("button", { name: "Reveal this change" }),
  ).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Back to patch" }).click();
  await expect(
    page.getByRole("heading", { name: "Look closer. Know what changed." }),
  ).toBeVisible();
});
