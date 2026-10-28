export type ValueSeries = { values: number[]; unit: string };

/** Only literal scalars and rank arrays are safe to compare without a formula parser. */
export function literalSeries(text: string): ValueSeries | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)*)(%|s| seconds?| gold)?$/i);
  if (!match) return null;
  return { values: match[1]!.split("/").map(Number), unit: (match[2] ?? "").trim().toLowerCase().replace(/^seconds?$/, "s") };
}

export function parseValueSeries(text: string): number[] {
  return literalSeries(text)?.values ?? [];
}

export function comparableSeries(before: string, after: string) {
  const b = literalSeries(before), a = literalSeries(after);
  return b && a && b.unit === a.unit && b.values.length === a.values.length ? { before: b, after: a } : null;
}

/** Relative changes are only defined here for matching non-percent scalar values. */
export function relativeDelta(before: string, after: string): number | null {
  const pair = comparableSeries(before, after);
  if (!pair || pair.before.unit === "%" || pair.before.values.length !== 1) return null;
  const b = pair.before.values[0]!, a = pair.after.values[0]!;
  return b === 0 ? null : (a - b) / Math.abs(b);
}

export function formatDelta(x: number | null): string | null {
  if (x === null || x === 0 || !Number.isFinite(x)) return null;
  const pct = Math.round(Math.abs(x) * 1000) / 10;
  return `${x < 0 ? "−" : "+"}${pct}%`;
}

export function describeDelta(before: string, after: string): string | null {
  const pair = comparableSeries(before, after);
  if (!pair) return null;
  const differences = pair.after.values.map((a, i) => a - pair.before.values[i]!);
  if (differences.every((d) => d === 0)) return null;
  const signed = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${Number(Math.abs(n).toFixed(6))}`;
  if (differences.length > 1) {
    const mixed = differences.some((n) => n > 0) && differences.some((n) => n < 0);
    return `${mixed ? "Mixed rank changes · " : ""}${differences.map((n, i) => `Rank ${i + 1}: ${signed(n)}${pair.before.unit === "%" ? " pp" : pair.before.unit ? ` ${pair.before.unit}` : ""}`).join("; ")}`;
  }
  if (pair.before.unit === "%") return `${signed(differences[0]!)} percentage points`;
  const relative = formatDelta(relativeDelta(before, after));
  return relative ? `${relative} relative` : null;
}
