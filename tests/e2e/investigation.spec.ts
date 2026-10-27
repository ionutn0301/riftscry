import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs/promises";
const output = "/tmp/agent-browser/investigation";
async function setup(name: string, reduced = false) {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4322",
    viewport: { width: 835, height: 833 },
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: { dir: output, size: { width: 835, height: 833 } },
  });
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    finish: async () => {
      const video = page.video();
      await context.close();
      await video?.saveAs(`${output}/${name}.webm`);
      await browser.close();
    },
  };
}
test("Belveth selection, same-field return, consequential choice and ending", async () => {
  test.setTimeout(120000);
  const s = await setup("belveth-story");
  const { page } = s;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/");
    await expect(
      page.locator("astro-island:has(.investigation)"),
    ).not.toHaveAttribute("ssr", "");
    await expect(page.locator(".investigation-world")).toHaveAttribute(
      "data-mode",
      "webgl",
      { timeout: 20000 },
    );
    await page.screenshot({ path: `${output}/opening.png` });
    await page.getByLabel("Search all 173 archived champions").fill("Bel");
    await page.getByRole("button", { name: /Bel'Veth/ }).click();
    await expect(
      page.getByRole("heading", { name: /What happened/ }),
    ).toBeVisible();
    await page.screenshot({ path: `${output}/belveth-subject.png` });
    await page.getByRole("button", { name: "Follow what changed" }).click();
    await expect(page.locator(".evidence-main")).toContainText("105");
    await expect(page.locator(".evidence-main")).toContainText("110");
    await page.getByRole("button", { name: /Follow this stat/ }).click();
    await expect(
      page.getByRole("heading", { name: "Back to the earlier value." }),
    ).toBeVisible();
    await page.screenshot({ path: `${output}/belveth-return.png` });
    await page
      .getByRole("button", { name: "Bring the findings together" })
      .click();
    await expect(page.locator(".findings")).toContainText(
      "not a champion-wide revert",
    );
    await page.screenshot({ path: `${output}/belveth-ending.png` });
    const ending = page.url();
    await page.reload();
    await expect(page.locator(".findings")).toContainText("Health Growth");
    await page.goBack();
    await expect(page.locator(".investigation")).toHaveAttribute(
      "data-beat",
      "evidence",
    );
    await page.getByRole("button", { name: "Inspect R", exact: true }).click();
    await page
      .getByRole("button", { name: "Bring the findings together" })
      .click();
    await expect(page.locator(".findings")).not.toContainText("Health Growth");
    await expect(page.locator(".findings")).toContainText(
      "Passive On-Hit Application",
    );
    await page.goto(ending);
    await page
      .getByRole("button", { name: "Add to My Pool", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove from My Pool", exact: true }),
    ).toBeVisible();
    await page.addStyleTag({
      content:
        ".story-content,.story-header{visibility:hidden}.investigation-world{height:100vh!important}",
    });
    await page.screenshot({ path: `${output}/world-only-ending.png` });
    expect(errors).toEqual([]);
  } finally {
    await s.finish();
  }
});
test("simple, rule, no-record, mobile, fallback and direct links", async () => {
  test.setTimeout(120000);
  const s = await setup("different-stories", true);
  const { page } = s;
  try {
    await page.goto("/?champion=Azir&older=26.15&newer=26.16&beat=subject");
    await page.getByRole("button", { name: "Follow what changed" }).click();
    await expect(page.locator(".evidence-main")).toContainText(
      "75 / 95 / 115 / 135 / 155",
    );
    await page
      .getByRole("button", { name: "Bring the findings together" })
      .click();
    await expect(page.locator(".findings")).toContainText("Damage");
    await page.screenshot({ path: `${output}/azir-ending.png` });
    await page.goto(
      "/?champion=Belveth&older=26.15&newer=26.16&focus=R&beat=evidence",
    );
    await expect(page.locator(".evidence-main")).toContainText(
      "Different ranks moved in different directions",
    );
    await page.getByRole("button", { name: "Inspect the next change" }).click();
    await expect(page.locator(".rule-text")).toContainText("Resource bar");
    await page.screenshot({ path: `${output}/rule.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?champion=Ahri&older=26.15&newer=26.16&beat=subject");
    await page
      .getByRole("button", { name: "Understand this interval" })
      .click();
    await expect(page.locator(".story-ending")).toContainText(
      "No recorded direct changes in this interval",
    );
    await page.screenshot({ path: `${output}/no-record-mobile.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto(
      "/?champion=Belveth&older=26.14&newer=26.16&beat=ending&renderer=fallback",
    );
    await expect(page.locator(".investigation-world")).toHaveAttribute(
      "data-mode",
      "fallback",
    );
    await expect(page.locator(".findings")).toContainText("Health Growth");
    await page.screenshot({ path: `${output}/fallback.png` });
    await page.goto("/?champion=NOTREAL");
    await expect(page.getByRole("alert")).toContainText("no substitute");
  } finally {
    await s.finish();
  }
});
