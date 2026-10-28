import { platforms } from './contracts';
import { historyOptions } from './modes';

export type RecentPlayer = { platform: string; puuid: string; name: string };
export const RECENT_PLAYER_KEY = 'riftscry:recent-player:v1';
export const RECENT_PLAYER_EVENT = 'riftscry:recent-player-change';
const rememberedKey = 'riftscry:remembered-player:v1';

export function parseRecentPlayer(value: unknown): RecentPlayer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.platform !== 'string' || !Object.hasOwn(platforms, candidate.platform) ||
    typeof candidate.puuid !== 'string' || !/^[A-Za-z0-9_-]{30,120}$/.test(candidate.puuid) ||
    (candidate.name !== undefined && (typeof candidate.name !== 'string' || candidate.name.length > 150 || /[\u0000-\u001f\u007f]/.test(candidate.name)))) return null;
  return { platform: candidate.platform, puuid: candidate.puuid, name: typeof candidate.name === 'string' ? candidate.name.trim() : '' };
}

/** The most recent explicit lookup, with the existing saved-player shortcut as a fallback. */
export function readRecentPlayer(): RecentPlayer | null {
  try {
    for (const key of [RECENT_PLAYER_KEY, rememberedKey]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try { const player = parseRecentPlayer(JSON.parse(raw)); if (player) return player; }
      catch { /* A damaged optional shortcut cannot block lookup. */ }
    }
  } catch { /* A direct link and lookup work without browser storage. */ }
  return null;
}

export function rememberRecentPlayer(value: RecentPlayer): boolean {
  const player = parseRecentPlayer(value);
  if (!player) return false;
  try {
    localStorage.setItem(RECENT_PLAYER_KEY, JSON.stringify(player));
    window.dispatchEvent(new Event(RECENT_PLAYER_EVENT));
    return true;
  } catch { return false; }
}

export function briefingLink(player: { platform: string; puuid: string; name?: string }, extras: Record<string, string> = {}): string {
  const valid = parseRecentPlayer(player);
  if (!valid) return '/next-game';
  const query = new URLSearchParams({ platform: valid.platform, puuid: valid.puuid });
  if (valid.name) query.set('name', valid.name);
  if (historyOptions.some(option => option.value === extras.queue)) query.set('queue', extras.queue!);
  if (extras.champion && /^[A-Za-z0-9]{1,40}$/.test(extras.champion)) query.set('champion', extras.champion);
  return `/next-game?${query}`;
}
