import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAccount } from '../../lib/account/server';
import { platforms, participant, type Platform } from '../../lib/player/contracts';
import { getMatch, getTimeline, limit, ServiceError } from '../../lib/player/server';
import { getItemMetadata } from '../../lib/player/metadata';
import { coach, coachEvidence } from '../../lib/player/coach';
export const prerender = false;
const schema = z.object({
  platform: z.enum(Object.keys(platforms) as [Platform, ...Platform[]]),
  puuid: z.string().regex(/^[A-Za-z0-9_-]{30,120}$/),
  matchIds: z.array(z.string().regex(/^[A-Z0-9]{2,5}_[0-9]{5,20}$/)).min(1).max(3),
  question: z.string().trim().max(400).default(''),
}).strict();
const json = (body: unknown, status = 200, retry = 0, scope = 'review') => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  ...(retry ? { 'Retry-After': String(retry), 'X-RateLimit-Scope': scope } : {}),
} });
export const ALL: APIRoute = async ({ request, url, clientAddress }) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Origin not allowed' }, 403);
  try {
    const owner = await requireAccount(request);
    if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'Question is too long.' }, 413);
    const body = await request.text();
    if (body.length > 2048) return json({ error: 'Question is too long.' }, 413);
    const input = schema.parse(JSON.parse(body));
    const beforeFetch = () => limit(clientAddress);
    const ids = [...new Set(input.matchIds)];
    const results = await Promise.allSettled(ids.map(id => getMatch(input.platform, id, beforeFetch)));
    if (results[0]!.status === 'rejected') throw results[0]!.reason;
    const primary = results[0]!.value;
    if (!participant(primary, input.puuid)) return json({ error: 'Player is not in this match.' }, 404);
    const matches = [primary, ...results.slice(1).flatMap(result => result.status === 'fulfilled' &&
      participant(result.value, input.puuid) && result.value.info.gameCreation < primary.info.gameCreation ? [result.value] : [])];
    const [timeline, metadata] = await Promise.allSettled([getTimeline(input.platform, ids[0]!, beforeFetch), getItemMetadata(primary)]);
    const context = coachEvidence(matches, input.puuid, input.platform, timeline.status === 'fulfilled' ? timeline.value : undefined, metadata.status === 'fulfilled' ? metadata.value : undefined);
    return json(await coach(context, input.question, async () => { await limit(clientAddress, true); await limit(`account:${owner}`, true); }));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Use a valid player, match and a question of up to 400 characters.' }, 400);
    if (error instanceof ServiceError) return json({ error: error.message }, error.status, error.retry, error.scope);
    return json({ error: 'Your coach is temporarily unavailable. Recorded matches and patch notes still work.' }, 503, 5);
  }
};
