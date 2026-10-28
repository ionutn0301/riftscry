export { playerRequest as fetcher, PlayerRequestError, getPlayerCooldown, subscribePlayerCooldown } from './requestCache';
export const api = (action: string, values: Record<string, string | number>) => `/api/player/${action}?${new URLSearchParams(Object.entries(values).map(([k,v]) => [k,String(v)]))}`;
export type PlayerView = 'history' | 'builds' | 'memory';
export type PlayerInitial = {
  platform: string;
  puuid: string;
  queue: string;
  champion: string;
  result: string;
  view: string;
  name: string;
};

export function playerLink(platform: string, puuid: string, extra: string | Record<string, string> = '') {
  const query = new URLSearchParams(typeof extra === 'string' ? extra.replace(/^[?&]/, '') : extra);
  query.delete('platform');
  query.delete('puuid');
  for (const [key, value] of [...query]) if (!value) query.delete(key);
  const suffix = query.toString();
  return `/players/${encodeURIComponent(platform.toLowerCase())}/${encodeURIComponent(puuid)}${suffix ? `?${suffix}` : ''}`;
}

export function matchLink(id: string, platform: string, puuid: string, back?: string) {
  return `/matches/${encodeURIComponent(id)}?${new URLSearchParams({ platform, puuid, ...(back ? { back } : {}) })}`;
}

/** Only local player routes can be carried through a match-review return link. */
export function playerBackLink(back: string, platform: string, puuid: string) {
  if (!back.startsWith('/') || back.startsWith('//')) return playerLink(platform, puuid);
  try {
    const url = new URL(back, 'https://riftscry.invalid');
    if (url.origin !== 'https://riftscry.invalid') return playerLink(platform, puuid);
    if (url.pathname === '/players' && url.searchParams.get('puuid') === puuid && url.searchParams.get('platform') === platform) {
      return playerLink(platform, puuid, url.search);
    }
    if (url.pathname === playerLink(platform, puuid)) return `${url.pathname}${url.search}${url.hash}`;
  } catch { /* A malformed return path falls back to the canonical profile. */ }
  return playerLink(platform, puuid);
}
