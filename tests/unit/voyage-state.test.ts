import { describe, expect, it } from 'vitest';
import { getAllPatches, getChampionMeta } from '../../src/lib/data';
import { buildJourneyModel, journeyRoster } from '../../src/lib/voyage-data';
import {
  normalizeChampionName,
  recordText,
  voyageConnection,
  voyageFields,
  voyagePeriod,
  voyageSelection,
  type JourneyRecord,
} from '../../src/lib/voyage-state';

const identities = journeyRoster();
const models = identities.map((identity) => buildJourneyModel(identity.id)!);
const patches = getAllPatches();
const belveth = buildJourneyModel('Belveth')!;

// Compare semantic patch numbers independently of the model's array order.
function patchOrder(left: string, right: string) {
  const [leftSeason = 0, leftRelease = 0] = left.split('.').map(Number);
  const [rightSeason = 0, rightRelease = 0] = right.split('.').map(Number);
  return leftSeason - rightSeason || leftRelease - rightRelease;
}

describe('voyage period and evidence contract', () => {
  it('includes exactly (older, newer] for every valid interval of every canonical champion', () => {
    expect(identities.map((identity) => identity.id).sort()).toEqual(Object.keys(getChampionMeta()).sort());
    for (const model of models) {
      for (const older of model.archive) {
        for (const newer of model.archive) {
          if (patchOrder(older.id, newer.id) >= 0) continue;
          const actual = voyagePeriod(model, older.id, newer.id);
          const expected = model.records.filter((record) => patchOrder(record.patch, older.id) > 0 && patchOrder(record.patch, newer.id) <= 0);
          const includedPatches = model.archive.filter((patch) => patchOrder(patch.id, older.id) > 0 && patchOrder(patch.id, newer.id) <= 0);
          expect(actual.valid).toBe(true);
          expect(actual.records).toEqual(expected);
          expect(actual.patchCount).toBe(includedPatches.length);
          expect(actual.records.some((record) => record.patch === older.id)).toBe(false);
          expect(actual.records.filter((record) => record.patch === newer.id)).toEqual(model.records.filter((record) => record.patch === newer.id));
        }
      }
    }
  });

  it('rejects every reversed or equal interval and unknown endpoints without leaking records', () => {
    for (const model of models) {
      for (const older of model.archive) {
        for (const newer of model.archive) {
          if (patchOrder(older.id, newer.id) < 0) continue;
          expect(voyagePeriod(model, older.id, newer.id)).toEqual({ valid: false, records: [], patchCount: 0 });
        }
        expect(voyagePeriod(model, 'unknown', older.id)).toEqual({ valid: false, records: [], patchCount: 0 });
        expect(voyagePeriod(model, older.id, 'unknown')).toEqual({ valid: false, records: [], patchCount: 0 });
      }
      expect(voyagePeriod(model, '', '')).toEqual({ valid: false, records: [], patchCount: 0 });
    }
    expect(buildJourneyModel('not-a-champion')).toBeNull();
  });

  it('retains the exact original numeric, rank-array, prose, date, ability, and source records', () => {
    let ranked = 0;
    let prose = 0;
    for (const model of models) {
      const expected = patches.flatMap((patch) => patch.champions
        .filter((champion) => champion.championId === model.identity.id)
        .flatMap((champion) => champion.abilities.flatMap((ability) => ability.changes.map((change) => ({
          patch: patch.id, date: patch.releaseDate, source: patch.sourceUrl,
          ability: ability.ability, abilityName: ability.name, change,
        })))));
      const actual = model.records.map(({ patch, date, source, ability, abilityName, change }) => ({ patch, date, source, ability, abilityName, change }));
      expect(actual.map((record) => JSON.stringify(record)).sort()).toEqual(expected.map((record) => JSON.stringify(record)).sort());
      for (const record of model.records) {
        if (record.change.kind === 'prose') {
          prose += 1;
          expect(recordText(record)).toBe(record.change.text);
        } else {
          if (record.change.before.includes('/') || record.change.after.includes('/')) ranked += 1;
          expect(recordText(record)).toContain(record.change.before);
          expect(recordText(record)).toContain(record.change.after);
        }
      }
    }
    expect(ranked).toBeGreaterThan(0);
    expect(prose).toBeGreaterThan(0);
  });

  it('preserves mixed ranks, conditions, complete prose and optional units in reading text', () => {
    const attackSpeed = belveth.records.find((record) => record.patch === '26.16' && record.change.label === 'True Form Total Attack Speed')!;
    expect(recordText(attackSpeed)).toBe('5 / 15 / 25% → 6 / 13 / 20%');
    const azir = buildJourneyModel('Azir')!.records.find((record) => record.patch === '26.16' && record.change.label === 'Damage')!;
    expect(recordText(azir)).toBe('60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP) → 75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)');
    const remora = belveth.records.find((record) => record.patch === '26.16' && record.change.label === 'True Form Remora Indicator')!;
    expect(recordText(remora)).toBe('Resource bar now turns purple when True Form can spawn Remora');

    // The current archive embeds units in source strings. Exercise the optional
    // structured unit separately so a future ingest cannot silently discard it.
    const withUnit: JourneyRecord = {
      ...attackSpeed,
      change: { kind: 'numeric', label: 'Cooldown', before: '12 / 10 / 8', after: '11 / 9 / 7', unit: 'seconds (per rank)', direction: 'buff' },
    };
    expect(recordText(withUnit)).toBe('12 / 10 / 8 → 11 / 9 / 7 seconds (per rank)');
  });
});

describe('voyage field and record selection', () => {
  const records = voyagePeriod(belveth, '26.14', '26.16').records;
  const health = records.filter((record) => record.change.label === 'Health Growth');
  const remora = records.find((record) => record.change.label === 'True Form Remora Indicator')!;

  it('prefers a repeated same-field history over an unrelated first record', () => {
    expect(health).toHaveLength(2);
    const choices = [remora, ...health];
    expect(voyageSelection(choices)).toBe(health[0]);
    expect(voyageSelection(choices, 'unknown-field')).toBe(health[0]);
    expect(voyageSelection([remora])).toBe(remora);
    expect(voyageSelection([])).toBeUndefined();
  });

  it('deduplicates matching fields without merging different changes from one ability', () => {
    const fields = voyageFields(records);
    expect(fields.filter((record) => record.field === health[0]!.field)).toHaveLength(1);
    const ultimateFields = fields.filter((record) => record.ability === 'R');
    expect(ultimateFields.some((record) => record.change.label === 'True Form Total Attack Speed')).toBe(true);
    expect(ultimateFields.some((record) => record.change.label === 'True Form Remora Indicator')).toBe(true);
    expect(new Set(fields.map((record) => record.field)).size).toBe(fields.length);
    expect(voyageFields([])).toEqual([]);
  });

  it('honors a requested exact field or ability and lets an in-scope event take priority', () => {
    expect(voyageSelection(records, remora.field)).toBe(remora);
    expect(voyageSelection(records, 'R')).toBe(records.find((record) => record.ability === 'R'));
    expect(voyageSelection(records, health[0]!.field, remora.id)).toBe(remora);
    expect(voyageSelection(records, '', health[1]!.id)).toBe(health[1]);
  });

  it('cannot restore an event from outside the selected interval or another champion', () => {
    const outside = belveth.records.find((record) => !records.some((included) => included.id === record.id))!;
    const foreign = buildJourneyModel('Azir')!.records[0]!;
    expect(outside).toBeDefined();
    for (const event of [outside.id, foreign.id, 'missing-event']) {
      expect(voyageSelection(records, remora.field, event)).toBe(remora);
      expect(voyageSelection(records, health[0]!.field, event)).toBe(health[0]);
    }
    expect(voyageSelection([], remora.field, remora.id)).toBeUndefined();
  });
});

describe('champion display-name matching', () => {
  it.each([
    ["Bel'Veth", 'belveth'], ['Bél’Vèth', 'belveth'], ['  Dr. Mundo  ', 'drmundo'],
    ['Nunu & Willump', 'nunuwillump'], ['Renata Glasc', 'renataglasc'], ['Wukong', 'wukong'],
    ['AURELION SOL', 'aurelionsol'], ['Ｋａｉ’Ｓａ', 'kaisa'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeChampionName(input)).toBe(expected);
  });

  it('finds every canonical champion by their full display name, including names unlike their ids', () => {
    for (const identity of identities) {
      const query = normalizeChampionName(identity.name);
      expect(query).not.toBe('');
      expect(identities.filter((candidate) => normalizeChampionName(candidate.name) === query).map((candidate) => candidate.id)).toEqual([identity.id]);
    }
    expect(identities.find((identity) => normalizeChampionName(identity.name) === 'wukong')?.id).toBe('MonkeyKing');
    expect(identities.find((identity) => normalizeChampionName(identity.name) === 'nunuwillump')?.id).toBe('Nunu');
    expect(identities.find((identity) => normalizeChampionName(identity.name) === 'renataglasc')?.id).toBe('Renata');
  });
});

describe('voyage source connections', () => {
  const health = belveth.records.filter((record) => ['26.15', '26.16'].includes(record.patch) && record.change.label === 'Health Growth');
  const first = health[0]!;
  const last = health[1]!;
  const numeric = (record: JourneyRecord, before: string, after: string, unit?: string): JourneyRecord => ({
    ...record,
    change: { kind: 'numeric', label: record.change.label, before, after, direction: 'neutral', ...(unit ? { unit } : {}) },
  });

  it('has an empty state and explains the limit of a single source record', () => {
    expect(voyageConnection([])).toBe('');
    expect(voyageConnection([first])).toContain('One recorded change');
    expect(voyageConnection([first])).toContain('cannot establish');
  });

  it('connects actual Belveth health records and limits the return finding to that field', () => {
    expect(health).toHaveLength(2);
    const before = JSON.stringify(health);
    const explanation = voyageConnection(health);
    expect(explanation).toContain('Health Growth');
    expect(explanation).toContain('returned to their starting values');
    expect(explanation).toContain('26.15–26.16');
    expect(explanation).toContain('this field only, not the champion’s overall strength');
    expect(voyageConnection([...health].reverse())).toBe(explanation);
    expect(JSON.stringify(health)).toBe(before);
  });

  it('describes a continuous trail without inventing a return when the ending value differs', () => {
    const explanation = voyageConnection([numeric(first, '105', '110'), numeric(last, '110', '108')]);
    expect(explanation).toContain('continuous trail');
    expect(explanation.includes('returned')).toBe(false);
    expect(explanation).toContain('recorded field only');
  });

  it('compares complete rank strings and permits whitespace normalization without arithmetic', () => {
    const ranks = [numeric(first, '5 / 15 / 25%', '6 / 13 / 20%'), numeric(last, ' 6 / 13 / 20% ', '5 / 15 / 25%')];
    expect(voyageConnection(ranks)).toContain('returned to their starting values');
    const differentNotation = [numeric(first, '105', '110'), numeric(last, '110.0', '105')];
    expect(voyageConnection(differentNotation)).toContain('does not exactly match');
  });

  it('does not infer continuity across patch gaps, duplicate patches, invalid dates or reversed chronology', () => {
    const invalid: JourneyRecord[] = [
      { ...last, patch: '26.17' },
      { ...last, patch: first.patch },
      { ...last, patch: '27.1' },
      { ...last, patch: 'unknown' },
      { ...last, date: first.date },
      { ...last, date: 'invalid-date' },
      { ...last, date: '2020-01-01' },
    ];
    for (const record of invalid) expect(voyageConnection([first, record])).toContain('continuity across the gap is not established');
  });

  it('rejects different fields, units, conditions and mismatched intermediate values', () => {
    expect(voyageConnection([first, { ...last, field: 'another-field' }])).toContain('different fields');
    expect(voyageConnection([numeric(first, '105', '110', 'per level'), numeric(last, '110', '105', 'per second')])).toContain('units or conditions differ');
    expect(voyageConnection([numeric(first, '105', '110 against champions'), numeric(last, '110 against monsters', '105')])).toContain('does not exactly match');
    expect(voyageConnection([numeric(first, '105', '110'), numeric(last, '109', '105')])).toContain('does not exactly match');
  });

  it('keeps prose and mixed records as source-wording explanations', () => {
    const prose: JourneyRecord = { ...last, change: { kind: 'prose', label: last.change.label, text: 'Source rule wording.' } };
    expect(voyageConnection([first, prose])).toContain('no numeric continuity is inferred');
    expect(voyageConnection([{ ...prose, patch: first.patch, date: first.date }, prose])).toContain('complete source wording');
    expect(voyageConnection([prose])).toContain('One recorded change');
  });
});
