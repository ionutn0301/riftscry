import { describe, expect, it } from 'vitest';
import { comparisonRole, comparisonRoleLabel, eligibility, evidence, fallbackReview, type Match, type Memory, type Participant } from '../../src/lib/player/contracts';
import { historyOptions, isSupportedMatchmade, modeForMatch, queues } from '../../src/lib/player/modes';
import { summarizeByQueue } from '../../src/lib/player/stats';
import { buildSuggestions, type ItemMetadata } from '../../src/lib/player/advice';

const p: Participant = {
  puuid: 'mode-test-player', participantId: 1, teamId: 100, championName: 'Jhin', teamPosition: 'BOTTOM',
  win: true, kills: 5, deaths: 2, assists: 6, totalMinionsKilled: 160, neutralMinionsKilled: 0,
  goldEarned: 10000, totalDamageDealtToChampions: 20000, visionScore: 12,
  item0: 3009, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
function game(queueId: number, id = String(queueId), date = 1793000000000, player: Partial<Participant> = {}): Match {
  return { metadata: { matchId: `EUN1_${id}` }, info: {
    gameCreation: date, gameDuration: 1200, gameVersion: '16.21.1', queueId,
    gameType: 'MATCHED_GAME', gameMode: queueId === 480 ? 'SWIFTPLAY' : [450, 720, 2400].includes(queueId) ? 'ARAM' : 'CLASSIC',
    mapId: [450, 720, 2400].includes(queueId) ? 12 : 11, participants: [{ ...p, ...player }],
  } };
}
const items: ItemMetadata = { version: '16.21.1', notice: 'Unit fixture.', data: {
  3009: { name: 'Boots of Swiftness', tags: ['Boots'], maps: { 11: true }, gold: { total: 1000, purchasable: true }, stats: { FlatMovementSpeedMod: 55 } },
  3047: { name: 'Plated Steelcaps', tags: ['Boots'], from: ['1001'], maps: { 11: true }, gold: { total: 1200, purchasable: true }, stats: { FlatArmorMod: 25, FlatMovementSpeedMod: 45 } },
} };
const baseNote: Memory = {
  id: 'test', player: 'eun1:mode-test-player', champion: 'Jhin', role: 'BOTTOM', queue: 420,
  patch: '16.21', source: 'EUN1_prior', sourceDate: 1790000000000, createdAt: 1791000000000,
  trackingStartedAt: 1791000000000, evidence: ['inventory'], condition: 'Same champion, role, queue and patch',
  original: 'A recorded purchase', alternative: 'Review its setup', targetItem: 3009, reason: 'Observe the plan',
  tradeoff: 'Only this queue', check: 'purchase', reflection: '', status: 'active', favorite: false,
};

describe('current Riot queue identities', () => {
  it('keeps current normal and ARAM variants distinct and offers all recent by default', () => {
    expect(historyOptions[0]).toEqual({ value: 'all', label: 'All recent games' });
    expect(queues[480]).toBe('Swiftplay');
    expect(queues[490]).toBe('Quickplay');
    expect(queues[720]).toBe('ARAM Clash');
    expect(queues[2400]).toBe('ARAM: Mayhem');
    for (const id of [400, 420, 440, 450, 480, 490, 700, 720, 1700, 1710, 2300, 2400]) expect(isSupportedMatchmade(game(id))).toBe(true);
    for (const id of [0, 870, 880, 890, 1090, 2000, 999999]) expect(isSupportedMatchmade(game(id))).toBe(false);
    expect(isSupportedMatchmade({ ...game(420), info: { ...game(420).info, gameType: 'CUSTOM_GAME' } })).toBe(false);
    expect(modeForMatch(game(999999))).toMatchObject({ label: 'Queue 999999', family: 'unknown', supported: false, roleMetrics: false });
  });

  it('withholds standard metrics on contradictory maps and item rules in Swiftplay', () => {
    expect(modeForMatch(game(420))).toMatchObject({ roleMetrics: true, visionMetrics: true, standardItems: true });
    expect(modeForMatch(game(480))).toMatchObject({ family: 'summoners-rift', roleMetrics: true, standardItems: false });
    const wrongMap = { ...game(420), info: { ...game(420).info, mapId: 12 } };
    expect(modeForMatch(wrongMap)).toMatchObject({ roleMetrics: false, visionMetrics: false, standardItems: false });
    expect(buildSuggestions(wrongMap, p.puuid, evidence(wrongMap, p.puuid), items)).toEqual([]);
    expect(buildSuggestions(game(480), p.puuid, evidence(game(480), p.puuid), items)).toEqual([]);
  });
});

describe('mode-aware facts and statistics', () => {
  it.each([450, 720, 2400])('keeps ARAM queue %s out of SR role, farming, vision and item interpretations', queue => {
    // Even an anomalous filled teamPosition must not turn ARAM into a lane mode.
    const match = game(queue);
    const facts = evidence(match, p.puuid);
    expect(facts.some(f => ['farm', 'farm-rate', 'gold-rate', 'vision'].includes(f.id))).toBe(false);
    expect(facts.find(f => f.id === 'mode-context')?.text).toContain(queues[queue]);
    expect(facts.find(f => f.id === 'result')?.text).not.toContain('BOTTOM');
    expect(facts.find(f => f.id === 'damage')?.text).toContain('20000');
    expect(buildSuggestions(match, p.puuid, facts, items)).toEqual([]);
    const report = fallbackReview(facts);
    expect(report.sections[3]?.text).toContain('same queue');
    expect(report.sections[3]?.evidence).toContain('mode-context');
    expect(modeForMatch(match).runeSetup).toBe(queue !== 2400);
  });

  it('never averages ranked, ARAM, Mayhem or Swiftplay together and excludes non-supported or duplicate records', () => {
    const ranked = game(420, 'ranked', 1730000000000);
    const aram = game(450, 'aram', 1793000000000, { kills: 20, win: false });
    const mayhem = game(2400, 'mayhem', 1794000000000, { kills: 30 });
    const swift = game(480, 'swift', 1795000000000, { kills: 8 });
    const custom = { ...game(420, 'custom'), info: { ...game(420, 'custom').info, gameType: 'CUSTOM_GAME' } };
    const summaries = summarizeByQueue([ranked, aram, mayhem, swift, aram, custom, game(999999)], p.puuid);
    expect(summaries.map(s => s.queueId)).toEqual([480, 2400, 450, 420]);
    expect(summaries.map(s => s.matchCount)).toEqual([1, 1, 1, 1]);
    expect(summaries.find(s => s.queueId === 420)).toMatchObject({ winRate: 100, kills: { value: 5, samples: 1 }, roles: { BOTTOM: 1 } });
    expect(summaries.find(s => s.queueId === 450)).toMatchObject({ winRate: 0, kills: { value: 20, samples: 1 }, roles: {}, csPerMinute: { value: null, samples: 0 }, visionScore: { value: null, samples: 0 } });
    expect(summaries.find(s => s.queueId === 2400)).toMatchObject({ winRate: 100, kills: { value: 30, samples: 1 } });
  });

  it('reports metric-specific denominators and unknown values without treating support/short games as zero farm', () => {
    const carry = game(420, 'carry');
    const support = game(420, 'support', 1793000000100, { teamPosition: 'UTILITY', kills: Number.NaN });
    const short = { ...game(420, 'short'), info: { ...game(420, 'short').info, gameDuration: 100 } };
    const [summary] = summarizeByQueue([carry, support, short], p.puuid);
    expect(summary).toMatchObject({ matchCount: 3, csPerMinute: { value: 8, samples: 1 }, goldPerMinute: { value: 500, samples: 2 }, kills: { value: 5, samples: 2 } });
    expect(JSON.stringify(summary)).not.toMatch(/NaN|Infinity/);
    const invalid = { ...game(420), info: { ...game(420).info, gameDuration: Number.NaN, gameCreation: 0 } };
    expect(summarizeByQueue([invalid], p.puuid)[0]).toMatchObject({ from: null, to: null, csPerMinute: { value: null, samples: 0 } });
  });
});

describe('explicit non-lane Build Memory comparison context', () => {
  it('accepts new same-queue ARAM observations without inventing a lane, while old missing contexts stay unknown', () => {
    const match = game(450, 'later', 1793000000000, { teamPosition: '' });
    const role = comparisonRole(match, p.puuid);
    expect(role).toBe('MODE:aram');
    expect(comparisonRoleLabel(role)).toBe('ARAM · no assigned lane');
    const note = { ...baseNote, queue: 450, role };
    expect(eligibility(note, match, p.puuid)).toBe('eligible');
    expect(eligibility({ ...note, role: '' }, match, p.puuid)).toBe('unknown');
    expect(eligibility({ ...note, role: 'BOTTOM' }, match, p.puuid)).toBe('unknown');
    expect(eligibility(note, game(2400), p.puuid)).toBe('ineligible');
    expect(eligibility(note, { ...match, info: { ...match.info, gameCreation: note.trackingStartedAt! } }, p.puuid)).toBe('ineligible');
    expect(eligibility({ ...note, patch: '16.20' }, match, p.puuid)).toBe('unknown');
    expect(eligibility({ ...note, condition: 'After checking the replay' }, match, p.puuid)).toBe('unknown');
  });
});
