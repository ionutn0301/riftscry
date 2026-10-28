import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { createHash, randomUUID } from 'node:crypto';
import { platforms, type Platform, type Match, type Timeline } from './contracts';
import { riotAccessAllowed } from './access';
import { isSupportedMatchmade } from './modes';
import { observeRiotBudget, reserveRiotBudget, retryAfterSeconds, riotMethod, type RiotBudget } from './riot-budget';

export class ServiceError extends Error {
  constructor(message: string, public status = 503, public retry = 0, public scope?: 'player' | 'review') { super(message); }
}
export type BeforeFetch = () => Promise<void>;
export const MATCH_CACHE_SECONDS = 7 * 24 * 60 * 60;
const pendingFills = new Map<string, Promise<unknown>>();
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const releaseLock = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export function redis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new ServiceError('Shared cache credentials are not available. Player requests are temporarily unavailable.');
  return new Redis({ url, token });
}
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export async function limit(identity: string, expensive = false) {
  // A new namespace does not inherit the old counters charged on cache hits.
  const r = new Ratelimit({ redis: redis(), prefix: expensive ? 'rs:review-fill-limit:v2' : 'rs:riot-fill-limit:v2', limiter: Ratelimit.slidingWindow(expensive ? 4 : 90, '10 m'), timeout: 3000 });
  const result = await r.limit(hash(identity));
  if (!result.success || result.reason === 'timeout') throw new ServiceError(expensive ? 'AI review refresh limit reached. Recorded match facts remain available.' : 'New player data request limit reached. Previously loaded match data remains available.', 429, Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)), expensive ? 'review' : 'player');
}

async function fillCache<T>(digest: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const db = redis(), lock = `${digest}:lock`, owner = randomUUID();
  const deadline = Date.now() + 25000;
  let delay = 100;
  do {
    const existing = await db.get<T>(digest);
    if (existing !== null) return existing;
    if (await db.set(lock, owner, { nx: true, ex: 50 })) {
      try {
        // The previous leader can finish between our GET and lock acquisition.
        const completed = await db.get<T>(digest);
        if (completed !== null) return completed;
        const value = await fn();
        await db.set(digest, value, { ex: ttl });
        return value;
      } finally {
        await db.eval(releaseLock, [lock], [owner]);
      }
    }
    await wait(delay);
    delay = Math.min(500, delay + 100);
  } while (Date.now() < deadline);
  throw new ServiceError('This data is still being prepared. Please retry shortly.', 503, 3);
}

/** Successful fills are shared by both simultaneous callers and other workers. */
export function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const digest = `rs:v1:${hash(key)}`;
  const pending = pendingFills.get(digest);
  if (pending) return pending as Promise<T>;
  const promise = fillCache(digest, ttl, fn).finally(() => pendingFills.delete(digest));
  pendingFills.set(digest, promise);
  return promise;
}

// Only a matching revision can replace the shared counters. No lock is held
// across a network request, and stale response observations cannot lose counts.
const compareAndSetBudget = `
local current = redis.call("get", KEYS[1])
if current then
  if cjson.decode(current).revision ~= ARGV[1] then return 0 end
elseif ARGV[1] ~= "" then return 0 end
redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1`;

async function updateBudget(db: Redis, key: string, change: (state: RiotBudget | null) => { state: RiotBudget; retry?: number }, beforeCommit?: BeforeFetch): Promise<void> {
  let admitted = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const previous = await db.get<RiotBudget>(key);
    const { state, retry = 0 } = change(previous);
    if (retry) throw new ServiceError('Riot request budget is busy. Please wait before refreshing.', 429, retry, 'player');
    // A denied client must not consume the shared regional budget. A CAS retry
    // also must not charge the same client admission more than once.
    if (!admitted) { await beforeCommit?.(); admitted = true; }
    state.revision = randomUUID();
    const ttl = Math.max(86400, Math.ceil((Math.max(state.cooldownUntil, ...Object.values(state.methodCooldowns)) - Date.now()) / 1000) + 1);
    if (await db.eval(compareAndSetBudget, [key], [previous?.revision ?? '', JSON.stringify(state), ttl])) return;
    await wait(10 + attempt * 5);
  }
  throw new ServiceError('Riot request budget is busy. Please retry shortly.', 429, 2, 'player');
}

export async function riot<T>(host: string, path: string, ttl = 300, beforeFetch?: BeforeFetch): Promise<T> {
  if (!riotAccessAllowed(process.env)) throw new ServiceError('Riot access is disabled. Private testing requires the protected deployment and its private-testing configuration. Public access remains separately gated.');
  return cached(`riot:${host}${path}`, ttl, async () => {
    const db = redis();
    // Preserve a provider cooldown created by the preceding deployment.
    const legacyCooldown = await db.get<number>(`rs:riot-cooldown:${host}`);
    if (legacyCooldown && legacyCooldown > Date.now()) throw new ServiceError('Riot is rate limiting requests. Please wait before refreshing.', 429, Math.ceil((legacyCooldown - Date.now()) / 1000), 'player');
    const budgetKey = `rs:riot-budget:v2:${hash(process.env.RIOT_API_KEY!)}:${host}`;
    const method = riotMethod(path);
    // Only the cache-fill leader requests client and regional admission.
    await updateBudget(db, budgetKey, state => reserveRiotBudget(state, method, Date.now()), beforeFetch);
    const requestedAt = Date.now();
    const response = await fetch(`https://${host}.api.riotgames.com${path}`, { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY! }, signal: AbortSignal.timeout(12000) });
    await updateBudget(db, budgetKey, state => ({ state: observeRiotBudget(state, method, response.headers, response.status, Date.now(), requestedAt) }));
    if (!response.ok) {
      const status = response.status;
      throw new ServiceError(status === 404 ? 'Player or match not found in this region.' : status === 429 ? 'Riot is rate limiting requests. Please wait before refreshing.' : status === 403 || status === 401 ? 'Riot access is unavailable or expired.' : 'Riot is temporarily unavailable.', status === 404 ? 404 : status === 429 ? 429 : 503, status === 429 ? retryAfterSeconds(response.headers.get('Retry-After'), Date.now()) : 0, status === 429 ? 'player' : undefined);
    }
    return response.json() as Promise<T>;
  });
}
export async function getMatch(platform: Platform, id: string, beforeFetch?: BeforeFetch): Promise<Match> {
  const match = await riot<Match>(platforms[platform], `/lol/match/v5/matches/${id}`, MATCH_CACHE_SECONDS, beforeFetch);
  if (!isSupportedMatchmade(match)) throw new ServiceError('This recent entry is not a supported public matchmade queue. Custom, tutorial, bot and unrecognized queues are excluded.', 404);
  return match;
}
export function getTimeline(platform: Platform, id: string, beforeFetch?: BeforeFetch) { return riot<Timeline>(platforms[platform], `/lol/match/v5/matches/${id}/timeline`, MATCH_CACHE_SECONDS, beforeFetch); }
