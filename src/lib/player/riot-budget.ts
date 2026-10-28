/**
 * Riot's application and method windows are regional and independent. Responses
 * advertise the active limits/counts; a 429 requires honoring Retry-After.
 * https://developer.riotgames.com/docs/portal#web-apis_rate-limiting
 * https://www.riotgames.com/en/DevRel/riot-games-api-change-log
 *
 * This is deliberately conservative: retain headroom, never lower an observed
 * count because responses completed out of order, and use a full window when
 * Riot reports usage that this deployment did not reserve itself.
 */
export type RateWindow = {
  seconds: number;
  limit: number;
  count: number;
  startedAt: number;
  resetAt: number;
};
export type RiotBudget = {
  revision: string;
  application: RateWindow[];
  methods: Record<string, RateWindow[]>;
  cooldownUntil: number;
  methodCooldowns: Record<string, number>;
};
type RatePair = { value: number; seconds: number };
const defaults: RatePair[] = [{ value: 15, seconds: 1 }, { value: 90, seconds: 120 }];

export function parseRateHeader(header: string | null): RatePair[] {
  if (!header || header.length > 1024) return [];
  const pairs = header.split(',').map(part => part.trim().match(/^(\d+):(\d+)$/));
  if (!pairs.length || pairs.length > 12 || pairs.some(pair => !pair)) return [];
  const values = pairs.map(pair => ({ value: Number(pair![1]), seconds: Number(pair![2]) }));
  if (values.some(pair => !Number.isSafeInteger(pair.value) || pair.value < 0 || pair.value > 1e9 || pair.seconds < 1 || pair.seconds > 86400)) return [];
  if (new Set(values.map(pair => pair.seconds)).size !== values.length) return [];
  return values;
}

/** Only fixed endpoint templates appear in Redis; no account or match IDs. */
export function riotMethod(path: string): string {
  const pathname = path.split('?')[0]!;
  if (pathname.startsWith('/riot/account/v1/accounts/by-riot-id/')) return 'account-by-riot-id';
  if (pathname.startsWith('/riot/account/v1/accounts/by-puuid/')) return 'account-by-puuid';
  if (/^\/lol\/match\/v5\/matches\/by-puuid\/[^/]+\/ids$/.test(pathname)) return 'match-history';
  if (/^\/lol\/match\/v5\/matches\/[^/]+\/timeline$/.test(pathname)) return 'match-timeline';
  if (/^\/lol\/match\/v5\/matches\/[^/]+$/.test(pathname)) return 'match-details';
  if (pathname.startsWith('/lol/league/v4/entries/by-puuid/')) return 'league-entries';
  return 'other';
}

function window(pair: RatePair, now: number): RateWindow {
  return { seconds: pair.seconds, limit: pair.value, count: 0, startedAt: now, resetAt: now + pair.seconds * 1000 + 1000 };
}
function active(value: RateWindow, now: number): RateWindow {
  return value.resetAt > now ? { ...value } : window({ value: value.limit, seconds: value.seconds }, now);
}
function initial(now: number): RiotBudget {
  return { revision: '', application: defaults.map(pair => window(pair, now)), methods: {}, cooldownUntil: 0, methodCooldowns: {} };
}

/** Pure transition; the caller commits it with an atomic Redis revision check. */
export function reserveRiotBudget(previous: RiotBudget | null, method: string, now: number): { state: RiotBudget; retry: number } {
  const source = previous ?? initial(now);
  const application = source.application.map(value => active(value, now));
  const methodWindows = (source.methods[method] ?? []).map(value => active(value, now));
  const state = { ...source, application, methods: { ...source.methods, [method]: methodWindows } };
  const resets = [source.cooldownUntil, source.methodCooldowns[method] ?? 0,
    ...[...application, ...methodWindows].filter(value => value.count >= value.limit).map(value => value.resetAt)];
  const retry = Math.max(0, Math.ceil((Math.max(...resets) - now) / 1000));
  if (!retry) for (const value of [...application, ...methodWindows]) value.count += 1;
  return { state, retry };
}

function observedWindows(previous: RateWindow[], limits: RatePair[], counts: RatePair[], now: number, requestedAt: number, fallback: RatePair[] = []): RateWindow[] {
  const validLimits = limits.filter(pair => pair.value > 0);
  if (!validLimits.length) return previous;
  const effective = new Map(fallback.map(pair => [pair.seconds, pair.value]));
  for (const pair of validLimits) {
    const headroom = Math.max(1, Math.floor(pair.value * 0.9));
    effective.set(pair.seconds, Math.min(effective.get(pair.seconds) ?? headroom, headroom));
  }
  return [...effective].map(([seconds, limit]) => {
    const old = previous.find(value => value.seconds === seconds);
    const value = old ? active(old, now) : window({ seconds, value: limit }, now);
    value.limit = limit;
    const observed = counts.find(pair => pair.seconds === seconds)?.value;
    // A response begun before this local window must not refill an expired one.
    if (observed != null && (!old || requestedAt >= value.startedAt) && observed > value.count) {
      value.count = observed;
      value.resetAt = Math.max(value.resetAt, now + seconds * 1000 + 1000);
    }
    return value;
  });
}

export function retryAfterSeconds(header: string | null, now: number): number {
  const seconds = header?.trim() && /^\d+(\.\d+)?$/.test(header.trim()) ? Number(header) : NaN;
  const date = header ? Date.parse(header) : NaN;
  const value = Number.isFinite(seconds) ? seconds : Number.isFinite(date) ? (date - now) / 1000 : 30;
  return Math.min(2147483647, Math.max(1, Math.ceil(value)));
}

export function observeRiotBudget(previous: RiotBudget | null, method: string, headers: Headers, status: number, now: number, requestedAt: number): RiotBudget {
  const source = previous ?? initial(now);
  const state = {
    ...source,
    application: observedWindows(source.application, parseRateHeader(headers.get('X-App-Rate-Limit')), parseRateHeader(headers.get('X-App-Rate-Limit-Count')), now, requestedAt, defaults),
    methods: { ...source.methods, [method]: observedWindows(source.methods[method] ?? [], parseRateHeader(headers.get('X-Method-Rate-Limit')), parseRateHeader(headers.get('X-Method-Rate-Limit-Count')), now, requestedAt) },
    methodCooldowns: { ...source.methodCooldowns },
  };
  if (status === 429) {
    const until = now + retryAfterSeconds(headers.get('Retry-After'), now) * 1000;
    if (headers.get('X-Rate-Limit-Type')?.toLowerCase() === 'method') {
      state.methodCooldowns[method] = Math.max(state.methodCooldowns[method] ?? 0, until);
    } else {
      // Application, service and unknown limits conservatively pause this host.
      state.cooldownUntil = Math.max(state.cooldownUntil, until);
    }
  }
  return state;
}
