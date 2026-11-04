import type { HomeChampionCount } from './home-personalization';

export const HOME_ROSTER_CACHE_KEY = 'riftscry:home-roster:v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
export type HomeRosterIdentity = { owner: string; platform: string; puuid: string };
export type HomeRosterSnapshot = HomeRosterIdentity & {
  savedAt: number; champions: HomeChampionCount[]; total: number; failed: number; excluded: number; latest: string | null;
};

/** A disposable, device-only hint. Never read before the account and Riot ID agree. */
export function parseHomeRoster(raw: string | null, identity: HomeRosterIdentity, known: readonly string[], now = Date.now()): HomeRosterSnapshot | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const value = JSON.parse(raw) as HomeRosterSnapshot;
    if (!value || value.owner !== identity.owner || value.platform !== identity.platform || value.puuid !== identity.puuid ||
      !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > MAX_AGE ||
      !Array.isArray(value.champions) || !value.champions.length || value.champions.length > 3 ||
      ![value.total, value.failed, value.excluded].every(count => Number.isInteger(count) && count >= 0 && count <= 20) ||
      value.total + value.failed + value.excluded > 20 || value.total < 1 ||
      (value.latest !== null && (typeof value.latest !== 'string' || !/^[A-Z0-9]{2,5}_[0-9]{5,20}$/.test(value.latest)))) return null;
    const ids = new Set<string>();
    let games = 0;
    for (const champion of value.champions) {
      if (!champion || !known.includes(champion.id) || ids.has(champion.id) || !Number.isInteger(champion.games) || champion.games < 1 ||
        champion.games > value.total || !Number.isFinite(champion.lastPlayed) || champion.lastPlayed <= 0) return null;
      ids.add(champion.id); games += champion.games;
    }
    return games <= value.total ? value : null;
  } catch { return null; }
}
