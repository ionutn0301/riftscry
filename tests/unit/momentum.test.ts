import { describe, expect, it } from 'vitest';
import {
  buildMomentum, momentumStorageKey, parseMomentumState, serializeMomentumState,
  MOMENTUM_CYCLE_LIMIT, type MomentumOptions, type MomentumState,
} from '../../src/lib/player/momentum';
import type { Match, Participant } from '../../src/lib/player/contracts';

const platform = 'euw1';
const puuid = 'momentum-player-000000000000000000000000';
const otherPuuid = 'another-player-000000000000000000000000';
const now = Date.UTC(2026, 10, 3, 12);
const hour = 60 * 60 * 1000;
const player: Participant = {
  puuid, participantId: 1, teamId: 100, championName: 'Ahri', teamPosition: 'MIDDLE', win: true,
  kills: 5, deaths: 3, assists: 5, totalMinionsKilled: 180, neutralMinionsKilled: 0,
  goldEarned: 12000, totalDamageDealtToChampions: 22000, visionScore: 30,
  item0: 0, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
};
function game(index: number, hoursAgo = index + 1, changes: Partial<Participant> = {}, info: Partial<Match['info']> = {}): Match {
  const p = { ...player, ...changes };
  return {
    metadata: { matchId: `EUW1_${10000 + index}` },
    info: {
      gameCreation: now - hoursAgo * hour, gameDuration: 1800, gameVersion: '16.21.1', queueId: 420,
      gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11,
      participants: [p, ...Array.from({ length: 4 }, (_, i) => ({ ...player, puuid: `teammate-${i}`, participantId: i + 2, kills: 5 }))],
      ...info,
    },
  };
}
const baseline = () => [game(1, 1), game(2, 2), game(3, 3)];
const run = (matches: Match[], changes: Partial<MomentumOptions> = {}) => buildMomentum(matches, puuid, { platform, now, available: new Set(matches.map(match => match.metadata.matchId)).size, ...changes });
const started = () => run(baseline()).state;

describe('Momentum prospective focus', () => {
  it('opens a three-game focus without counting historical baseline games and freezes source evidence', () => {
    const matches = baseline();
    const original = JSON.stringify(matches);
    const report = run(matches);
    expect(report.status).toBe('tracking');
    expect(report.active).toMatchObject({ metric: 'farm', baseline: 6, target: 6.2, createdAt: now, checks: [], status: 'active' });
    expect(report.active?.baselineMatchIds).toEqual(matches.map(match => match.metadata.matchId));
    expect(report.changed).toBe(true);
    expect(JSON.stringify(matches)).toBe(original);
    const refreshed = run([...matches].reverse(), { state: report.state, now: now + 1000 });
    expect(refreshed.changed).toBe(false);
    expect(refreshed.state.cycles).toHaveLength(1);
    expect(refreshed.active?.baseline).toBe(6);
    expect(refreshed.active?.createdAt).toBe(now);
  });

  it('uses the latest five valid measurements and their median, not an average or a global benchmark', () => {
    const matches = [game(1, 1, { totalMinionsKilled: 180 }), game(2, 2, { totalMinionsKilled: 150 }),
      game(3, 3, { totalMinionsKilled: 210 }), game(4, 4, { totalMinionsKilled: 240 }),
      game(5, 5, { totalMinionsKilled: 120 }), game(6, 6, { totalMinionsKilled: 5000 })];
    const result = run(matches);
    expect(result.active?.baseline).toBe(6);
    expect(result.active?.baselineMatchIds).toEqual(matches.slice(0, 5).map(match => match.metadata.matchId));
    expect(result.active?.baselineMatchIds).not.toContain(matches[5]!.metadata.matchId);
  });

  it('chooses a meaningful recent drop and sets restoration to the frozen personal median', () => {
    const matches = [game(1, 1, { kills: 1, assists: 1 }), game(2, 2), game(3, 3), game(4, 4)];
    const result = run(matches);
    expect(result.active).toMatchObject({ metric: 'participation', baseline: 40, target: 40 });
  });

  it('restores the baseline before increasing the target when the latest value is slightly lower', () => {
    const result = run([game(1, 1, { totalMinionsKilled: 174 }), game(2, 2), game(3, 3)]);
    expect(result.active).toMatchObject({ metric: 'farm', baseline: 6, target: 6 });
  });

  it('counts only games that started strictly after focus creation, never baseline IDs or a match already underway', () => {
    const state = started();
    const atStart = game(10, 0);
    const underway = game(11, 0.1);
    const later = game(12, -1, { totalMinionsKilled: 210 });
    const duplicateBaselineWithNewDate = game(1, -2);
    const result = run([...baseline(), atStart, underway, later, duplicateBaselineWithNewDate], { state, now: now + 3 * hour });
    expect(result.active?.checks).toEqual([{ matchId: later.metadata.matchId, startedAt: later.info.gameCreation, value: 7, hit: true }]);
    expect(result.active?.baseline).toBe(6);
    expect(state.cycles[0]?.checks).toEqual([]);
  });

  it('checks the next three eligible games chronologically, retains a receipt and opens only one next cycle', () => {
    const state = started();
    const future = [game(11, -1, { totalMinionsKilled: 210 }), game(12, -2, { totalMinionsKilled: 120 }),
      game(13, -3, { totalMinionsKilled: 195 }), game(14, -4, { totalMinionsKilled: 270 })];
    const matches = [future[3]!, ...baseline(), future[2]!, future[0]!, future[1]!];
    const result = run(matches, { state, now: now + 5 * hour });
    expect(result.completed?.checks.map(check => check.matchId)).toEqual(future.slice(0, 3).map(match => match.metadata.matchId));
    expect(result.completed?.checks.map(check => check.hit)).toEqual([true, false, true]);
    expect(result.completed).toMatchObject({ baseline: 6, target: 6.2, status: 'complete', completedAt: now + 5 * hour });
    expect(result.active?.checks).toEqual([]);
    expect(result.active?.createdAt).toBe(now + 5 * hour);
    expect(result.state.cycles).toHaveLength(2);
    const refresh = run(matches, { state: result.state, now: now + 5 * hour + 1 });
    expect(refresh.changed).toBe(false);
    expect(refresh.state.cycles).toHaveLength(2);
  });

  it('does not duplicate a check across refreshes or use duplicate input IDs as extra games', () => {
    const next = game(10, -1);
    const matches = [next, next, ...baseline()];
    const first = run(matches, { state: started(), now: now + 2 * hour });
    const second = run(matches, { state: first.state, now: now + 3 * hour });
    expect(first.active?.checks).toHaveLength(1);
    expect(second.active?.checks).toHaveLength(1);
    expect(second.changed).toBe(false);
  });

  it.each([
    { loading: true }, { error: true }, { failed: 1 }, { available: 4 }, { available: undefined },
  ])('does not create or advance from an incomplete import: %j', flags => {
    const initial = run(baseline(), flags);
    expect(initial.active).toBeNull();
    expect(initial.changed).toBe(false);
    const matches = [...baseline(), game(10, -1)];
    const advanced = run(matches, { state: started(), now: now + 2 * hour, ...flags, ...(flags.available === 4 ? { available: 5 } : {}) });
    expect(advanced.active?.checks).toEqual([]);
    expect(advanced.changed).toBe(false);
    expect(advanced.status).toBe('waiting');
  });

  it('pauses if the recent sample no longer reaches the focus start instead of skipping unseen games', () => {
    const result = run([game(10, -1), game(11, -2), game(12, -3)], { state: started(), now: now + 4 * hour });
    expect(result.status).toBe('waiting');
    expect(result.active?.checks).toEqual([]);
    expect(result.notice).toContain('unseen games');
    expect(result.changed).toBe(false);
  });

  it('shows a factual warmup measure immediately, even for a single losing game', () => {
    const result = run([game(1, 1, { win: false })]);
    expect(result.status).toBe('warmup');
    expect(result.spotlight).toMatchObject({ metric: 'farm', value: 6, sourceMatchId: 'EUW1_10001' });
    expect(result.spotlight?.action).toContain('safe');
    expect(result.active).toBeNull();
    expect(result.comparableCount).toBe(1);
  });

  it('keeps observed value and highlight available when persistence is unavailable without pretending to track', () => {
    const result = run([game(10, 0.6, { totalMinionsKilled: 240 }), ...baseline()], { canPersist: false });
    expect(result.status).toBe('read-only');
    expect(result.spotlight?.value).toBe(8);
    expect(result.highlight?.value).toBe(8);
    expect(result.active).toBeNull();
    expect(result.changed).toBe(false);
  });

  it('keeps the spotlight measurement and its comparison count aligned when other metrics are missing', () => {
    const result = run([game(1, 1), game(2, 2, { totalMinionsKilled: undefined }), game(3, 3, { totalMinionsKilled: undefined })], { canPersist: false });
    expect(result.spotlight).toMatchObject({ metric: 'participation', value: 40 });
    expect(result.comparableCount).toBe(3);
  });
});

describe('Momentum comparison boundaries', () => {
  it.each(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM'])('offers a role-aware farming measure for %s', teamPosition => {
    const matches = baseline().map(match => ({ ...match, info: { ...match.info, participants: match.info.participants.map((p, index) => index ? p : { ...p, teamPosition }) } }));
    expect(run(matches).active?.metric).toBe('farm');
  });

  it('uses vision per minute for support and never a support farming target', () => {
    const matches = [game(1, 1, { teamPosition: 'UTILITY', visionScore: 60 }), game(2, 2, { teamPosition: 'UTILITY', visionScore: 60 }), game(3, 3, { teamPosition: 'UTILITY', visionScore: 60 })];
    const result = run(matches);
    expect(result.active).toMatchObject({ metric: 'vision', baseline: 2, target: 2.1 });
    expect(result.spotlight?.metric).toBe('vision');
  });

  it('supports ARAM with exact-queue team participation and no farming, vision or death target', () => {
    const matches = [1, 2, 3].map(index => game(index, index, { teamPosition: '', totalMinionsKilled: 0, deaths: 20 }, { queueId: 450, gameMode: 'ARAM', mapId: 12 }));
    const result = run(matches);
    expect(result.active).toMatchObject({ metric: 'participation', baseline: 40, target: 45, context: { queueId: 450, role: 'MODE:aram' } });
    expect(result.spotlight?.metric).toBe('participation');
  });

  it('caps participation at 100 percent without promising an impossible target', () => {
    const matches = [1, 2, 3].map(index => game(index, index, { assists: 20, teamPosition: '' }, { queueId: 450, gameMode: 'ARAM', mapId: 12 }));
    expect(run(matches).active).toMatchObject({ metric: 'participation', baseline: 100, target: 100 });
  });

  it('never compares another champion, exact queue, role or patch with an existing focus', () => {
    const variants = [
      game(10, -1, { championName: 'Jinx' }), game(11, -2, {}, { queueId: 440 }),
      game(12, -3, { teamPosition: 'TOP' }), game(13, -4, {}, { gameVersion: '16.22.1' }),
    ];
    const result = run([...baseline(), ...variants], { state: started(), now: now + 5 * hour });
    expect(result.state.cycles[0]?.checks).toEqual([]);
    expect(result.active).toBeNull();
    expect(result.status).toBe('warmup');
    expect(result.context?.patch).toBe('16.22');
  });

  it('starts a distinct patch cycle when enough records exist and retains the paused older one', () => {
    const newer = [10, 11, 12].map((index, i) => game(index, -(i + 1), {}, { gameVersion: '16.22.4' }));
    const result = run([...baseline(), ...newer], { state: started(), now: now + 4 * hour });
    expect(result.state.cycles).toHaveLength(2);
    expect(result.active?.context.patch).toBe('16.22');
    expect(result.active?.checks).toEqual([]);
    expect(result.state.cycles[0]?.context.patch).toBe('16.21');
    expect(result.state.cycles[0]?.checks).toEqual([]);
  });

  it('canonicalizes champion ID casing without treating display names as aliases', () => {
    const matches = [game(1, 1, { championName: 'FiddleSticks' }), game(2, 2, { championName: 'Fiddlesticks' }), game(3, 3, { championName: 'fiddlesticks' })];
    expect(run(matches, { champion: 'FIDDLESTICKS' }).active?.context.champion).toBe('Fiddlesticks');
    expect(run(matches, { champion: 'Wukong' }).active).toBeNull();
    expect(run(matches, { queue: '450' }).active).toBeNull();
  });

  it.each([
    { queueId: 1700, gameMode: 'CHERRY', mapId: 30 },
    { queueId: 900, gameMode: 'URF', mapId: 11 },
    { queueId: 420, gameMode: 'ARAM', mapId: 12 },
    { queueId: 450, gameMode: 'CLASSIC', mapId: 11 },
  ])('withholds unvalidated or contradictory mode metrics: %j', mode => {
    const result = run([1, 2, 3].map(index => game(index, index, {}, mode)));
    expect(result.status).toBe('unsupported');
    expect(result.active).toBeNull();
    expect(result.spotlight).toBeNull();
  });

  it('does not attach an older lane focus to a newest Arena or unknown-role game', () => {
    for (const latest of [game(10, -1, {}, { queueId: 1700, gameMode: 'CHERRY', mapId: 30 }), game(11, -1, { teamPosition: '' })]) {
      const result = run([latest, ...baseline()], { state: started(), now: now + 2 * hour });
      expect(result.context).toBeNull();
      expect(result.active).toBeNull();
      expect(result.spotlight).toBeNull();
      expect(result.status).toBe('unsupported');
      expect(result.state.cycles[0]?.checks).toEqual([]);
    }
  });

  it('excludes short games and explicit remakes from the baseline and future checks', () => {
    const short = game(10, -1, {}, { gameDuration: 200 });
    const remake = game(11, -2);
    Object.assign(remake.info.participants[0]!, { gameEndedInEarlySurrender: true });
    const valid = game(12, -3);
    const result = run([...baseline(), short, remake, valid], { state: started(), now: now + 4 * hour });
    expect(result.active?.checks.map(check => check.matchId)).toEqual([valid.metadata.matchId]);
    const first = run([game(1, 1), game(2, 2), { ...short, info: { ...short.info, gameCreation: now - 3 * hour } }]);
    expect(first.active).toBeNull();
  });

  it('does not interpret missing, negative, NaN or infinite farm values as zero', () => {
    for (const invalid of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const next = game(10, -1, { totalMinionsKilled: invalid });
      const result = run([...baseline(), next], { state: started(), now: now + 2 * hour });
      expect(result.active?.checks).toEqual([]);
    }
  });

  it('does not use partial teams, zero team kills, duplicated participants or impossible assists as KP evidence', () => {
    const aram = () => game(1, 1, { teamPosition: '' }, { queueId: 450, gameMode: 'ARAM', mapId: 12 });
    const games: Match[] = [];
    const partial = aram(); partial.info.participants.pop(); games.push(partial);
    const zero = aram(); zero.info.participants.forEach(p => { p.kills = 0; }); games.push(zero);
    const duplicate = aram(); duplicate.info.participants[1]!.participantId = 1; games.push(duplicate);
    const impossible = aram(); impossible.info.participants[0]!.assists = 30; games.push(impossible);
    for (const match of games) {
      expect(run([match]).spotlight).toBeNull();
      expect(run([match]).active).toBeNull();
    }
  });

  it('freezes progress when malformed timestamps, durations or wrong-player records make the import unreliable', () => {
    for (const bad of [
      game(10, -1, {}, { gameCreation: Number.NaN }), game(10, -1, {}, { gameDuration: 0 }),
      game(10, -1, {}, { gameDuration: 21601 }), game(10, -1, { puuid: otherPuuid }),
      game(10, -3),
    ]) {
      const result = run([...baseline(), bad, game(11, -1)], { state: started(), now: now + 2 * hour });
      expect(result.completeSample).toBe(false);
      expect(result.state.cycles[0]?.checks).toEqual([]);
      expect(result.changed).toBe(false);
    }
  });

  it('handles malformed or duplicated player participants without throwing or inventing a measurement', () => {
    const malformed = game(10, -1);
    Object.assign(malformed.info, { participants: [null] });
    const duplicate = game(11, -1);
    duplicate.info.participants.push({ ...duplicate.info.participants[0]! });
    for (const match of [malformed, duplicate]) {
      const report = run([...baseline(), match], { state: started(), now: now + 2 * hour });
      expect(report.completeSample).toBe(false);
      expect(report.changed).toBe(false);
      expect(report.active?.checks).toEqual([]);
    }
  });
});

describe('Momentum positive sample records', () => {
  it('celebrates a higher recorded measure even in a loss, with exact comparison evidence', () => {
    const latest = game(10, 0.6, { totalMinionsKilled: 240, win: false });
    const result = run([latest, ...baseline()]);
    expect(result.highlight).toMatchObject({ metric: 'farm', value: 8, previousBest: 6, sourceMatchId: latest.metadata.matchId, won: false });
    expect(result.highlight?.comparisonMatchIds).toEqual(baseline().map(match => match.metadata.matchId));
  });

  it('requires at least three earlier comparable games and does not call ties or different contexts records', () => {
    expect(run(baseline()).highlight).toBeNull();
    expect(run([game(10, 0.6, { totalMinionsKilled: 240 }), ...baseline().slice(0, 2)]).highlight).toBeNull();
    expect(run([game(10, 0.6, { totalMinionsKilled: 240, championName: 'Jinx' }), ...baseline()]).highlight).toBeNull();
  });
});

describe('Momentum bounded storage', () => {
  it('round-trips a validated player-scoped state and distinguishes absent from unreadable data', () => {
    const state = started();
    const serialized = serializeMomentumState(state);
    expect(parseMomentumState(serialized, platform, puuid)).toEqual({ status: 'valid', state });
    expect(parseMomentumState(null, platform, puuid)).toEqual({ status: 'empty', state: null });
    expect(parseMomentumState('', platform, puuid)).toEqual({ status: 'corrupt', state: null });
    expect(parseMomentumState('[]', platform, puuid).status).toBe('corrupt');
    expect(parseMomentumState('{', platform, puuid).status).toBe('corrupt');
    expect(parseMomentumState(' '.repeat(100001), platform, puuid).status).toBe('corrupt');
    expect(parseMomentumState(serialized, 'na1', puuid).status).toBe('corrupt');
    expect(parseMomentumState(serialized, platform, otherPuuid).status).toBe('corrupt');
    expect(momentumStorageKey(platform, puuid)).not.toBe(momentumStorageKey(platform, otherPuuid));
  });

  it('rejects impossible targets, altered labels, duplicate baseline IDs and unrecognized fields without rewriting', () => {
    const mutations: ((state: MomentumState) => void)[] = [
      state => { state.cycles[0]!.target = 999; },
      state => { state.cycles[0]!.context.queueLabel = 'Invented queue'; },
      state => { state.cycles[0]!.baselineMatchIds[1] = state.cycles[0]!.baselineMatchIds[0]!; },
      state => { Object.assign(state.cycles[0]!, { metric: 'deaths' }); },
      state => { Object.assign(state, { premium: true }); },
      state => { state.cycles.push({ ...state.cycles[0]! }); },
    ];
    for (const mutate of mutations) {
      const state = structuredClone(started()); mutate(state);
      expect(parseMomentumState(JSON.stringify(state), platform, puuid).status).toBe('corrupt');
      expect(() => serializeMomentumState(state)).toThrow();
      const report = run(baseline(), { state });
      expect(report.status).toBe('read-only');
      expect(report.changed).toBe(false);
    }
  });

  it('rejects historical, duplicated and incorrectly marked checks', () => {
    for (const check of [
      { matchId: 'EUW1_10010', startedAt: now, value: 7, hit: true },
      { matchId: 'EUW1_10001', startedAt: now + hour, value: 7, hit: true },
      { matchId: 'EUW1_10010', startedAt: now + hour, value: 7, hit: false },
    ]) {
      const state = started(); state.cycles[0]!.checks = [check];
      expect(parseMomentumState(JSON.stringify(state), platform, puuid).status).toBe('corrupt');
    }
    const valid = run([...baseline(), game(10, -1)], { state: started(), now: now + 2 * hour }).state;
    valid.cycles[0]!.checks.push(valid.cycles[0]!.checks[0]!);
    expect(parseMomentumState(JSON.stringify(valid), platform, puuid).status).toBe('corrupt');
  });

  it('retains at most twelve cycles while keeping the most recent receipt and current target', () => {
    let state = started();
    let matches = baseline();
    for (let cycle = 0; cycle < MOMENTUM_CYCLE_LIMIT + 2; cycle++) {
      const start = (cycle * 4 + 1);
      matches = [...[0, 1, 2].map(offset => game(100 + cycle * 3 + offset, -(start + offset))), ...matches].slice(0, 20);
      state = run(matches, { state, now: now + (start + 3) * hour }).state;
    }
    expect(state.cycles).toHaveLength(MOMENTUM_CYCLE_LIMIT);
    expect(state.cycles.at(-1)?.status).toBe('active');
    expect(state.cycles.at(-2)?.status).toBe('complete');
    expect(parseMomentumState(serializeMomentumState(state), platform, puuid).status).toBe('valid');
  });
});
