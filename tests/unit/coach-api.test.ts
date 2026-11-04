import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/player/server', () => ({ limit: vi.fn(), getMatch: vi.fn(), getTimeline: vi.fn(),
  ServiceError: class ServiceError extends Error { constructor(message: string, public status = 503, public retry = 0, public scope?: 'player' | 'review') { super(message); } } }));
vi.mock('../../src/lib/player/metadata', () => ({ getItemMetadata: vi.fn() }));
vi.mock('../../src/lib/account/server', () => ({ requireAccount: vi.fn() }));
vi.mock('../../src/lib/player/coach', () => ({ coach: vi.fn(), coachEvidence: vi.fn() }));
import { ALL } from '../../src/pages/api/coach';
import { requireAccount } from '../../src/lib/account/server';
import { coach, coachEvidence } from '../../src/lib/player/coach';
import { getMatch, getTimeline, limit, ServiceError } from '../../src/lib/player/server';
import { sourceMatch, historicalMatch, puuid, platform } from '../player-e2e/fixtures';
const body = () => ({ platform, puuid, matchIds: [historicalMatch.metadata.matchId, sourceMatch.metadata.matchId] });
async function request(input: unknown = body(), method = 'POST', origin = 'https://example.test') {
  const url = new URL('https://example.test/api/coach');
  return await ALL({ url, clientAddress: '127.0.0.1', request: new Request(url, { method, headers: { origin }, ...(method === 'POST' ? { body: JSON.stringify(input) } : {}) }) } as Parameters<typeof ALL>[0]) as Response;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(requireAccount).mockResolvedValue('alice');
  vi.mocked(getMatch).mockImplementation(async (_platform, id) => id === sourceMatch.metadata.matchId ? sourceMatch : historicalMatch);
  vi.mocked(coach).mockResolvedValue({ mode: 'ai' } as Awaited<ReturnType<typeof coach>>);
});
it('verifies account and same-origin POST before any match or model work', async () => {
  expect((await request(body(), 'GET')).status).toBe(405);
  expect((await request(body(), 'POST', 'https://elsewhere.test')).status).toBe(403);
  expect(requireAccount).not.toHaveBeenCalled();
  vi.mocked(requireAccount).mockRejectedValue(new ServiceError('Sign in', 401));
  expect((await request()).status).toBe(401);
  for (const fn of [getMatch, getTimeline, coach, limit]) expect(fn).not.toHaveBeenCalled();
});
it.each([{ ...body(), facts: ['untrusted'] }, { ...body(), matchIds: ['../escape'] }, { ...body(), question: 'x'.repeat(401) }, { ...body(), matchIds: Array(4).fill(sourceMatch.metadata.matchId) }])('rejects untrusted context and unbounded inputs', async input => {
  expect((await request(input)).status).toBe(400); expect(getMatch).not.toHaveBeenCalled();
});
it('rejects an oversized payload before record reads', async () => {
  expect((await request({ ...body(), question: 'x'.repeat(3000) })).status).toBe(413); expect(getMatch).not.toHaveBeenCalled();
});
it('derives evidence server-side and leaves cache hits uncharged', async () => {
  const response = await request(); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(coachEvidence).toHaveBeenCalledWith([historicalMatch, sourceMatch], puuid, platform, undefined, undefined);
  expect(limit).not.toHaveBeenCalled();
});
it('retains a primary game when optional sources fail, and skips newer context', async () => {
  vi.mocked(getTimeline).mockRejectedValue(new Error('Missing timeline'));
  expect((await request({ ...body(), matchIds: [sourceMatch.metadata.matchId, historicalMatch.metadata.matchId] })).status).toBe(200);
  expect(coachEvidence).toHaveBeenCalledWith([sourceMatch], puuid, platform, undefined, undefined);
});
it('rejects a player absent from the primary game', async () => {
  expect((await request({ ...body(), puuid: 'another-player-00000000000000000000' })).status).toBe(404);
  expect(coach).not.toHaveBeenCalled();
});
it('enforces both client and verified-owner generation quotas with retry metadata', async () => {
  vi.mocked(coach).mockImplementation(async (_context, _question, before) => { await before!(); throw new Error('should not generate'); });
  vi.mocked(limit).mockImplementation(async key => { if (key === 'account:alice') throw new ServiceError('Wait for AI', 429, 42, 'review'); });
  const response = await request(); expect(response.status).toBe(429);
  expect(limit).toHaveBeenNthCalledWith(1, '127.0.0.1', true);
  expect(limit).toHaveBeenNthCalledWith(2, 'account:alice', true);
  expect(response.headers.get('retry-after')).toBe('42'); expect(response.headers.get('x-ratelimit-scope')).toBe('review');
});
