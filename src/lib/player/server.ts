import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { createHash, randomUUID } from 'node:crypto';
import { platforms, type Platform, type Match, type Timeline } from './contracts';
import { riotAccessAllowed } from './access';
export class ServiceError extends Error { constructor(message: string, public status = 503, public retry = 0) { super(message); } }
export function redis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new ServiceError('Shared cache credentials are not available. Player requests are temporarily unavailable.');
  return new Redis({ url, token });
}
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export async function limit(identity: string, expensive = false) {
  const r = new Ratelimit({ redis: redis(), prefix: expensive ? 'rs:review-limit' : 'rs:lookup-limit', limiter: Ratelimit.slidingWindow(expensive ? 4 : 90, '10 m'), timeout: 3000 });
  const result = await r.limit(hash(identity));
  if (!result.success || result.reason === 'timeout') throw new ServiceError('Request limit reached. Try again later.', 429, Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
}
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const db = redis(); const digest = `rs:v1:${hash(key)}`;
  const existing = await db.get<T>(digest); if (existing !== null) return existing;
  const lock = `${digest}:lock`, owner = randomUUID();
  if (!await db.set(lock, owner, { nx: true, ex: 50 })) throw new ServiceError('This request is already being prepared. Retry shortly.', 503, 3);
  try { const value = await fn(); await db.set(digest, value, { ex: ttl }); return value; }
  finally { await db.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end', [lock], [owner]); }
}
export async function riot<T>(host: string, path: string, ttl = 300): Promise<T> {
  if (!riotAccessAllowed(process.env)) throw new ServiceError('Riot access is disabled. Private testing requires an enabled testing switch in a protected non-production environment. Public access remains separately gated.');
  return cached(`riot:${host}${path}`, ttl, async () => {
    const db = redis();
    const cooldown = await db.get<number>(`rs:riot-cooldown:${host}`);
    if (cooldown && cooldown > Date.now()) throw new ServiceError('Riot is rate limiting requests. Please wait before refreshing.', 429, Math.ceil((cooldown - Date.now()) / 1000));
    const gate = new Ratelimit({ redis: db, prefix: `rs:riot:${host}`, limiter: Ratelimit.slidingWindow(15, '1 s'), timeout: 3000 });
    const permission = await gate.limit('application');
    if (!permission.success || permission.reason === 'timeout') throw new ServiceError('Riot request budget is busy. Retry shortly.', 429, 5);
    const response = await fetch(`https://${host}.api.riotgames.com${path}`, { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY! }, signal: AbortSignal.timeout(12000) });
    if (response.status === 429) {
      const seconds = Math.max(1, Number(response.headers.get('Retry-After')) || 30);
      await db.set(`rs:riot-cooldown:${host}`, Date.now() + seconds * 1000, { ex: Math.ceil(seconds) });
    }
    if (!response.ok) { const status = response.status; throw new ServiceError(status === 404 ? 'Player or match not found in this region.' : status === 429 ? 'Riot is rate limiting requests. Please wait before refreshing.' : status === 403 || status === 401 ? 'Riot access is unavailable or expired.' : 'Riot is temporarily unavailable.', status === 404 ? 404 : status === 429 ? 429 : 503, status === 429 ? Math.max(1, Number(response.headers.get('Retry-After')) || 30) : 0); }
    return response.json() as Promise<T>;
  });
}
export async function getMatch(platform: Platform, id: string): Promise<Match> {
  const match = await riot<Match>(platforms[platform], `/lol/match/v5/matches/${id}`, 3600);
  if (match.info.gameType !== 'MATCHED_GAME' || ![420,440,400,430,450].includes(match.info.queueId)) throw new ServiceError('Only supported public matchmade queues are available. Custom matches are excluded.', 404);
  return match;
}
export function getTimeline(platform: Platform, id: string) { return riot<Timeline>(platforms[platform], `/lol/match/v5/matches/${id}/timeline`, 3600); }
