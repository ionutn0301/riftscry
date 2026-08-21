import { parseValueSeries } from "../../src/lib/deltas";
import type { Classification, Direction } from "../../src/lib/schema";

/**
 * Deterministic change classification — the methodology behind every
 * buff/nerf badge on the site. Documented in docs/DATA.md.
 *
 * Each stat label maps to a polarity: does an increase help the champion?
 * Order matters — first match wins, so cost/cooldown-style labels are
 * checked before the generic "good stat" patterns ("Q Cooldown" must hit
 * the cooldown rule, not the generic one).
 */
export const STAT_SEMANTICS: ReadonlyArray<{ pattern: RegExp; increaseIsGood: boolean }> = [
  {
    pattern: /cooldown|recharge|cost|cast time|delay|channel/i,
    increaseIsGood: false,
  },
  {
    pattern:
      /damage|ratio|\bad\b|\bap\b|heal|shield|movement speed|move speed|attack speed|range|duration|slow|stun|charm|root|armor|magic resist|health|\bhp\b|mana(?! cost)|regen|gold|bonus/i,
    increaseIsGood: true,
  },
];

export type DirectionResult = { direction: Direction; known: boolean };

/** Direction of a single before → after change, from the semantics table. */
export function classifyChange(label: string, before: string, after: string): DirectionResult {
  const rule = STAT_SEMANTICS.find((r) => r.pattern.test(label));
  if (!rule) return { direction: "neutral", known: false };

  const b = parseValueSeries(before)[0];
  const a = parseValueSeries(after)[0];
  if (b === undefined || a === undefined || a === b) return { direction: "neutral", known: true };

  const increased = a > b;
  const good = increased === rule.increaseIsGood;
  return { direction: good ? "buff" : "nerf", known: true };
}

/** Champion-level rollup: all buffs → buff, all nerfs → nerf, else adjustment. */
export function rollupChampion(
  directions: Direction[],
): Extract<Classification, "buff" | "nerf" | "adjustment"> {
  const meaningful = directions.filter((d) => d !== "neutral");
  if (meaningful.length > 0 && meaningful.every((d) => d === "buff")) return "buff";
  if (meaningful.length > 0 && meaningful.every((d) => d === "nerf")) return "nerf";
  return "adjustment";
}
