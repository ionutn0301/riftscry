import { atom } from 'nanostores';
import { personalStorage } from './account/storage';

/**
 * My Pool, scoped to the signed-in workspace or the original guest browser.
 * Stored as an array of ddragon champion ids ("Ahri", "LeeSin").
 */

function decode(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function readPool() {
  try { return decode(personalStorage.getItem('riftscry:pool') ?? '[]'); }
  catch { return []; }
}
export const $pool = atom<string[]>(readPool());
const setPool = $pool.set.bind($pool);
$pool.set = value => {
  personalStorage.setItem('riftscry:pool', JSON.stringify(value));
  setPool(value);
};
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || event.key === 'riftscry:pool') setPool(readPool());
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
