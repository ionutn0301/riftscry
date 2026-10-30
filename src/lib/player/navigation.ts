import { parseRecentPlayer, type RecentPlayer } from './identity';
import { historyOptions } from './modes';

export const PLAYER_CONTEXT_EVENT = 'riftscry:player-context-change';
export type PlayerNavigationContext = { player: RecentPlayer; queue: string; champion: string };

function scope(query: URLSearchParams) {
  const queue = query.get('queue') ?? '';
  const champion = query.get('champion') ?? '';
  return {
    queue: historyOptions.some(option => option.value === queue) ? queue : 'all',
    champion: /^[A-Za-z0-9]{1,40}$/.test(champion) ? champion : '',
  };
}

function routeContext(url: URL): PlayerNavigationContext | null {
  const profile = /^\/players\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  const queryRoute = url.pathname === '/players' || url.pathname === '/next-game' || /^\/matches\/[^/]+$/.test(url.pathname);
  if (!profile && !queryRoute) return null;
  if (url.pathname === '/next-game' && url.searchParams.has('change')) return null;
  if (!profile && ['platform', 'puuid'].some(key => url.searchParams.getAll(key).length !== 1)) return null;
  let player: RecentPlayer | null;
  try {
    player = parseRecentPlayer({
      platform: profile ? decodeURIComponent(profile[1]!).toLowerCase() : url.searchParams.get('platform'),
      puuid: profile ? decodeURIComponent(profile[2]!) : url.searchParams.get('puuid'),
      name: url.searchParams.get('name') ?? '',
    });
  } catch { return null; }
  return player ? { player, ...scope(url.searchParams) } : null;
}

/** Only this player's local profile or briefing can be a match's return task. */
export function playerReturnUrl(back: string, player: Pick<RecentPlayer, 'platform' | 'puuid'>, origin = 'https://riftscry.invalid'): URL | null {
  if (!back.startsWith('/') || back.startsWith('//') || /[\u0000-\u001f\u007f]/.test(back)) return null;
  try {
    const url = new URL(back, origin);
    if (url.origin !== origin || !(url.pathname === '/next-game' || url.pathname === '/players' || /^\/players\/[^/]+\/[^/]+$/.test(url.pathname))) return null;
    const context = routeContext(url);
    return context?.player.platform === player.platform && context.player.puuid === player.puuid ? url : null;
  } catch { return null; }
}

/** Read the actual task URL; a remembered identity never replaces an explicit one. */
export function playerNavigationContext(url: URL, recent: RecentPlayer | null): PlayerNavigationContext | null {
  const task = url.pathname === '/players' || url.pathname === '/next-game';
  const explicit = url.pathname.startsWith('/players/') || url.pathname.startsWith('/matches/') ||
    (task && (url.searchParams.has('platform') || url.searchParams.has('puuid') || url.searchParams.has('change')));
  if (explicit) {
    const context = routeContext(url);
    if (!context) return null;
    if (url.pathname.startsWith('/matches/')) {
      const back = playerReturnUrl(url.searchParams.get('back') ?? '', context.player, url.origin);
      if (back) return routeContext(back);
    }
    return context;
  }
  const player = parseRecentPlayer(recent);
  return player ? { player, ...scope(task ? url.searchParams : new URLSearchParams()) } : null;
}

/** Dispatch only after the component has committed its selection to the URL. */
export function announcePlayerContext() {
  window.dispatchEvent(new Event(PLAYER_CONTEXT_EVENT));
}
