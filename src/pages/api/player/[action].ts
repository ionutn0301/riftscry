import type { APIRoute } from 'astro';
import { z } from 'zod';
import { platforms, evidence, participant, type Platform } from '../../../lib/player/contracts';
import { isSupportedQueue } from '../../../lib/player/modes';
import { riot, limit, ServiceError, getMatch, getTimeline, getSummoner } from '../../../lib/player/server';
import { riotAccessAllowed } from '../../../lib/player/access';
import { getItemMetadata } from '../../../lib/player/metadata';
import { buildSuggestions } from '../../../lib/player/advice';
import { review } from '../../../lib/player/review';
export const prerender = false;
const platformSchema = z.enum(Object.keys(platforms) as [Platform, ...Platform[]]);
const puuidSchema = z.string().regex(/^[A-Za-z0-9_-]{30,120}$/);
const idSchema = z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/);
const json = (body: unknown, status = 200, retry = 0, scope?: 'player' | 'review') => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...(retry ? { 'Retry-After': String(retry) } : {}), ...(scope ? { 'X-RateLimit-Scope': scope } : {}) } });
export const ALL: APIRoute = async ({ request, url, params, clientAddress }) => {
  try {
    const action = params.action;
    if (!action || !['lookup', 'account', 'summoner', 'history', 'rank', 'match', 'timeline', 'review', 'items'].includes(action)) return json({ error: 'Unknown endpoint' }, 404);
    if (request.method !== (action === 'review' ? 'POST' : 'GET')) return json({ error: 'Method not allowed' }, 405);
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return json({ error: 'Origin not allowed' }, 403);
    const platform = platformSchema.parse(url.searchParams.get('platform'));
    if (!riotAccessAllowed(process.env)) throw new ServiceError('Player access is unavailable in this environment. Private testing requires the protected deployment and its private-testing configuration.');
    const beforeFetch = () => limit(clientAddress);
    const region = platforms[platform];
    if (action === 'lookup') {
      const name = z.string().trim().min(3).max(32).parse(url.searchParams.get('name'));
      const tag = z.string().trim().min(2).max(16).parse(url.searchParams.get('tag'));
      return json(await riot(region, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, 300, beforeFetch));
    }
    const puuid = puuidSchema.parse(url.searchParams.get('puuid'));
    if (action === 'account') return json(await riot(region, `/riot/account/v1/accounts/by-puuid/${puuid}`, 300, beforeFetch));
    if (action === 'summoner') return json(await getSummoner(platform, puuid, beforeFetch));
    if (action === 'history') {
      const requestedQueue = url.searchParams.get('queue');
      const queue = !requestedQueue || requestedQueue === 'all' ? undefined :
        z.string().regex(/^\d+$/).transform(Number).refine(isSupportedQueue).parse(requestedQueue);
      const configuredCount = Number(process.env.RIOT_IMPORT_LIMIT);
      const count = Number.isFinite(configuredCount) && configuredCount > 0 ? Math.min(20, Math.max(1, Math.floor(configuredCount))) : 20;
      // Omit queue entirely for a genuinely recent cross-mode sample. Do not
      // silently replace it with Solo/Duo or use a client-only mode filter.
      const query = new URLSearchParams({ start: '0', count: String(count), ...(queue == null ? {} : { queue: String(queue) }) });
      return json(await riot(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?${query}`, 120, beforeFetch));
    }
    if (action === 'rank') return json(await riot(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, 300, beforeFetch));
    const id = idSchema.parse(url.searchParams.get('id'));
    const match = await getMatch(platform, id, beforeFetch);
    if (!participant(match, puuid)) throw new ServiceError('Player is not in this match.', 404);
    if (action === 'match') return json(match);
    if (action === 'timeline') return json(await getTimeline(platform, id, beforeFetch));
    if (action === 'review') {
      const [timelineResult, metadataResult] = await Promise.allSettled([
        getTimeline(platform, id, beforeFetch), getItemMetadata(match),
      ]);
      const timeline = timelineResult.status === 'fulfilled' ? timelineResult.value : undefined;
      const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : undefined;
      const facts = evidence(match, puuid, timeline, metadata);
      return json(await review(facts, buildSuggestions(match, puuid, facts, metadata), () => limit(clientAddress, true)));
    }
    if (action === 'items') {
      return json(await getItemMetadata(match));
    }
    return json({ error: 'Unknown endpoint' }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'Invalid player, region, queue or match identifier.' }, 400);
    if (error instanceof ServiceError) return json({ error: error.message }, error.status, error.retry, error.scope);
    return json({ error: 'Service temporarily unavailable. Your local notes have not changed.' }, 503, 5);
  }
};
