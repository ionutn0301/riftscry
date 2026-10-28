import { describe, it, expect } from 'vitest';
import { buildJourneyModel } from '../../src/lib/voyage-data';
import { defaultVisit, archive, parseVisit, visitUrl } from '../../src/lib/investigation';
import { voyagePeriod, voyageSelection } from '../../src/lib/voyage-state';
import { deriveReturnBriefing } from '../../src/lib/return-briefing';

describe('archive growth', () => {
  it('keeps the advancing default tied to available archive endpoints', () => {
    expect(defaultVisit.newer).toBe(archive[0]!.id);
    expect(defaultVisit.older).toBe(archive[2]!.id);
  });
  it('appending a patch preserves historical records, selected IDs and shared findings', () => {
    const model = buildJourneyModel('Belveth')!;
    const historical = voyagePeriod(model, '26.14', '26.16');
    const selected = voyageSelection(historical.records)!;
    const grown = { ...model, archive: [{ id: '27.1', date: '2027-01-06' }, ...model.archive] };
    expect(voyagePeriod(grown, '26.14', '26.16')).toEqual(historical);
    const visit = { ...defaultVisit, champion: 'Belveth', older: '26.14', newer: '26.16', event: selected.id, seen: selected.id };
    expect(parseVisit(visitUrl(visit).split('?')[1]!)).toMatchObject({ event: selected.id, seen: selected.id });
    expect(voyageSelection(voyagePeriod(grown, '26.14', '26.16').records, '', selected.id)?.id).toBe(selected.id);
  });
  it('return briefing retains earlier relevant changes when newest patch is quiet', () => {
    const patches = [{ id: '26.16', date: '2026-08-11', championIds: ['Alistar'] }, { id: '26.15', date: '2026-07-28', championIds: [] }];
    const grown = [{ id: '26.17', date: '2026-08-25', championIds: [] }, ...patches];
    const result = deriveReturnBriefing(grown, ['Alistar'], '26.15');
    expect(result.mode).toBe('new-records');
    expect(result.relevantPatches.map((patch) => patch.id)).toEqual(['26.16']);
  });
});
