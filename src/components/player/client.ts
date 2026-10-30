import { playerReturnUrl } from '../../lib/player/navigation';

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

/** Only the same player's local profile or briefing can be a return destination. */
export function playerBackLink(back: string, platform: string, puuid: string) {
  const url = playerReturnUrl(back, { platform, puuid });
  if (!url) return playerLink(platform, puuid);
  if (url.pathname === '/players') return playerLink(platform, puuid, url.search) + url.hash;
  return `${url.pathname}${url.search}${url.hash}`;
}
