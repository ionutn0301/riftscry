import type { APIRoute } from 'astro';
import { z } from 'zod';
import { platforms, queues, evidence, participant, type Platform } from '../../../lib/player/contracts';
import { riot, limit, ServiceError, getMatch, getTimeline, cached } from '../../../lib/player/server';
import { review } from '../../../lib/player/review';
export const prerender = false;
const platformSchema = z.enum(Object.keys(platforms) as [Platform, ...Platform[]]);
const puuidSchema = z.string().regex(/^[A-Za-z0-9_-]{30,120}$/);
const idSchema = z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/);
const json = (body: unknown, status = 200, retry = 0) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...(retry ? { 'Retry-After': String(retry) } : {}) } });
export const ALL: APIRoute = async ({ request, url, params, clientAddress }) => {
  try {
    const action = params.action;
    if (request.method !== (action === 'review' ? 'POST' : 'GET')) return json({ error: 'Method not allowed' }, 405);
    if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return json({ error: 'Origin not allowed' }, 403);
    const platform = platformSchema.parse(url.searchParams.get('platform'));
    await limit(clientAddress, action === 'review');
    const region = platforms[platform];
    if (action === 'lookup') {
      const name = z.string().trim().min(3).max(32).parse(url.searchParams.get('name'));
      const tag = z.string().trim().min(2).max(16).parse(url.searchParams.get('tag'));
      return json(await riot(region, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`));
    }
    const puuid = puuidSchema.parse(url.searchParams.get('puuid'));
    if (action === 'history') {
      const queue = z.coerce.number().refine((q) => q in queues).parse(url.searchParams.get('queue'));
      const count = Math.min(20, Math.max(1, Number(process.env.RIOT_IMPORT_LIMIT) || 20));
      return json(await riot(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&queue=${queue}`, 120));
    }
    if (action === 'rank') return json(await riot(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, 300));
    const id = idSchema.parse(url.searchParams.get('id'));
    const match = await getMatch(platform, id);
    if (!participant(match, puuid)) throw new ServiceError('Player is not in this match.', 404);
    if (action === 'match') return json(match);
    if (action === 'timeline') return json(await getTimeline(platform, id));
    if (action === 'review') {
      let timeline; try { timeline = await getTimeline(platform, id); } catch { /* Match facts remain useful when timeline access fails. */ }
      return json(await review(evidence(match, puuid, timeline)));
    }
    if (action === 'items') {
      const patch = match.info.gameVersion.split('.').slice(0, 2).join('.');
      return json(await cached(`items-runes-v2:${patch}`, 86400, async () => {
        const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: AbortSignal.timeout(8000) });
        if (!versionsResponse.ok) throw new ServiceError('Item versions unavailable.');
        const versions: string[] = await versionsResponse.json(); const version = versions.find((v) => v.startsWith(patch + '.'));
        if (!version) return { version: null, data: {}, notice: 'No compatible historical item version. Only item IDs are shown.' };
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new ServiceError('Historical items unavailable.');
        const body = await response.json();
        let runes: Record<string,{name:string;icon:string}> = {};
        try {
          const runeResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`, {signal:AbortSignal.timeout(8000)});
          if (runeResponse.ok) {
            const trees = await runeResponse.json() as {slots:{runes:{id:number;name:string;icon:string}[]}[]}[];
            runes = Object.fromEntries(trees.flatMap(tree=>tree.slots.flatMap(slot=>slot.runes.map(rune=>[rune.id,{name:rune.name,icon:rune.icon}]))));
          }
        } catch { /* Item metadata remains usable if rune metadata is unavailable. */ }
        return { version, data: body.data, runes, notice: 'Patch-level Data Dragon metadata; mid-patch item revisions may differ. Not a recommendation.' };
      }));
    }
    return json({ error: 'Unknown endpoint' }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'Invalid player, region, queue or match identifier.' }, 400);
    if (error instanceof ServiceError) return json({ error: error.message }, error.status, error.retry);
    return json({ error: 'Service temporarily unavailable. Your local notes have not changed.' }, 503, 5);
  }
};
