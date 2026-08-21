/**
 * Numeric utilities for before → after change values.
 *
 * Patch note values arrive as verbatim strings ("60 / 80 / 100 (+40% AP)",
 * "45%", "12s"). We keep the verbatim string for display and derive numbers
 * only for the relative-delta chip, always from the first rank value.
 */

/** Extract the rank-series numbers, ignoring parenthesized ratio groups. */
export function parseValueSeries(text: string): number[] {
  const withoutGroups = text.replace(/\([^)]*\)/g, "");
  const matches = withoutGroups.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number);
}

/** Relative change between the first rank values, or null when undefined. */
export function relativeDelta(before: string, after: string): number | null {
  const b = parseValueSeries(before)[0];
  const a = parseValueSeries(after)[0];
  if (b === undefined || a === undefined || b === 0) return null;
  return (a - b) / Math.abs(b);
}

/**
 * "−11.1%" / "+12.5%" with a typographic minus (U+2212). Zero deltas return
 * null — "+0%" beside a change whose later ranks moved is misleading.
 */
export function formatDelta(x: number | null): string | null {
  if (x === null || x === 0) return null;
  const pct = Math.round(Math.abs(x) * 1000) / 10;
  const rendered = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return x < 0 ? `−${rendered}%` : `+${rendered}%`;
}
