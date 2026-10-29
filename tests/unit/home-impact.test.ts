import { describe, expect, it } from 'vitest';
import { homeImpactExample } from '../../src/lib/home-impact';

describe('source-backed homepage impact example', () => {
  it('calculates the displayed example with the production engine and pinned Riot references', () => {
    const { report } = homeImpactExample;
    expect(report.sourceMatchId).toBe('homepage-reference-scenario');
    expect(report.sourcePatch).toBe('26.20');
    expect(report.targetPatch).toBe('26.21');
    expect(report.inventory.map(item => item.id)).toEqual([3152, 4628]);
    // Riot lists 60 + 75 AP on the example items; Orianna Q scales 55% → 60%.
    expect(report.metrics.find(metric => metric.id.includes('Orianna:Q:'))).toMatchObject({
      kind: 'damage', before: 74.25, after: 81, delta: 6.75,
    });
    // W independently scales 80% → 85% on the same 135 listed AP.
    expect(report.metrics.find(metric => metric.id.includes('Orianna:W:'))).toMatchObject({
      kind: 'damage', before: 108, after: 114.75, delta: 6.75,
    });
    expect(report.sources.some(source => source.url.endsWith('league-of-legends-patch-26-21-notes/'))).toBe(true);
  });
});
