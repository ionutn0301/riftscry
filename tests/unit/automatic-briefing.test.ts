import { describe, expect, it } from 'vitest';
import { buildAutomaticBriefing, type AutomaticBriefingOptions } from '../../src/lib/player/automatic-briefing';
import type { Match, Participant } from '../../src/lib/player/contracts';
import type { RecallPatch } from '../../src/lib/patch-context';

const puuid = 'automatic-player';
const newest = Date.UTC(2026, 9, 28, 12);
const player: Participant = {
  puuid, participantId: 1, teamId: 100, championName: 'Azir', teamPosition: 'MIDDLE',
  win: true, kills: 5, deaths: 2, assists: 8, totalMinionsKilled: 160, neutralMinionsKilled: 0,
  goldEarned: 10000, totalDamageDealtToChampions: 20000, visionScore: 12,
  item0: 6621, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
function game(id: string, minutesAgo = 0, changes: Partial<Participant> = {}, info: Partial<Match['info']> = {}): Match {
  return {
    metadata: { matchId: `EUN1_${id}` },
    info: { gameCreation: newest - minutesAgo * 60000, gameDuration: 1200, gameVersion: '16.21.1',
      queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11,
      participants: [{ ...player, ...changes }], ...info },
  };
}
const archive: RecallPatch[] = [
  { id: '26.21', version: '16.21.1', date: '2026-10-20', champions: ['Azir'], items: [{ id: 6621, name: 'Dawncore' }], records: [
    { kind: 'champion', targetId: 'Azir', label: 'Mana growth', before: '40', after: '50' },
    { kind: 'item', targetId: '6621', label: 'Dawncore · Scaling', before: '10', after: '15' },
    { kind: 'champion', targetId: 'Unrelated', label: 'Unrelated change', before: '1', after: '2' },
  ] },
  { id: '26.20', version: '16.20.1', date: '2026-10-07', champions: ['Ahri'], items: [] },
  { id: '26.19', version: '16.19.1', date: '2026-09-23', champions: [], items: [] },
];
const run = (matches: Match[], options: AutomaticBriefingOptions = {}) => buildAutomaticBriefing(matches, puuid, archive, { available: matches.length, ...options });

function teamGame(id: string, minutesAgo: number, current = false, queueId = 450): Match {
  const p = { ...player, championName: 'Ahri', teamPosition: '', kills: current ? 2 : 8, assists: current ? 3 : 16, totalMinionsKilled: current ? 1 : 200 };
  const teammates = Array.from({ length: 4 }, (_, index) => ({ ...p, puuid: `teammate-${index}`, participantId: index + 2, kills: current ? 7 : 8 }));
  return game(id, minutesAgo, {}, { queueId, gameMode: 'ARAM', mapId: 12, participants: [p, ...teammates] });
}

describe('automatic preparation from imported matches', () => {
  it('discovers recent champion/mode contexts in date order, deduplicates, and does not mutate imports', () => {
    const old = game('10001', 100, { championName: 'Ahri' });
    const latest = game('10002', 0, { championName: 'Ahri' });
    const mayhem = game('10003', 40, { championName: 'Ahri' }, { queueId: 2400, gameMode: 'ARAM', mapId: 12 });
    const matches = [old, mayhem, latest, latest];
    const original = JSON.stringify(matches);
    const result = run(matches, { available: 3 });
    expect(result.latest).toBe(latest);
    expect(result.champions.map(c => [c.champion, c.queueId, c.count])).toEqual([['Ahri', 420, 2], ['Ahri', 2400, 1]]);
    expect(result.sample).toMatchObject({ loaded: 3, available: 3, failed: 0, partial: false, omitted: 0 });
    expect(JSON.stringify(matches)).toBe(original);
  });

  it('caps automatic contexts at five without making a player configure a pool', () => {
    const result = run(['Azir', 'Ahri', 'Jinx', 'Braum', 'Leona', 'Zed'].map((champion, i) => game(String(11000 + i), i * 30, { championName: champion })));
    expect(result.champions.map(c => c.champion)).toEqual(['Azir', 'Ahri', 'Jinx', 'Braum', 'Leona']);
  });

  it('canonicalizes known champion ID casing for grouping, patch matching and explicit focus without changing source records', () => {
    const latest = game('11501', 0, { championName: 'FiddleSticks', item0: 0 }, { gameVersion: '16.20.1' });
    const older = game('11502', 30, { championName: 'Fiddlesticks', item0: 0 }, { gameVersion: '16.20.1' });
    const unknown = game('11503', 60, { championName: 'NotACatalogueId', item0: 0 });
    const matches = [latest, older, unknown];
    const original = JSON.stringify(matches);
    const patches: RecallPatch[] = [
      { ...archive[0]!, champions: ['Fiddlesticks'], items: [], records: [
        { kind: 'champion', targetId: 'Fiddlesticks', label: 'Recorded fixture change', before: '10', after: '20' },
      ] },
      archive[1]!,
    ];
    const result = buildAutomaticBriefing(matches, puuid, patches, { available: 3, champion: 'fiddlesticks' });
    expect(result.champions[0]).toMatchObject({ key: 'Fiddlesticks:420', champion: 'Fiddlesticks', count: 2, patchStatus: 'changed', latestMatch: latest });
    expect(result.champions[0]!.changes[0]!.records?.[0]).toMatchObject({ targetId: 'Fiddlesticks' });
    expect(result.focus).toMatchObject({ kind: 'patch', champion: 'Fiddlesticks', sourceMatch: latest });
    expect(result.session.queues[0]!.championCounts).toEqual([{ champion: 'Fiddlesticks', count: 2 }, { champion: 'NotACatalogueId', count: 1 }]);
    expect(result.champions[1]!.champion).toBe('NotACatalogueId');
    expect(buildAutomaticBriefing(matches, puuid, patches, { champion: 'notacatalogueid' }).focus).toBeNull();
    expect(buildAutomaticBriefing([game('11504', 0, { championName: 'MonkeyKing' })], puuid, patches, { champion: 'Wukong' }).focus).toBeNull();
    expect(JSON.stringify(matches)).toBe(original);
    expect(result.focus!.sourceMatch.info.participants[0]!.championName).toBe('FiddleSticks');
  });

  it('keeps load errors and omitted records separate from results, and reports partial imports', () => {
    const known = game('12001', 0, { win: false });
    const custom = game('12002', 30, {}, { gameType: 'CUSTOM_GAME' });
    const missingPlayer = game('12003', 60, { puuid: 'someone-else' });
    const badDate = game('12004', 90, {}, { gameCreation: Number.NaN });
    const result = run([known, custom, missingPlayer, badDate], { available: 6, failed: 2, loading: true });
    expect(result.sample).toEqual({ loaded: 1, available: 6, failed: 2, partial: true, omitted: 3 });
    expect(result.session.queues[0]).toMatchObject({ matchCount: 1, wins: 0, losses: 1, outcomeCount: 1 });
    expect(result.champions).toHaveLength(1);
  });

  it('separates ARAM, Mayhem and ranked in every context and optional queue selection', () => {
    const ranked = game('13001', 0);
    const aram = game('13002', 30, {}, { queueId: 450, gameMode: 'ARAM', mapId: 12 });
    const mayhem = game('13003', 60, {}, { queueId: 2400, gameMode: 'ARAM', mapId: 12 });
    const result = run([ranked, aram, mayhem], { queue: '2400' });
    expect(result.latest).toBe(mayhem);
    expect(result.champions.map(c => c.queueId)).toEqual([2400]);
    expect(result.session.queues.map(q => q.queueId)).toEqual([2400]);
    expect(result.sample.loaded).toBe(3);
    expect(result.sample.partial).toBe(false);
    expect(run([ranked, aram], { queue: '99999' }).focus).toBeNull();
  });

  it('resolves the recorded game version and shows only later relevant champion or exact-item changes', () => {
    const result = run([game('14001', 0, {}, { gameVersion: '16.20.321.999' })]);
    const context = result.champions[0]!;
    expect(context).toMatchObject({ sourcePatch: '16.20', resolvedPatch: '26.20', patchStatus: 'changed' });
    expect(context.changes.map(c => c.id)).toEqual(['26.21']);
    expect(context.changes[0]!.records?.map(c => c.targetId)).toEqual(['Azir', '6621']);
    expect(result.focus).toMatchObject({ kind: 'patch', patchId: '26.21', evidenceMatchIds: ['EUN1_14001'] });
    expect(result.focus!.body).toContain('40 to 50');
  });

  it('detects a verified item change for an unchanged champion without conflating a mode variant', () => {
    const result = run([game('15001', 0, { championName: 'Jinx', item0: 6621 }, { gameVersion: '16.20.1' })]);
    expect(result.champions[0]!.changes[0]!.records?.map(c => c.targetId)).toEqual(['6621']);
    expect(result.focus!.body).toContain('10 to 15');
    const variant = run([game('15002', 0, { championName: 'Jinx', item0: 226621 }, { gameVersion: '16.20.1' })]);
    expect(variant.champions[0]!.patchStatus).toBe('unchanged');
    expect(variant.focus!.kind).toBe('latest-game');
  });

  it('distinguishes current, unchanged covered intervals and unknown patch baselines', () => {
    const current = game('16001', 0, { championName: 'Jinx', item0: 0 });
    const unchanged = game('16002', 30, { championName: 'Braum', item0: 0 }, { gameVersion: '16.20.1' });
    const unknown = game('16003', 60, { championName: 'Leona' }, { gameVersion: '15.16.1' });
    const result = run([unknown, current, unchanged]);
    expect(result.champions.map(c => [c.champion, c.patchStatus, c.resolvedPatch])).toEqual([
      ['Jinx', 'current', '26.21'], ['Braum', 'unchanged', '26.20'], ['Leona', 'unknown', null],
    ]);
    expect(result.focus!.kind).toBe('latest-game');
    expect(run([current], { champion: 'NotLoaded' }).focus).toBeNull();
  });

  it('prioritizes an explicit champion for preparation without rewriting the latest session', () => {
    const newestGame = game('17001', 0, { championName: 'Ahri' });
    const selected = game('17002', 30, { championName: 'Azir' }, { gameVersion: '16.20.1' });
    const result = run([newestGame, selected], { champion: 'Azir' });
    expect(result.latest).toBe(newestGame);
    expect(result.session.matches).toEqual([newestGame, selected]);
    expect(result.champions[0]!.champion).toBe('Azir');
    expect(result.focus).toMatchObject({ champion: 'Azir', sourceMatch: selected });
    const missing = run([newestGame, selected], { champion: 'Jinx' });
    expect(missing.focus).toBeNull();
    expect(missing.latest).toBe(newestGame);
    expect(missing.sample.loaded).toBe(2);
  });
});

describe('automatic session reconstruction', () => {
  it('uses end-to-next-start gaps including exactly 90 minutes and sums actual game time only', () => {
    const latest = game('18001', 0);
    const previous = game('18002', 110, {}, { queueId: 450, gameMode: 'ARAM', mapId: 12 });
    const outside = game('18003', 221);
    const result = run([outside, latest, previous]);
    expect(result.session.matches).toEqual([latest, previous]);
    expect(result.session).toMatchObject({ from: previous.info.gameCreation, to: newest + 1200000, playSeconds: 2400, boundary: 'gap', gapMinutes: 90 });
    expect(result.session.queues.map(q => [q.queueId, q.matchCount])).toEqual([[420, 1], [450, 1]]);
  });

  it('marks sample-edge sessions and unknown import bounds without claiming a complete session', () => {
    const matches = [game('19001'), game('19002', 30)];
    const result = buildAutomaticBriefing(matches, puuid, archive);
    expect(result.session.boundary).toBe('sample-edge');
    expect(result.sample).toMatchObject({ loaded: 2, available: null, partial: true });
  });

  it('stops at overlapping or invalid-duration records instead of inventing continuous play', () => {
    const latest = game('20001');
    const overlaps = game('20002', 10);
    const overlapping = run([latest, overlaps]);
    expect(overlapping.session).toMatchObject({ matches: [latest], playSeconds: 1200, boundary: 'invalid' });
    const unknown = game('20003', 0, {}, { gameDuration: Number.NaN });
    expect(run([unknown, game('20004', 30)]).session).toMatchObject({ matches: [unknown], playSeconds: 0, to: null, boundary: 'invalid' });
  });
});

describe('automatically selected focus', () => {
  it('chooses the most recently imported relevant patch context ahead of a personal metric', () => {
    const latest = game('21001', 0, { totalMinionsKilled: 40 });
    const olderChange = game('21002', 30, { championName: 'Ahri', item0: 6621 }, { gameVersion: '16.20.1' });
    const evenOlder = game('21003', 60, { championName: 'Braum', item0: 6621 }, { gameVersion: '16.20.1' });
    const result = run([evenOlder, latest, olderChange]);
    expect(result.focus).toMatchObject({ kind: 'patch', champion: 'Ahri', sourceMatch: olderChange });
  });

  it('compares farm only against at least three prior games of the same champion, mode, role and patch', () => {
    const latest = game('22001', 0, { totalMinionsKilled: 80 });
    const previous = [game('22002', 30), game('22003', 60, { totalMinionsKilled: 150 }), game('22004', 90, { totalMinionsKilled: 500 })];
    const result = run([latest, ...previous]);
    expect(result.focus).toMatchObject({ kind: 'farm', metric: { latest: 4, baseline: 8, samples: 3, unit: 'per-minute' } });
    expect(result.focus!.evidenceMatchIds).toEqual(['EUN1_22001', 'EUN1_22002', 'EUN1_22003', 'EUN1_22004']);
    expect(result.focus!.body).toContain('median');
    for (const incompatible of [
      game('22005', 120, { championName: 'Ahri' }),
      game('22006', 120, {}, { queueId: 440 }),
      game('22007', 120, { teamPosition: 'BOTTOM' }),
      game('22008', 120, {}, { gameVersion: '16.20.1' }),
    ]) expect(run([latest, ...previous.slice(0, 2), incompatible], { champion: 'Azir' }).focus!.kind).toBe('latest-game');
  });

  it('withholds low-sample, support, short-game and unavailable farming comparisons', () => {
    const latest = game('23001', 0, { totalMinionsKilled: 20 });
    const previous = [game('23002', 30), game('23003', 60), game('23004', 90)];
    expect(run([latest, ...previous.slice(0, 2)]).focus!.kind).toBe('latest-game');
    const sameStart = previous.map(match => ({ ...match, info: { ...match.info, gameCreation: latest.info.gameCreation } }));
    expect(run([latest, ...sameStart]).focus!.kind).toBe('latest-game');
    const short = structuredClone(latest); short.info.gameDuration = 100;
    expect(run([short, ...previous]).focus!.kind).toBe('latest-game');
    const missing = structuredClone(latest); missing.info.participants[0]!.totalMinionsKilled = Number.NaN;
    expect(run([missing, ...previous]).focus!.kind).toBe('latest-game');
    const support = [latest, ...previous].map(match => ({ ...match, info: { ...match.info, participants: match.info.participants.map(p => ({ ...p, teamPosition: 'UTILITY' })) } }));
    expect(run(support).focus!.kind).toBe('latest-game');
  });

  it.each([450, 2400, 1700, 1900])('never manufactures lane-farm or vision focus for queue%s', queueId => {
    const games = [game('24001', 0, { totalMinionsKilled: 1 }), game('24002', 30), game('24003', 60), game('24004', 90)]
      .map(match => ({ ...match, info: { ...match.info, queueId, gameMode: queueId === 450 || queueId === 2400 ? 'ARAM' : 'CHERRY', mapId: 12 } }));
    expect(run(games).focus!.kind).toBe('latest-game');
    expect(run(games).session.queues[0]!.csPerMinute.value).toBeNull();
  });

  it('uses recorded same-queue team participation when a complete five-player team is available', () => {
    const matches = [teamGame('25001', 0, true), teamGame('25002', 30), teamGame('25003', 60), teamGame('25004', 90)];
    expect(run(matches).focus).toMatchObject({ kind: 'participation', metric: { latest: 16.7, baseline: 60, samples: 3, unit: 'percent' } });
    const mixed = [matches[0]!, matches[1]!, matches[2]!, teamGame('25005', 120, false, 2400)];
    expect(run(mixed).focus!.kind).toBe('latest-game');
    const incomplete = structuredClone(matches); incomplete[0]!.info.participants.pop();
    expect(run(incomplete).focus!.kind).toBe('latest-game');
  });

  it('does not treat an unknown result as a loss or invent preparation for an empty sample', () => {
    const missingResult = game('26001', 0, { win: undefined as unknown as boolean });
    const result = run([missingResult]);
    expect(result.focus!.body).not.toContain('Loss');
    expect(result.session.queues[0]).toMatchObject({ outcomeCount: 0, wins: 0, losses: 0 });
    const empty = run([]);
    expect(empty.latest).toBeNull(); expect(empty.focus).toBeNull(); expect(empty.champions).toEqual([]);
    expect(empty.session).toMatchObject({ matches: [], from: null, to: null, playSeconds: 0, queues: [] });
  });
});
