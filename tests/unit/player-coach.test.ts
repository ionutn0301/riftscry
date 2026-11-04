import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/ai/runtime', async original => ({ ...await original<typeof import('../../src/lib/ai/runtime')>(), structuredAI: vi.fn() }));
vi.mock('../../src/lib/player/server', () => ({ cached: vi.fn() }));
import { structuredAI } from '../../src/lib/ai/runtime';
import { cached } from '../../src/lib/player/server';
import { coach, coachEvidence, validateCoachOutput } from '../../src/lib/player/coach';
import { coachReportSchema } from '../../src/lib/player/coach-contracts';
import { sourceMatch, historicalMatch, puuid, platform, timeline, itemMetadata } from '../player-e2e/fixtures';
import type { Patch } from '../../src/lib/schema';

const patch: Patch = { schemaVersion: 1, id: '26.22', assetVersion: '16.22.1', releaseDate: '2026-11-03', ingestedAt: '2026-11-03', sourceUrl: 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/',
  champions: [{ championId: 'Ahri', classification: 'adjustment', abilities: [{ ability: 'Q', name: 'Orb of Deception', changes: [{ kind: 'numeric', label: 'Cooldown', before: '8', after: '9', direction: 'nerf' }] }] }], items: [], systems: [] };
const context = () => coachEvidence([historicalMatch, sourceMatch], puuid, platform, timeline, itemMetadata, patch);
const output = () => ({
  focus: { title: 'Inspect the recorded game', explanation: 'The recorded game offers a starting point for a replay question.', next: 'Notice which information you used for your next decision.', evidence: ['match-result'] },
  patch: { title: 'Notice the cooldown change', explanation: 'The recorded cooldown changed from 8 to 9. This could affect how often the ability is available.', next: 'Notice when you are waiting for the ability to return.', evidence: ['patch-champion-0'] },
  review: { title: 'Review one recorded decision', explanation: 'The match record gives an outcome, but it does not explain what caused it.', next: 'Inspect a decision in the replay to recover its context.', evidence: ['match-result'] }, answer: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cached).mockImplementation(async (_key, _ttl, generate) => generate());
  vi.mocked(structuredAI).mockResolvedValue(output());
});
describe('evidence-led automatic coach', () => {
  it('uses direct patch deltas, replay links and comparable prior records', () => {
    const value = context();
    expect(value.facts.find(f => f.id === 'patch-champion-0')?.text).toContain('8 → 9');
    expect(value.facts.find(f => f.id === 'match-result')?.href).toContain('#fact-result');
    expect(value.facts.find(f => f.id === 'prior-0')?.text).toContain('Same champion, queue, role and patch');
    expect(new Set(value.facts.map(f => f.id)).size).toBe(value.facts.length);
  });
  it.each(['champion', 'queue', 'role', 'patch'])('does not compare a different %s', field => {
    const prior = structuredClone(sourceMatch);
    if (field === 'champion') prior.info.participants[0]!.championName = 'Riven';
    if (field === 'queue') prior.info.queueId = 450;
    if (field === 'role') prior.info.participants[0]!.teamPosition = 'TOP';
    if (field === 'patch') prior.info.gameVersion = '16.20.1';
    expect(coachEvidence([historicalMatch, prior], puuid, platform, undefined, undefined, patch).facts.find(f => f.id === 'prior-0')?.text).toContain('do not compare performance');
  });
  it('does not equate missing direct changes with an unaffected champion', () => {
    const facts = coachEvidence([sourceMatch], puuid, platform, undefined, undefined, { ...patch, champions: [] }).facts;
    expect(facts.find(f => f.id === 'patch-champion-none')?.text).toContain('may still matter');
  });
  it('rejects invented citations, numbers and patch prose without patch evidence', () => {
    const facts = context().facts;
    expect(validateCoachOutput(output(), facts)).toEqual(output());
    const fake = output(); fake.focus.evidence = ['made-up'];
    expect(() => validateCoachOutput(fake, facts)).toThrow('Unsupported evidence');
    const number = output(); number.patch.explanation = 'Your win rate will increase by 99.999 percent.';
    expect(() => validateCoachOutput(number, facts)).toThrow('Unsupported quantitative');
    const noPatch = output(); noPatch.patch = noPatch.focus;
    expect(() => validateCoachOutput(noPatch, facts)).toThrow('Patch explanation needs patch evidence');
  });
  it('validates the full response, spends allowance only for generation, and omits identity from model input', async () => {
    vi.mocked(structuredAI).mockResolvedValue({ ...output(), answer: { text: 'Notice the recorded cooldown change before your next game.', evidence: ['patch-champion-0'] } });
    const before = vi.fn(); const result = await coach(context(), 'What should I notice?', before);
    expect(coachReportSchema.parse(result).mode).toBe('ai');
    expect(before).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(structuredAI).mock.calls[0]![1])).not.toContain(puuid);
    expect(String(vi.mocked(structuredAI).mock.calls[0]![2])).toContain('untrusted data');
    expect(String(vi.mocked(structuredAI).mock.calls[0]![2])).toContain('Do not dictate real-time');
  });
  it('does not spend generation budget again for a cached response', async () => {
    vi.mocked(cached).mockResolvedValue(output()); const before = vi.fn();
    expect((await coach(context(), '', before)).mode).toBe('ai');
    expect(before).not.toHaveBeenCalled(); expect(structuredAI).not.toHaveBeenCalled();
  });
  it('labels unavailable or invalid AI as recorded facts, including an empty patch entry', async () => {
    vi.mocked(structuredAI).mockRejectedValue(new Error('Provider unavailable'));
    const empty = coachEvidence([sourceMatch], puuid, platform, undefined, undefined, { ...patch, champions: [{ championId: 'Ahri', classification: 'adjustment', abilities: [] }] });
    const result = await coach(empty, 'Why?');
    expect(coachReportSchema.parse(result).mode).toBe('recorded');
    expect(result.notice).toContain('not AI advice');
    expect(result.patch.evidence).toEqual(['patch-context']);
    expect(result.answer?.text).toContain('could not answer');
  });
  it('preserves quota errors instead of disguising them as successful AI', async () => {
    const denied = Object.assign(new Error('Retry later'), { status: 429 });
    await expect(coach(context(), '', async () => { throw denied; })).rejects.toBe(denied);
    expect(structuredAI).not.toHaveBeenCalled();
  });
});
