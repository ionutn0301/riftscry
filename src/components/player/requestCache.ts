/** Bounded, tab-local reuse of completed Riot records. Never stores AI or notes. */
const STORAGE_KEY = 'riftscry:player-cache:v1';
const MAX_ENTRIES = 120;
const MAX_BYTES = 3_000_000;
const MAX_REQUESTS = 4;
const IMMUTABLE_TTL = 24 * 60 * 60 * 1000;
type Scope = 'player' | 'review';
type Entry = { key: string; expiresAt: number; value: unknown; bytes: number };
const responses = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();
const deferredErrors = new Map<string, PlayerRequestError>();
const listeners = new Set<() => void>();
const cooldowns: Record<Scope, number> = { player: 0, review: 0 };
let restored = false;
let bytes = 0;
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
let activeRequests = 0;
const pending: (() => void)[] = [];

export class PlayerRequestError extends Error {
  constructor(message: string, public status: number, public retryAt = 0, public scope: Scope = 'player') {
    const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    super(`${message}${seconds ? ` Retry in ${seconds} seconds.` : ''}`);
    this.name = 'PlayerRequestError';
  }
}

function persist() {
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = undefined;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: [...responses.values()], cooldowns }));
  } catch { /* The in-memory cache remains useful when session storage is blocked/full. */ }
}

function schedulePersistence() {
  if (typeof window !== 'undefined' && !persistenceTimer) persistenceTimer = setTimeout(persist, 80);
}

function trim() {
  for (const [key, entry] of responses) {
    if (entry.expiresAt <= Date.now()) { responses.delete(key); bytes -= entry.bytes; }
  }
  while (responses.size > MAX_ENTRIES || bytes > MAX_BYTES) {
    const first = responses.entries().next().value as [string, Entry] | undefined;
    if (!first) break;
    responses.delete(first[0]); bytes -= first[1].bytes;
  }
}

function restore() {
  if (restored) return;
  restored = true;
  if (typeof window === 'undefined') return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.version === 1 && Array.isArray(saved.entries)) {
      for (const entry of saved.entries.slice(-MAX_ENTRIES)) {
        if (typeof entry?.key !== 'string' || !entry.key.startsWith('GET /api/player/') || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) continue;
        const size = JSON.stringify(entry.value).length * 2;
        if (size > MAX_BYTES) continue;
        const restoredEntry = { key: entry.key, expiresAt: entry.expiresAt, value: entry.value, bytes: size };
        responses.set(entry.key, restoredEntry); bytes += size;
      }
      for (const scope of ['player', 'review'] as const) {
        const until = saved.cooldowns?.[scope];
        if (Number.isFinite(until) && until > Date.now() && until <= Date.now() + 24 * 60 * 60 * 1000) cooldowns[scope] = until;
      }
      trim();
    }
  } catch { /* A malformed optional cache never blocks the player service. */ }
  window.addEventListener('pagehide', persist);
}

function read(key: string): unknown | undefined {
  restore();
  const entry = responses.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { responses.delete(key); bytes -= entry.bytes; return undefined; }
  // Least recently used entries leave first when the tab reaches its bound.
  responses.delete(key); responses.set(key, entry);
  return entry.value;
}

function write(key: string, value: unknown, ttl: number) {
  const size = JSON.stringify(value).length * 2;
  if (size > MAX_BYTES) return;
  const previous = responses.get(key);
  if (previous) { responses.delete(key); bytes -= previous.bytes; }
  responses.set(key, { key, expiresAt: Date.now() + ttl, value, bytes: size });
  bytes += size;
  trim(); schedulePersistence();
}

export function getPlayerCooldown(scope: Scope = 'player'): number {
  restore();
  return scope === 'review' ? Math.max(cooldowns.player, cooldowns.review) : cooldowns.player;
}

export function subscribePlayerCooldown(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setCooldown(scope: Scope, until: number) {
  cooldowns[scope] = Math.max(cooldowns[scope], until);
  schedulePersistence();
  for (const listener of listeners) listener();
}

function retryAt(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Date.now() + seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(Date.now(), timestamp) : 0;
}

function canonical(url: URL, method = 'GET') {
  const params = new URLSearchParams(url.search);
  params.sort();
  return `${method} ${url.pathname}?${params}`;
}

function referenceKey(url: URL, patch: string) {
  const reference = new URL('/api/player/items', url.origin);
  for (const field of ['platform', 'puuid']) reference.searchParams.set(field, url.searchParams.get(field) ?? '');
  reference.searchParams.set('patch', patch);
  return canonical(reference);
}

function itemKey(url: URL) {
  const matchUrl = new URL(url);
  matchUrl.pathname = '/api/player/match';
  const match = read(canonical(matchUrl)) as { info?: { gameVersion?: string } } | undefined;
  const version = match?.info?.gameVersion;
  return typeof version === 'string' && /^\d+\.\d+\./.test(version) ? referenceKey(url, version.split('.').slice(0, 2).join('.')) : undefined;
}

/** Keep only the fields the reader uses, so twenty matches fit in a small tab cache. */
function compact(action: string, body: any) {
  if (action === 'match' && body?.metadata && Array.isArray(body?.info?.participants)) {
    const { gameCreation, gameDuration, gameVersion, queueId, gameMode, gameType, mapId } = body.info;
    return { metadata: { matchId: body.metadata.matchId }, info: {
      gameCreation, gameDuration, gameVersion, queueId, gameMode, gameType, mapId,
      participants: body.info.participants.map((player: any) => {
        const { puuid, participantId, teamId, championName, teamPosition, win, kills, deaths, assists,
          totalMinionsKilled, neutralMinionsKilled, goldEarned, totalDamageDealtToChampions, visionScore,
          item0, item1, item2, item3, item4, item5, item6, perks } = player;
        return { puuid, participantId, teamId, championName, teamPosition, win, kills, deaths, assists,
          totalMinionsKilled, neutralMinionsKilled, goldEarned, totalDamageDealtToChampions, visionScore,
          item0, item1, item2, item3, item4, item5, item6,
          ...(perks ? { perks: { styles: perks.styles?.map((style: any) => ({ selections: style.selections?.map((selection: any) => ({ perk: selection.perk })) })) } } : {}),
        };
      }),
    } };
  }
  if (action === 'timeline' && Array.isArray(body?.info?.frames)) return { info: { frames: body.info.frames.map((frame: any) => ({
    timestamp: frame.timestamp,
    events: (frame.events ?? []).map((event: any) => {
      const { type, timestamp, participantId, killerId, victimId, itemId, beforeId, afterId } = event;
      return { type, timestamp, participantId, killerId, victimId, itemId, beforeId, afterId };
    }),
  })) } };
  if (action === 'items' && body?.data && typeof body.data === 'object') return {
    ...body, data: Object.fromEntries(Object.entries(body.data).map(([id, item]: [string, any]) => {
      const { name, plaintext, image, stats, tags, from, into, maps, depth, inStore, requiredChampion, requiredAlly, gold } = item;
      return [id, { name, plaintext, image: image?.full ? { full: image.full } : undefined, stats, tags, from, into, maps, depth, inStore, requiredChampion, requiredAlly, gold }];
    })),
  };
  return body;
}

function schedule<T>(run: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      activeRequests++;
      void run().then(resolve, reject).finally(() => {
        activeRequests--;
        pending.shift()?.();
      });
    };
    if (activeRequests < MAX_REQUESTS) start(); else pending.push(start);
  });
}

export function playerRequest<T>(input: string, init?: RequestInit): Promise<T> {
  restore();
  const url = new URL(input, typeof location === 'undefined' ? 'https://riftscry.invalid' : location.origin);
  const action = url.pathname.split('/').at(-1) ?? '';
  const method = init?.method?.toUpperCase() ?? 'GET';
  const key = canonical(url, method);
  const reference = method === 'GET' && action === 'items' ? itemKey(url) : undefined;
  const requestKey = reference ?? key;
  const ttl = method !== 'GET' ? 0 : ['match', 'timeline', 'items'].includes(action) ? IMMUTABLE_TTL : action === 'account' || action === 'rank' ? 5 * 60 * 1000 : 0;
  const cached = ttl ? read(requestKey) ?? read(key) : undefined;
  if (cached !== undefined) return Promise.resolve(cached as T);
  const existing = inFlight.get(requestKey);
  if (existing) return existing as Promise<T>;

  const promise = schedule(async () => {
    const scope: Scope = action === 'review' ? 'review' : 'player';
    const until = getPlayerCooldown(scope);
    if (until > Date.now()) throw new PlayerRequestError('Player requests are temporarily paused.', 429, until, scope);
    const deferred = deferredErrors.get(key);
    if (deferred && deferred.retryAt > Date.now()) throw deferred;
    deferredErrors.delete(key);
    const response = await fetch(input, init);
    const retry = retryAt(response.headers.get('Retry-After'));
    const responseScope: Scope = response.headers.get('X-RateLimit-Scope') === 'review' ? 'review' : 'player';
    if (response.status === 429) setCooldown(responseScope, retry || Date.now() + 60_000);
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new PlayerRequestError('Player service is temporarily unavailable. Please retry shortly.', response.status, retry);
    }
    const body = await response.json();
    if (!response.ok) {
      const error = new PlayerRequestError(typeof body?.error === 'string' ? body.error : 'Player service is temporarily unavailable.', response.status,
        response.status === 429 ? getPlayerCooldown(responseScope) : retry, responseScope);
      if (retry > Date.now()) deferredErrors.set(key, error);
      throw error;
    }
    const value = compact(action, body);
    if (ttl) {
      write(key, value, ttl);
      if (action === 'items' && typeof body?.version === 'string' && /^\d+\.\d+\.\d+$/.test(body.version)) {
        write(referenceKey(url, body.version.split('.').slice(0, 2).join('.')), value, ttl);
      }
    }
    return value as T;
  }).finally(() => inFlight.delete(requestKey));
  inFlight.set(requestKey, promise);
  return promise;
}
