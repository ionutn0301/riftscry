import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePatchHtml } from "../../scripts/patch-ingestion/parse";

const html = readFileSync("tests/fixtures/notes-fragment.html", "utf8");

it("finds champion sections by name", () => {
  const { raw } = parsePatchHtml(html);
  expect(raw.champions.map((c) => c.name)).toEqual(["Azir", "Bel'Veth"]);
});

it("captures the champion summary", () => {
  const { raw } = parsePatchHtml(html);
  expect(raw.champions[0]!.summary).toContain("moderate buff");
});

it("splits arrow lines into before/after", () => {
  const { raw } = parsePatchHtml(html);
  const azirQ = raw.champions
    .find((c) => c.name === "Azir")!
    .blocks.find((b) => /Q -/.test(b.header))!;
  expect(azirQ.lines[0]).toMatchObject({
    label: "Damage",
    before: expect.stringContaining("60 / 80"),
    after: expect.stringContaining("75 / 95"),
  });
});

it("keeps the parenthesized ratios in values", () => {
  const { raw } = parsePatchHtml(html);
  const line = raw.champions[0]!.blocks[0]!.lines[0]!;
  expect(line.before).toContain("(+35 / 40 / 45 / 50 / 55% AP)");
});

it("assigns Base Stats and ability blocks separately", () => {
  const { raw } = parsePatchHtml(html);
  const belveth = raw.champions.find((c) => c.name === "Bel'Veth")!;
  expect(belveth.blocks.map((b) => b.header)).toEqual(["Base Stats", "R - Endless Banquet"]);
});

it("keeps badge lines as prose with a clean label", () => {
  const { raw } = parsePatchHtml(html);
  const r = raw.champions[1]!.blocks[1]!;
  const prose = r.lines.find((l) => l.text);
  expect(prose).toMatchObject({
    label: "True Form Remora Indicator",
    text: expect.stringContaining("Resource bar"),
  });
  expect(prose!.label).not.toMatch(/NEW/);
});

it("parses items and maps runes into systems", () => {
  const { raw } = parsePatchHtml(html);
  expect(raw.items.map((s) => s.name)).toEqual(["Blade of the Ruined King"]);
  expect(raw.systems.map((s) => s.name)).toEqual(["Lethal Tempo"]);
});

it("handles blocks whose lines are not under an ability header", () => {
  const { raw } = parsePatchHtml(html);
  const item = raw.items[0]!;
  expect(item.blocks[0]!.lines[0]).toMatchObject({ label: "Attack Damage", before: "40" });
});

it("skips out-of-scope sections but reports them", () => {
  const { raw, report } = parsePatchHtml(html);
  const all = [...raw.champions, ...raw.items, ...raw.systems].map((s) => s.name);
  expect(all).not.toContain("ARAM Buffs");
  expect(report.skippedSections).toMatchObject({ "patch-aram:-mayhem": 1 });
});

it("reports coverage counts", () => {
  const { report } = parsePatchHtml(html);
  expect(report.championCount).toBe(2);
  expect(report.arrowLines).toBeGreaterThanOrEqual(5);
  expect(report.proseLines).toBe(1);
  expect(report.unparsedBlocks).toEqual([]);
});
