import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('ai', () => ({ generateText: vi.fn(), Output: { object: vi.fn(value => value) } }));
vi.mock('../../src/lib/player/server', () => ({ cached: vi.fn((_key, _ttl, fn) => fn()) }));
import { generateText } from 'ai';
import { groundedSections, review, selectReviewFacts } from '../../src/lib/player/review';
import type { Fact } from '../../src/lib/player/contracts';

const facts: Fact[] = [
  { id: 'result', kind: 'result', text: 'Jhin won a 20-minute match.' },
  { id: 'farm', kind: 'farm', text: '160 lane minions and no neutral monster kills.' },
  { id: 'inventory', kind: 'inventory', text: 'Boots of Swiftness in final inventory.' },
];
const output = { sections: Array.from({ length: 4 }, (_, index) => ({ index, text: 'Recorded match interpretation tied to this evidence.', evidence: [index === 2 ? 'inventory' : 'result'] })) };
beforeEach(() => vi.clearAllMocks());

describe('review grounding', () => {
  it('rejects unknown evidence and duplicate section indices', () => {
    expect(() => groundedSections({ sections: output.sections.map(s => ({ ...s, evidence: ['imagined-event'] })) }, facts)).toThrow();
    expect(() => groundedSections({ sections: output.sections.map(s => ({ ...s, index: 0 })) }, facts)).toThrow();
    expect(groundedSections(output, facts)).toHaveLength(4);
  });

  it('rejects quantitative claims not present in the section evidence', () => {
    const unsupported = { sections: output.sections.map((s, i) => i === 0 ? { ...s, text: 'You recorded 75% participation in this match.' } : s) };
    expect(() => groundedSections(unsupported, facts)).toThrow('Unsupported quantitative claim');
    const supported = { sections: output.sections.map((s, i) => i === 0 ? { ...s, text: 'This recorded match lasted 20 minutes.' } : s) };
    expect(groundedSections(supported, facts)).toHaveLength(4);
  });

  it('samples the whole timeline including late moments while preserving summaries', () => {
    const events: Fact[] = Array.from({ length: 200 }, (_, i) => ({ id: `event-${i}`, kind: i % 11 === 0 ? 'death' : 'item', timestamp: i * 1000, text: `Recorded event ${i}.` }));
    const selected = selectReviewFacts([...facts, ...events]);
    expect(selected.length).toBeLessThanOrEqual(64);
    expect(selected.some(f => f.id === 'result')).toBe(true);
    expect(selected.some(f => f.id === 'event-199')).toBe(true);
    expect(selected.some(f => f.id === 'event-198')).toBe(true);
    expect(new Set(selected.map(f => f.id)).size).toBe(selected.length);
  });

  it('returns a labeled successful interpretation with validated evidence', async () => {
    vi.mocked(generateText).mockResolvedValue({ output } as Awaited<ReturnType<typeof generateText>>);
    const result = await review(facts);
    expect(result.mode).toBe('ai');
    expect(result.sections[2]?.text).toBe(output.sections[2]?.text);
    expect(result.notice).toContain('AI interpretation');
  });

  it('keeps the deterministic review when generation fails or evidence is fabricated', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Gateway unavailable'));
    expect((await review(facts)).mode).toBe('deterministic');
    vi.mocked(generateText).mockResolvedValueOnce({ output: { sections: output.sections.map(s => ({ ...s, evidence: ['fake'] })) } } as Awaited<ReturnType<typeof generateText>>);
    const result = await review(facts);
    expect(result.mode).toBe('deterministic');
    expect(result.facts).toEqual(facts);
  });
});
