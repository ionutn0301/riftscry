import { test } from "@playwright/test";
import { resolve } from "node:path";

test.skip(process.env.JOURNEY_REVIEW !== "1", "review captures only");

const OUT = (name: string) =>
  resolve("docs", "screenshots", "review", `${name}.png`);

const settle = async (page: import("@playwright/test").Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((image) =>
        Promise.race([
          image.decode().catch(() => {}),
          new Promise((done) => setTimeout(done, 1500)),
        ]),
      ),
    ),
  );
  await page.waitForTimeout(400);
};

test("mobile journey frames", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  await page.waitForFunction(() => "__riftscryJourney" in window);
  await settle(page);

  const labels = await page.evaluate(
    () =>
      (window as never as { __riftscryJourney: { labels: Record<string, number> } })
        .__riftscryJourney.labels,
  );
  const shots: Array<[string, number]> = [
    ["m-01-opening", 0],
    ["m-02-macro", labels.macro! + (labels.threshold! - labels.macro!) * 0.6],
    ["m-03-crossing", labels.threshold! + (labels.landing! - labels.threshold!) * 0.8],
    ["m-04-signal", labels.signal! + (labels.resolve! - labels.signal!) * 0.55],
    ["m-05-delta", labels.delta! + (labels.rail! - labels.delta!) * 0.3],
    ["m-06-history", labels.history! + (labels.compare! - labels.history!) * 0.7],
    ["m-07-roles", labels.roles! + (labels.source! - labels.roles!) * 0.8],
    ["m-08-return", labels.return! + (labels.rest! - labels.return!) * 0.9],
  ];
  for (const [name, fraction] of shots) {
    await page.evaluate((f) => {
      document.documentElement.style.scrollBehavior = "auto";
      const track = document.querySelector<HTMLElement>("[data-journey-track]")!;
      const range = track.offsetHeight - window.innerHeight;
      window.scrollTo(0, track.offsetTop + range * f);
    }, fraction);
    await page.waitForTimeout(650);
    await page.screenshot({ path: OUT(name), animations: "disabled" });
  }
});

test("desktop pool, history, and roles beats", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop beats");
  await page.goto("/");
  await page.waitForFunction(() => "__riftscryJourney" in window);
  await settle(page);

  const labels = await page.evaluate(
    () =>
      (window as never as { __riftscryJourney: { labels: Record<string, number> } })
        .__riftscryJourney.labels,
  );
  const shots: Array<[string, number]> = [
    ["d-pool", labels.signal! + (labels.resolve! - labels.signal!) * 0.97],
    ["d-history", labels.history! + (labels.compare! - labels.history!) * 0.75],
    ["d-roles", labels.roles! + (labels.source! - labels.roles!) * 0.55],
  ];
  for (const [name, fraction] of shots) {
    await page.evaluate((f) => {
      document.documentElement.style.scrollBehavior = "auto";
      const track = document.querySelector<HTMLElement>("[data-journey-track]")!;
      const range = track.offsetHeight - window.innerHeight;
      window.scrollTo(0, track.offsetTop + range * f);
    }, fraction);
    await page.waitForTimeout(650);
    await page.screenshot({ path: OUT(name), animations: "disabled" });
  }
});

test.describe("reduced motion stills", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("static cut frames", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop static cut");
    await page.goto("/");
    await settle(page);
    const stations = ["hero", "signal", "delta", "history", "source"];
    for (const name of stations) {
      await page.evaluate((station) => {
        document.documentElement.style.scrollBehavior = "auto";
        document
          .querySelector(`[data-station='${station}']`)!
          .scrollIntoView({ block: "start" });
      }, name);
      await page.waitForTimeout(300);
      await page.screenshot({ path: OUT(`rm-${name}`), animations: "disabled" });
    }
  });
});
