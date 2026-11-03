import { describe, expect, it } from 'vitest';
import { buildFirstResult, type FirstResultOptions } from '../../src/lib/player/first-result';
import type { Match, Participant } from '../../src/lib/player/contracts';

const puuid = 'first-result-player-0000000000000000000000';
const now = Date.UTC(2026, 10, 3, 12);
const hour = 3_600_000;
const player: Participant = {
  puuid, participantId: 1, teamId: 100, championName: 'Ahri', teamPosition: 'MIDDLE', win: true,
  kills: 6, deaths: 2, assists: 9, totalMinionsKilled: 150, neutralMinionsKilled: 30,
  goldEarned: 12000, totalDamageDealtToChampions: 25000, visionScore: 42,
  item0: 1001, item1: 1052, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
function game(index = 1, changes: Partial<Participant> = {}, info: Partial<Match['info']> = {}): Match {
  return {
    metadata: { matchId: `EUW1_${10000 + index}` },
    info: {
      gameCreation: now - index * hour, gameDuration: 1800, gameVersion: '16.21.1',
      queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11,
      participants: [{ ...player, ...changes }, ...Array.from({ length: 4 }, (_, i) => ({ ...player, puuid: `teammate-${i}`, participantId: i + 2 }))],
      ...info,
    },
  };
}
const aram = (index = 1, changes: Partial<Participant> = {}, info: Partial<Match['info']> = {}) => game(index, { teamPosition: '', ...changes }, { queueId: 450, gameMode: 'ARAM', mapId: 12, ...info });
const run = (matches: Match[], options: FirstResultOptions = {}) => buildFirstResult(matches, puuid, { now, available: new Set(matches.map(match => match.metadata.matchId)).size, ...options });

describe('first result from one recorded game', () => {
  it.each(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM'])('gives a whole-game farm observation for a known %s role without needing a baseline', teamPosition => {
    const result = run([game(1, { teamPosition })]);
    expect(result.insight).toMatchObject({ kind: 'farm', metric: { label: 'CS per minute', value: 6, unit: 'per-minute' }, facts: { result: 'win', durationSeconds: 1800 } });
    expect(result.sample).toMatchObject({ status: 'ready', loaded: 1, complete: true });
    expect(result.insight?.limitation).toContain('whole-match');
  });

  it('gives support vision without treating support minion counts as a farming goal', () => {
    const result = run([game(1, { teamPosition: 'UTILITY', totalMinionsKilled: 0, neutralMinionsKilled: 0 })]);
    expect(result.insight).toMatchObject({ kind: 'vision', roleLabel: 'Support', metric: { value: 1.4, unit: 'per-minute' } });
    expect(result.insight?.action).toContain('vision');
  });

  it.each([400, 440, 490, 700])('supports exact unranked/ranked queue %s without asking for rank', queueId => {
    const result = run([game(1, {}, { queueId })]);
    expect(result.insight?.kind).toBe('farm');
    expect(result.contexts.map(context => context.queueId)).toEqual([queueId]);
  });

  it('keeps Swiftplay in its own validated ruleset', () => {
    const result = run([game(1, {}, { queueId: 480, gameMode: 'SWIFTPLAY' })]);
    expect(result.insight).toMatchObject({ queueId: 480, kind: 'farm' });
    expect(run([game(1, {}, { queueId: 480, gameMode: 'CLASSIC' })]).insight?.kind).toBe('record');
  });

  it('gives an exact ARAM involvement fraction without repeated champions or a personal performance comparison', () => {
    const result = run([aram(1), aram(2, { championName: 'Jinx' }), aram(3, { championName: 'Ashe' })]);
    expect(result.insight).toMatchObject({ champion: 'Ahri', queueId: 450, kind: 'participation', metric: { value: 50, numerator: 15, denominator: 30, unit: 'percent' } });
    expect(result.contexts[0]).toMatchObject({ queueId: 450, count: 3, champions: [{ id: 'Ahri', count: 1 }, { id: 'Jinx', count: 1 }, { id: 'Ashe', count: 1 }] });
  });

  it('keeps ARAM Clash separate and factual Mayhem records separate from ordinary ARAM coaching', () => {
    expect(run([aram(1, {}, { queueId: 720 })]).insight).toMatchObject({ queueId: 720, kind: 'participation' });
    const mayhem = run([aram(1, {}, { queueId: 2400 })]);
    expect(mayhem.insight).toMatchObject({ queueId: 2400, kind: 'record' });
    expect(mayhem.insight?.metric).toBeUndefined();
  });

  it('can use valid participation when a known role’s primary measurement is absent', () => {
    const carry = run([game(1, { totalMinionsKilled: undefined })]);
    const support = run([game(1, { teamPosition: 'UTILITY', visionScore: undefined })]);
    expect(carry.insight?.kind).toBe('participation');
    expect(support.insight?.kind).toBe('participation');
    expect(carry.insight?.metric?.value).toBe(50);
  });

  it('retains known zero values, unknown outcomes and duplicate inventory quantities accurately', () => {
    const match = game(1, { kills: 0, deaths: 0, assists: 0, win: undefined, totalMinionsKilled: 0, neutralMinionsKilled: 0, item0: 1001, item1: 1001, item6: 0 });
    const result = run([match]);
    expect(result.insight?.facts).toEqual({ kills: 0, deaths: 0, assists: 0, result: 'unknown', durationSeconds: 1800, itemIds: [1001, 1001] });
    expect(result.insight?.metric?.value).toBe(0);
    expect(result.insight?.limitation).toContain('outcome is unavailable');
  });
});

describe('safe factual fallback', () => {
  it.each([
    { queueId: 1700, gameMode: 'CHERRY', mapId: 30 },
    { queueId: 1710, gameMode: 'CHERRY', mapId: 30 },
    { queueId: 900, gameMode: 'URF', mapId: 11 },
    { queueId: 2300, gameMode: 'BRAWL', mapId: 35 },
  ])('shows known facts for a newest alternative mode %j instead of older Rift advice', info => {
    const latest = game(1, { championName: 'Jinx' }, info);
    const result = run([game(2), latest]);
    expect(result.insight).toMatchObject({ sourceMatch: latest, champion: 'Jinx', kind: 'record', facts: { kills: 6, deaths: 2, assists: 9, durationSeconds: 1800 } });
    expect(result.insight?.metric).toBeUndefined();
  });

  it('never infers Arena placement from its recorded win flag', () => {
    const result = run([game(1, {}, { queueId: 1700, gameMode: 'CHERRY', mapId: 30 })]);
    expect(result.insight?.facts.result).toBe('win');
    expect(result.insight?.limitation).toContain('not an inferred placement');
  });

  it.each([
    { queueId: 420, gameMode: 'ARAM', mapId: 12 },
    { queueId: 450, gameMode: 'CLASSIC', mapId: 11 },
    { queueId: 450, gameMode: 'ARAM', mapId: 30 },
  ])('does not coach contradictory queue/map context %j', info => {
    const result = run([game(1, {}, info), game(2)]);
    expect(result.insight?.sourceMatch.metadata.matchId).toBe('EUW1_10001');
    expect(result.insight?.kind).toBe('record');
    expect(result.insight?.limitation).toContain('context');
  });

  it('keeps an unknown role factual even if team participation is numerically available', () => {
    const result = run([game(1, { teamPosition: '' }), game(2)]);
    expect(result.insight?.kind).toBe('record');
    expect(result.insight?.metric).toBeUndefined();
    expect(result.insight?.limitation).toContain('role is unknown');
  });

  it('keeps short games and explicit remakes factual without rate advice', () => {
    const short = game(1, {}, { gameDuration: 200 });
    const remake = game(1);
    Object.assign(remake.info.participants[0]!, { gameEndedInEarlySurrender: true });
    const oldShape = game(1);
    Object.assign(oldShape.info, { gameEndedInEarlySurrender: true });
    for (const match of [short, remake, oldShape]) {
      const result = run([match]);
      expect(result.insight?.kind).toBe('record');
      expect(result.insight?.facts.durationSeconds).toBe(match.info.gameDuration);
      expect(result.insight?.metric).toBeUndefined();
    }
  });

  it.each([0, -1, undefined, Number.NaN, Number.POSITIVE_INFINITY, 21601])('keeps an invalid duration %s unknown without replacing the latest source', gameDuration => {
    const latest = game(1, {}, { gameDuration });
    const result = run([latest, game(2)]);
    expect(result.insight?.sourceMatch).toBe(latest);
    expect(result.insight?.kind).toBe('record');
    expect(result.insight?.facts.durationSeconds).toBeNull();
    expect(result.insight?.limitation).toContain('duration is unavailable');
  });

  it('does not compute rates when recorded times would place the end of the game in the future', () => {
    const result = run([game(1, {}, { gameCreation: now - 10 * 60_000, gameDuration: 1800 })]);
    expect(result.insight?.kind).toBe('record');
    expect(result.insight?.facts.durationSeconds).toBeNull();
  });

  it('keeps missing score and inventory values unknown rather than zero', () => {
    const result = run([game(1, { kills: undefined, deaths: -1, assists: Number.NaN, item0: undefined, item1: -1 })]);
    expect(result.insight?.facts).toMatchObject({ kills: null, deaths: null, assists: null, itemIds: [3340] });
    expect(result.insight?.limitation).toContain('scoreboard values are unavailable');
    expect(result.insight?.limitation).toContain('Only known final inventory');
  });
});

describe('participation evidence integrity', () => {
  it('requires five distinct owned-team participants and known team kills', () => {
    const missing = aram(); missing.info.participants.pop();
    const duplicateId = aram(); duplicateId.info.participants[1]!.participantId = 1;
    const duplicateIdentity = aram(); duplicateIdentity.info.participants[2]!.puuid = duplicateIdentity.info.participants[1]!.puuid;
    const unknownKills = aram(); Object.assign(unknownKills.info.participants[1]!, { kills: undefined });
    const badId = aram(); badId.info.participants[1]!.participantId = 100;
    const blankIdentity = aram(); blankIdentity.info.participants[1]!.puuid = ' ';
    for (const match of [missing, duplicateId, duplicateIdentity, unknownKills, badId, blankIdentity]) {
      const result = run([match]);
      expect(result.insight?.kind).toBe('record');
      expect(result.insight?.metric).toBeUndefined();
    }
  });

  it('withholds zero denominators and involvement greater than all recorded team kills', () => {
    const zero = aram(1, { kills: 0, assists: 0 });
    zero.info.participants.forEach(p => { p.kills = 0; });
    const impossible = aram(1, { assists: 100 });
    for (const match of [zero, impossible]) {
      expect(run([match]).insight?.kind).toBe('record');
      expect(run([match]).insight?.metric).toBeUndefined();
    }
  });

  it('uses the selected participant’s own team rather than the opposing team', () => {
    const match = aram();
    match.info.participants.forEach(p => { p.teamId = 200; p.participantId += 5; });
    match.info.participants.push(...Array.from({ length: 5 }, (_, i) => ({ ...player, puuid: `opponent-${i}`, teamId: 100, participantId: i + 1, kills: 100 })));
    expect(run([match]).insight?.metric).toMatchObject({ numerator: 15, denominator: 30, value: 50 });
  });
});

describe('scope, discovery and import state', () => {
  it('preserves exact queue and canonical champion scope without combining queues', () => {
    const matches = [aram(1, { championName: 'Jinx' }), game(2), game(3, {}, { queueId: 440 })];
    expect(run(matches).insight).toMatchObject({ champion: 'Jinx', queueId: 450 });
    expect(run(matches, { queue: '420' }).insight).toMatchObject({ champion: 'Ahri', queueId: 420 });
    expect(run(matches, { queue: '440', champion: 'ahri' }).insight).toMatchObject({ champion: 'Ahri', queueId: 440 });
    expect(run(matches, { champion: 'Zed' })).toMatchObject({ insight: null, reason: 'scope-empty' });
    expect(run(matches, { queue: '400' })).toMatchObject({ insight: null, reason: 'scope-empty' });
    expect(run(matches, { queue: '9999' })).toMatchObject({ insight: null, reason: 'invalid-scope', scope: { valid: false } });
  });

  it('reports only actual observed exact queues and canonical champion counts', () => {
    const matches = [game(1, { championName: 'FiddleSticks' }), game(2, { championName: 'Fiddlesticks' }), aram(3, { championName: 'Ahri' })];
    const result = run(matches);
    expect(result.contexts).toEqual([
      { queueId: 420, label: 'Ranked Solo/Duo', family: 'summoners-rift', count: 2, champions: [{ id: 'Fiddlesticks', count: 2 }], latestMatchId: 'EUW1_10001' },
      { queueId: 450, label: 'ARAM', family: 'aram', count: 1, champions: [{ id: 'Ahri', count: 1 }], latestMatchId: 'EUW1_10003' },
    ]);
    expect(run(matches, { champion: 'fiddlesticks' }).insight?.champion).toBe('Fiddlesticks');
    expect(run([game(1, { championName: 'MonkeyKing' })], { champion: 'Wukong' }).insight).toBeNull();
  });

  it('exposes useful progressive facts while keeping loading, failure and empty states distinct', () => {
    const loading = run([game()], { loading: true, available: 20 });
    expect(loading.insight?.kind).toBe('farm');
    expect(loading.sample).toMatchObject({ status: 'loading', complete: false, loaded: 1, available: 20 });
    expect(run([game()], { failed: 1, available: 2 }).sample).toMatchObject({ status: 'partial', complete: false, failed: 1 });
    expect(run([game()], { error: true }).sample.status).toBe('error');
    expect(run([game()], { available: undefined }).sample.status).toBe('partial');
    expect(run([])).toMatchObject({ insight: null, reason: 'no-records', sample: { status: 'empty', complete: true } });
  });

  it('excludes wrong-player, duplicated-owner, invalid-date and malformed records without fabricating evidence', () => {
    const wrong = game(1, { puuid: 'somebody-else' });
    const duplicate = game(); duplicate.info.participants.push({ ...duplicate.info.participants[0]! });
    const malformed = game(); Object.assign(malformed.info, { participants: [null] });
    for (const match of [wrong, duplicate, malformed, game(1, {}, { gameCreation: Number.NaN }), game(1, {}, { gameCreation: now + hour })]) {
      const result = run([match]);
      expect(result.insight).toBeNull();
      expect(result.sample).toMatchObject({ status: 'partial', omitted: 1, loaded: 0, complete: false });
    }
  });

  it('does not substitute an older supported source when the newest source is custom or an unrecognized queue', () => {
    for (const latest of [game(1, {}, { gameType: 'CUSTOM_GAME' }), game(1, {}, { queueId: 9999 })]) {
      const result = run([game(2), latest]);
      expect(result.insight).toBeNull();
      expect(result.reason).toBe('unsupported-source');
      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0]?.count).toBe(1);
      expect(result.sample).toMatchObject({ complete: false, omitted: 1 });
    }
  });

  it('deduplicates identical IDs without mutating imports or making extra context counts', () => {
    const match = game();
    const matches = [match, structuredClone(match)];
    const original = JSON.stringify(matches);
    const result = run(matches);
    expect(result.sample).toMatchObject({ loaded: 1, complete: true, omitted: 0 });
    expect(result.contexts[0]?.count).toBe(1);
    expect(JSON.stringify(matches)).toBe(original);
  });

  it('withholds conflicting duplicate latest IDs regardless of input order', () => {
    const a = game(1, { teamPosition: 'UTILITY', visionScore: 5 });
    const b = game(1, { teamPosition: 'UTILITY', visionScore: 500 });
    for (const matches of [[a, b, game(2)], [b, game(2), a]]) {
      const result = run(matches);
      expect(result.insight).toBeNull();
      expect(result.reason).toBe('unavailable-source');
      expect(result.sample).toMatchObject({ loaded: 1, omitted: 1, complete: false });
      expect(result.contexts[0]?.count).toBe(1);
    }
  });

  it('keeps conflicting changed-queue variants as unavailable anchors in either explicit scope', () => {
    const ranked = game(1);
    const aramVariant = aram(1);
    const matches = [ranked, aramVariant, game(2), aram(3)];
    expect(run(matches, { queue: '420' })).toMatchObject({ insight: null, reason: 'unavailable-source' });
    expect(run(matches, { queue: '450' })).toMatchObject({ insight: null, reason: 'unavailable-source' });
  });
});
