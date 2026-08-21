import { persistentAtom } from "@nanostores/persistent";

/**
 * My Pool — the champions this player cares about. localStorage only; no
 * account. Stored as an array of ddragon champion ids ("Ahri", "LeeSin").
 */

function decode(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const $pool = persistentAtom<string[]>("riftscry:pool", [], {
  encode: JSON.stringify,
  decode,
});

export function togglePool(championId: string): void {
  const current = $pool.get();
  $pool.set(
    current.includes(championId)
      ? current.filter((id) => id !== championId)
      : [...current, championId],
  );
}

export function inPool(pool: string[], championId: string): boolean {
  const id = championId.toLowerCase();
  return pool.some((p) => p.toLowerCase() === id);
}
