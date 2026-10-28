import { describe, expect, it } from 'vitest';
import { observeRiotBudget, parseRateHeader, reserveRiotBudget, retryAfterSeconds, riotMethod, type RiotBudget } from '../../src/lib/player/riot-budget';

const now = 1793200000000;

describe('Riot regional budgets', () => {
  it('enforces the long window across short-window resets', () => {
    let state: RiotBudget | null = null;
    for (let index = 0; index < 90; index += 1) {
      const result = reserveRiotBudget(state, 'match-details', now + Math.floor(index / 10) * 2100);
      expect(result.retry).toBe(0);
      state = result.state;
    }
    const denied = reserveRiotBudget(state, 'account-by-puuid', now + 20000);
    expect(denied.retry).toBe(101);
    expect(denied.state.application.find(value => value.seconds === 120)?.count).toBe(90);
    expect(reserveRiotBudget(state, 'match-details', now + 121000).retry).toBe(0);
  });

  it('enforces a short burst without spending any other window on denial', () => {
    let state: RiotBudget | null = null;
    for (let index = 0; index < 15; index += 1) state = reserveRiotBudget(state, 'match-details', now).state;
    const result = reserveRiotBudget(state, 'match-history', now);
    expect(result.retry).toBe(2);
    expect(result.state.application.every(value => value.count === 15)).toBe(true);
  });

  it('learns stricter advertised application limits and already-consumed counts', () => {
    const initial = reserveRiotBudget(null, 'match-details', now).state;
    const learned = observeRiotBudget(initial, 'match-details', new Headers({
      'X-App-Rate-Limit': '10:1,50:120', 'X-App-Rate-Limit-Count': '1:1,44:120',
    }), 200, now + 100, now);
    expect(learned.application.find(value => value.seconds === 120)).toMatchObject({ limit: 45, count: 44 });
    const last = reserveRiotBudget(learned, 'match-history', now + 200);
    expect(last.retry).toBe(0);
    expect(reserveRiotBudget(last.state, 'match-details', now + 300).retry).toBeGreaterThan(100);
  });

  it('applies a method budget across IDs but keeps different endpoints independent', () => {
    const method = riotMethod('/lol/match/v5/matches/EUN1_100001');
    const state = observeRiotBudget(reserveRiotBudget(null, method, now).state, method, new Headers({
      'X-Method-Rate-Limit': '2:60', 'X-Method-Rate-Limit-Count': '1:60',
    }), 200, now + 20, now);
    expect(riotMethod('/lol/match/v5/matches/EUN1_999999')).toBe(method);
    expect(reserveRiotBudget(state, method, now + 100).retry).toBeGreaterThan(0);
    expect(reserveRiotBudget(state, riotMethod('/lol/match/v5/matches/EUN1_999999/timeline'), now + 100).retry).toBe(0);
    expect(riotMethod('/lol/match/v5/matches/by-puuid/private-player/ids?queue=450')).toBe('match-history');
  });

  it('does not lower counts when a slower response arrives with older usage', () => {
    const initial = reserveRiotBudget(null, 'match-details', now).state;
    const latest = observeRiotBudget(initial, 'match-details', new Headers({
      'X-App-Rate-Limit': '100:120', 'X-App-Rate-Limit-Count': '80:120',
    }), 200, now + 100, now);
    const delayed = observeRiotBudget(latest, 'match-details', new Headers({
      'X-App-Rate-Limit': '100:120', 'X-App-Rate-Limit-Count': '40:120',
    }), 200, now + 200, now);
    expect(delayed.application.find(value => value.seconds === 120)?.count).toBe(80);
  });

  it('does not refill a newly reset window with an earlier in-flight response', () => {
    const first = reserveRiotBudget(null, 'match-details', now).state;
    const fresh = reserveRiotBudget(first, 'match-details', now + 121001).state;
    const delayed = observeRiotBudget(fresh, 'match-details', new Headers({
      'X-App-Rate-Limit': '100:120', 'X-App-Rate-Limit-Count': '100:120',
    }), 200, now + 121100, now + 120900);
    expect(delayed.application.find(value => value.seconds === 120)?.count).toBe(1);
  });

  it('keeps method cooldowns scoped and unknown/service cooldowns shared', () => {
    const methodOnly = observeRiotBudget(null, 'match-details', new Headers({ 'Retry-After': '23', 'X-Rate-Limit-Type': 'method' }), 429, now, now);
    expect(reserveRiotBudget(methodOnly, 'match-details', now + 1000).retry).toBe(22);
    expect(reserveRiotBudget(methodOnly, 'match-history', now + 1000).retry).toBe(0);
    const service = observeRiotBudget(methodOnly, 'match-details', new Headers({ 'Retry-After': '41' }), 429, now, now);
    expect(reserveRiotBudget(service, 'account-by-puuid', now + 1000).retry).toBe(40);
    const shorter = observeRiotBudget(service, 'match-history', new Headers({ 'Retry-After': '2' }), 429, now + 1000, now);
    expect(shorter.cooldownUntil).toBe(service.cooldownUntil);
  });

  it('ignores malformed header sets without discarding conservative defaults', () => {
    for (const header of ['garbage', '-5:1', '100:0', '20:1,wat', '20:1,10:1', '100:999999', '1e6:1']) expect(parseRateHeader(header)).toEqual([]);
    expect(parseRateHeader('20:1,100:120')).toEqual([{ value: 20, seconds: 1 }, { value: 100, seconds: 120 }]);
    const state = observeRiotBudget(null, 'match-details', new Headers({ 'X-App-Rate-Limit': 'invalid' }), 200, now, now);
    expect(state.application.map(value => [value.limit, value.seconds])).toEqual([[15, 1], [90, 120]]);
  });

  it('preserves Retry-After seconds and handles dates or missing values safely', () => {
    expect(retryAfterSeconds('17', now)).toBe(17);
    expect(retryAfterSeconds('0.5', now)).toBe(1);
    expect(retryAfterSeconds(new Date(now + 45000).toUTCString(), now)).toBe(45);
    expect(retryAfterSeconds(null, now)).toBe(30);
    expect(retryAfterSeconds('invalid', now)).toBe(30);
  });
});
