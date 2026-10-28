import { describe, expect, it } from 'vitest';
import { eligibility, structuralEligibility, type Match, type Memory } from '../../src/lib/player/contracts';
import { confirmMatchApplicability, parseMemories, reviseMemory } from '../../src/lib/player/memory';

const note: Memory = {
  id: 'conditional', player: 'eun1:player', champion: 'Jhin', role: 'BOTTOM', queue: 420,
  patch: '16.21', source: 'EUN1_12345', sourceDate: 100, createdAt: 300, trackingStartedAt: 300,
  revisedAt: null, evidence: ['inventory'], condition: 'Specific matchup or replay condition — requires confirmation',
  original: 'Observed boots', alternative: 'Compare defensive boots', targetItem: 3047,
  reason: 'Compare item properties', tradeoff: 'Different item properties', check: 'Purchase events',
  reflection: '', status: 'active', favorite: false,
};
const future = (id = 'EUN1_12346', start = 400) => ({
  metadata: { matchId: id },
  info: { gameCreation: start, gameDuration: 1800, gameVersion: '16.21.1', queueId: 420,
    gameMode: 'CLASSIC', gameType: 'MATCHED_GAME',
    participants: [{ puuid: 'player', championName: 'Jhin', teamPosition: 'BOTTOM' }] },
}) as Match;

function participantChange(change: Record<string, unknown>) {
  const match = future();
  return { ...match, info: { ...match.info, participants: [{ ...match.info.participants[0]!, ...change }] } } as Match;
}

describe('explicit conditional applicability', () => {
  it('requires a saved confirmation and lets the player reverse it', () => {
    const match = future();
    expect(structuralEligibility(note, match, 'player')).toBe('eligible');
    expect(eligibility(note, match, 'player')).toBe('unknown');
    const confirmed = confirmMatchApplicability(note, match, 'player', true);
    const [reopened] = parseMemories(JSON.stringify([confirmed]), note.player);
    expect(eligibility(reopened!, match, 'player')).toBe('eligible');
    expect(reopened).toMatchObject({ createdAt: 300, trackingStartedAt: 300, confirmedMatchIds: ['EUN1_12346'] });
    const reversed = confirmMatchApplicability(reopened!, match, 'player', false);
    expect(eligibility(reversed, match, 'player')).toBe('unknown');
    expect(reversed.confirmedMatchIds).toEqual([]);
  });

  it.each([
    ['wrong player', participantChange({ puuid: 'someone-else' })],
    ['wrong champion', participantChange({ championName: 'Ahri' })],
    ['wrong role', participantChange({ teamPosition: 'MIDDLE' })],
    ['missing role', participantChange({ teamPosition: '' })],
    ['unrecognized role', participantChange({ teamPosition: 'NONE' })],
    ['wrong queue', { ...future(), info: { ...future().info, queueId: 440 } }],
    ['unknown patch', { ...future(), info: { ...future().info, gameVersion: '16.22.1' } }],
    ['historical game', future('EUN1_12346', 200)],
    ['already started game', future('EUN1_12346', 300)],
  ] as [string, Match][])('cannot confirm %s, even with a forged stored ID', (_reason, match) => {
    expect(() => confirmMatchApplicability(note, match, 'player', true)).toThrow();
    expect(eligibility({ ...note, confirmedMatchIds: [match.metadata.matchId] }, match, 'player')).not.toBe('eligible');
  });

  it('requires a tracking baseline and the same saved player context', () => {
    expect(() => confirmMatchApplicability({ ...note, trackingStartedAt: null }, future(), 'player', true)).toThrow();
    expect(() => confirmMatchApplicability({ ...note, player: 'eun1:other' }, future(), 'player', true)).toThrow();
  });

  it('clears confirmations when the decision changes but preserves them for reflection', () => {
    const confirmed = confirmMatchApplicability(note, future(), 'player', true);
    const reflected = reviseMemory(confirmed, { alternative: note.alternative, targetItem: note.targetItem, condition: note.condition, reflection: 'Reviewed the replay' }, 500);
    expect(reflected.confirmedMatchIds).toEqual(['EUN1_12346']);
    expect(reflected.trackingStartedAt).toBe(300);
    const revised = reviseMemory(confirmed, { alternative: 'Compare another item', targetItem: 3111, condition: note.condition, reflection: '' }, 500);
    expect(revised.confirmedMatchIds).toEqual([]);
    expect(revised.trackingStartedAt).toBe(500);
    expect(eligibility(revised, future(), 'player')).toBe('ineligible');
    expect(eligibility(revised, future('EUN1_12347', 600), 'player')).toBe('unknown');
  });

  it('keeps at most 100 unique recent confirmations', () => {
    let stored = note;
    for (let index = 0; index <= 100; index++) stored = confirmMatchApplicability(stored, future(`EUN1_${20000 + index}`, 400 + index), 'player', true);
    expect(stored.confirmedMatchIds).toHaveLength(100);
    expect(stored.confirmedMatchIds).not.toContain('EUN1_20000');
    expect(stored.confirmedMatchIds).toContain('EUN1_20100');
    stored = confirmMatchApplicability(stored, future('EUN1_20100', 500), 'player', true);
    expect(stored.confirmedMatchIds).toHaveLength(100);
    expect(parseMemories(JSON.stringify([stored]), note.player)[0]?.confirmedMatchIds).toEqual(stored.confirmedMatchIds);
  });

  it('migrates existing notes to no confirmations and rejects malformed confirmations', () => {
    expect(parseMemories(JSON.stringify([note]), note.player)[0]?.confirmedMatchIds).toEqual([]);
    for (const confirmedMatchIds of [['../../other'], ['EUN1_12346', 'EUN1_12346']]) {
      expect(() => parseMemories(JSON.stringify([{ ...note, confirmedMatchIds }]), note.player)).toThrow();
    }
  });
});
