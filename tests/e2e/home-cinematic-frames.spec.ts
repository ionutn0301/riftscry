import { test } from "@playwright/test";
import { resolve } from "node:path";

test.skip(
  process.env.UPDATE_CINEMATIC_FRAMES !== "1",
  "Set UPDATE_CINEMATIC_FRAMES=1 to regenerate the cinematic review frames.",
);

test("capture the required cinematic states", async ({ page, isMobile }) => {
  test.skip(isMobile, "The acceptance contact sheet is art-directed at 1440x900.");

  await page.goto("/");
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
  await page.waitForFunction(() => Boolean((window as never as Record<string, unknown>).__riftscryJourney));
  await page.waitForTimeout(500);

  // Beat label → scroll fraction, exposed by the master timeline.
  const labels = await page.evaluate(
    () =>
      (window as never as { __riftscryJourney: { labels: Record<string, number> } })
        .__riftscryJourney.labels,
  );
  const between = (a: string, b: string, t: number) =>
    labels[a]! + (labels[b]! - labels[a]!) * t;

  const frames: Array<[string, number]> = [
    ["01-opening", 0],
    ["02-emblem-approach", between("approach", "macro", 0.6)],
    ["03-emblem-macro", between("macro", "threshold", 0.6)],
    ["04-world-through-emblem", between("threshold", "landing", 0.35)],
    ["05-threshold-crossing", between("threshold", "landing", 0.8)],
    ["06-version-archive", between("landing", "signal", 0.6)],
    ["07-environment-to-ui", between("resolve", "delta", 0.75)],
    ["08-before-to-after", between("delta", "rail", 0.3)],
    ["09-timeline-to-source", between("source", "return", 0.5)],
    ["10-brand-reconstruction", between("return", "rest", 0.9)],
  ];

  for (const [name, fraction] of frames) {
    await page.evaluate((f) => {
      document.documentElement.style.scrollBehavior = "auto";
      const track = document.querySelector<HTMLElement>("[data-journey-track]")!;
      const range = track.offsetHeight - window.innerHeight;
      window.scrollTo(0, track.offsetTop + range * f);
    }, fraction);
    await page.waitForTimeout(700);
    await page.screenshot({
      path: resolve("docs", "screenshots", `cinematic-${name}.png`),
      animations: "disabled",
    });
  }
});
