import { it, expect } from "vitest";
import { parseValueSeries, relativeDelta, formatDelta } from "../../src/lib/deltas";

it("parses rank series", () =>
  expect(parseValueSeries("60 / 80 / 100 / 120 / 140")).toEqual([60, 80, 100, 120, 140]));
it("parses single percent", () => expect(parseValueSeries("45%")).toEqual([45]));
it("parses seconds", () => expect(parseValueSeries("12s")).toEqual([12]));
it("ignores parenthesized ratios", () =>
  expect(parseValueSeries("75 / 95 / 115 (+35/40/45% AP)")).toEqual([75, 95, 115]));
it("parses decimals", () => expect(parseValueSeries("0.5 / 0.75")).toEqual([0.5, 0.75]));
it("parses negative values", () => expect(parseValueSeries("-10")).toEqual([-10]));
it("returns [] for prose", () => expect(parseValueSeries("Removed")).toEqual([]));

it("computes relative delta on first rank", () =>
  expect(relativeDelta("45%", "40%")).toBeCloseTo(-0.1111, 3));
it("computes positive relative delta", () =>
  expect(relativeDelta("80", "90")).toBeCloseTo(0.125, 4));
it("null on unparseable before", () => expect(relativeDelta("Removed", "40%")).toBeNull());
it("null on unparseable after", () => expect(relativeDelta("40%", "Removed")).toBeNull());
it("null on zero base", () => expect(relativeDelta("0", "10")).toBeNull());

it("formats with typographic minus", () => expect(formatDelta(-0.1111)).toBe("−11.1%"));
it("formats positive with sign", () => expect(formatDelta(0.125)).toBe("+12.5%"));
it("trims trailing zero decimals", () => expect(formatDelta(0.25)).toBe("+25%"));
it("formats null as null", () => expect(formatDelta(null)).toBeNull());
it("suppresses zero deltas (rank-1 unchanged is not '+0%')", () =>
  expect(formatDelta(0)).toBeNull());
