// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMPANION_KEY, MAX_BACKUP_BYTES, archivePatchForVersion, beginRecall, emptyCompanion, finishRecall,
  makeSavedBuild, matchingBuilds, matchingNotes, mergeCompanion, parseCompanion, patchReview,
  readCompanion, serializeCompanion, updateCompanion, type CompanionState, type QuickNote, type RecallPatch,
} from '../../src/lib/companion';
import { itemMetadata, mayhemMatch, platform, puuid, sourceMatch } from '../player-e2e/fixtures';

const now = Date.parse('2026-10-28T12:00:00Z');
const context = { champion: 'Ahri', queue: '450', situation: 'vs-poke' as const };
const note = (overrides: Partial<QuickNote> = {}): QuickNote => ({
  id: 'note-1', text: 'Keep one dash for disengage.', champion: 'Ahri', queue: '450', situation: 'any',
  pinned: false, patch: '26.20', reviewedPatch: null, createdAt: now, updatedAt: now, ...overrides,
});
const state = (notes = [note()]): CompanionState => ({ ...emptyCompanion(), context: { ...context }, notes });
const archive: RecallPatch[] = [
  { id: '26.21', version: '16.21.1', date: '2026-10-20', champions: ['Ahri'], items: [{ id: 1001, name: 'Boots' }], records: [
    { kind: 'champion', targetId: 'Ahri', label: 'Fixture cooldown', before: '10', after: '11' },
    { kind: 'champion', targetId: 'Azir', label: 'Unrelated fixture', before: '5', after: '6' },
    { kind: 'item', targetId: '1001', label: 'Fixture price', before: '300', after: '350' },
  ] },
  { id: '26.20', version: '16.20.1', date: '2026-10-07', champions: ['Jinx'], items: [{ name: 'Some unmatched item' }] },
  { id: '26.19', version: '16.19.1', date: '2026-09-24', champions: ['Ahri'], items: [] },
];

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('contextual personal recall', () => {
  it('keeps exact queues and user-selected situations distinct while allowing general notes', () => {
    const notes = [
      note({ id: 'aram' }), note({ id: 'mayhem', queue: '2400' }), note({ id: 'ranked', queue: '420' }),
      note({ id: 'poke', situation: 'vs-poke' }), note({ id: 'healing', situation: 'vs-healing' }),
      note({ id: 'general', champion: '', queue: 'all' }), note({ id: 'jinx', champion: 'Jinx' }),
    ];
    expect(matchingNotes(notes, context).map(n => n.id)).toEqual(['poke', 'aram', 'general']);
    expect(matchingNotes(notes, { ...context, queue: 'all', champion: '' }).map(n => n.id)).toEqual(['general']);
    expect(matchingNotes(notes, { ...context, queue: '2400' }).map(n => n.id)).toEqual(['mayhem', 'general']);
  });

  it('prioritizes pinned applicable notes without allowing pinned irrelevant notes to leak', () => {
    const notes = [note({ id: 'specific', situation: 'vs-poke' }), note({ id: 'pinned-general', champion: '', queue: 'all', pinned: true }), note({ id: 'pinned-other', queue: '2400', pinned: true })];
    expect(matchingNotes(notes, context).map(n => n.id)).toEqual(['pinned-general', 'specific']);
  });

  it('freezes the original intention when its source note is subsequently revised or deleted', () => {
    const original = state();
    const started = beginRecall(original, 'note-1', null, '26.21', now);
    original.notes[0]!.text = 'Edited after preparing.';
    original.context.champion = 'Jinx';
    const revised = { ...started, notes: [] };
    expect(revised.runs[0]!.note!.text).toBe('Keep one dash for disengage.');
    expect(revised.runs[0]!.context.champion).toBe('Ahri');
    const finished = finishRecall(revised, started.runs[0]!.id, 'not-applicable', 'No poke matchup this game.', now + 60000);
    expect(finished.runs[0]).toMatchObject({ outcome: 'not-applicable', reflection: 'No poke matchup this game.', closedAt: now + 60000 });
    expect(started.runs[0]!.outcome).toBeNull();
    expect(() => finishRecall(finished, started.runs[0]!.id, 'helped', '', now + 120000)).toThrow('no longer');
  });

  it('requires explicit context and rejects stale selections and a second active card', () => {
    expect(() => beginRecall({ ...state(), context: { ...context, queue: 'all' } }, 'note-1', null, '26.21')).toThrow('exact mode');
    expect(() => beginRecall(state(), 'deleted', null, '26.21')).toThrow('no longer matches');
    expect(() => beginRecall(state(), null, null, '26.21')).toThrow('Choose a focus');
    const started = beginRecall(state(), 'note-1', null, '26.21', now);
    expect(() => beginRecall(started, 'note-1', null, '26.21')).toThrow('active card');
    expect(() => finishRecall(started, started.runs[0]!.id, 'helped', '', now - 1)).toThrow('clock');
  });

  it('does not discard the oldest decision to make room for the next one', () => {
    const full = state();
    const started = beginRecall(full, 'note-1', null, '26.21', now);
    const completed = finishRecall(started, started.runs[0]!.id, 'helped', '', now + 1).runs[0]!;
    full.runs = Array.from({ length: 50 }, (_, i) => ({ ...completed, id: `run-${i}` }));
    expect(() => beginRecall(full, 'note-1', null, '26.21', now + 2)).toThrow('history is full');
    expect(full.runs[49]!.id).toBe('run-49');
  });
});

describe('patch-aware context', () => {
  it('maps game patch prefixes to actual archive metadata rather than assuming numeric offsets', () => {
    expect(archivePatchForVersion('16.21.632.1234', archive)).toBe('26.21');
    expect(archivePatchForVersion('16.21', archive)).toBe('26.21');
    expect(archivePatchForVersion('26.21', archive)).toBe('26.21');
    expect(archivePatchForVersion('16.99', archive)).toBeNull();
    expect(patchReview(note({ patch: '16.21' }), archive).status).toBe('current');
  });

  it('links only newer relevant champion or authoritative item records', () => {
    expect(patchReview(note({ patch: '16.19' }), archive).changes.map(p => p.id)).toEqual(['26.21']);
    expect(patchReview(note({ patch: '16.19' }), archive).changes[0]!.records?.map(record => record.targetId)).toEqual(['Ahri']);
    expect(patchReview({ ...note({ champion: 'Jinx', patch: '26.20' }), items: [{ id: 1001, name: 'Boots' }] }, archive).changes.map(p => p.id)).toEqual(['26.21']);
    expect(patchReview({ ...note({ champion: 'Jinx', patch: '26.20' }), items: [{ id: 1001, name: 'Boots' }] }, archive).changes[0]!.records?.map(record => record.targetId)).toEqual(['1001']);
    expect(patchReview({ ...note({ champion: '', patch: '26.19' }), items: [{ id: 9999, name: 'Some unmatched item' }] }, archive).changes).toEqual([]);
  });

  it('uses explicit reviewed baselines without rewriting original provenance, and admits unknown coverage', () => {
    const original = note({ patch: '16.19', reviewedPatch: '26.21' });
    expect(patchReview(original, archive)).toMatchObject({ status: 'current', baseline: '26.21', changes: [] });
    expect(original.patch).toBe('16.19');
    expect(patchReview(note({ patch: '15.24' }), archive)).toMatchObject({ status: 'unknown', baseline: null, changes: [] });
    expect(patchReview(note(), []).status).toBe('unknown');
  });
});

describe('observed builds', () => {
  it('preserves source, exact queue, observed names and only compatible metadata', () => {
    const saved = makeSavedBuild(sourceMatch, platform, puuid, itemMetadata, now);
    expect(saved).toMatchObject({ source: 'EUN1_12345', patch: '16.21', queue: 420, items: [{ id: 1001, name: 'Boots' }], runes: [{ id: 8112, name: 'Electrocute' }] });
    expect(makeSavedBuild(sourceMatch, platform, puuid, itemMetadata, now + 10).id).toBe(saved.id);
    expect(makeSavedBuild(sourceMatch, platform, puuid, { ...itemMetadata, version: '16.20.1' }).items[0]!.name).toBe('Item 1001');
    expect(matchingBuilds([saved], context)).toEqual([]);
    expect(matchingBuilds([saved], { ...context, queue: '420' })).toEqual([saved]);
  });

  it('does not turn Mayhem augment records into standard runes or accept another player source', () => {
    expect(makeSavedBuild(mayhemMatch, platform, puuid, itemMetadata).runes).toEqual([]);
    expect(() => makeSavedBuild(sourceMatch, platform, 'other-player-000000000000000000000000000')).toThrow('containing this player');
  });
});

describe('browser persistence and transfer', () => {
  it('round-trips a complete card and merges additions without replacing local edits by default', () => {
    const current = state();
    const imported = { ...state([note({ text: 'Older remote version.' }), note({ id: 'note-2' })]), context: { ...context, champion: 'Jinx' } };
    const merged = mergeCompanion(current, parseCompanion(serializeCompanion(imported)));
    expect(merged.notes).toHaveLength(2);
    expect(merged.notes[0]!.text).toBe(current.notes[0]!.text);
    expect(merged.context.champion).toBe('Ahri');
    expect(mergeCompanion(current, imported, true).notes[0]!.text).toBe('Older remote version.');
    const started = beginRecall(current, 'note-1', null, '26.21', now);
    expect(parseCompanion(serializeCompanion(started))).toEqual(started);
  });

  it('rejects two independently unfinished cards rather than silently losing either', () => {
    const a = beginRecall(state(), 'note-1', null, '26.21', now);
    const b = beginRecall(state(), 'note-1', null, '26.21', now + 1);
    expect(() => mergeCompanion(a, b)).toThrow('Both browsers');
    expect(a.runs).toHaveLength(1);
    expect(b.runs).toHaveLength(1);
  });

  it('rejects malformed/oversized imports, duplicate IDs, contradictory cards and over-capacity merges', () => {
    expect(() => parseCompanion('{broken')).toThrow('not a supported');
    expect(() => parseCompanion('x'.repeat(MAX_BACKUP_BYTES + 1))).toThrow('too large');
    expect(() => parseCompanion(JSON.stringify(state([note(), note()])))).toThrow('not a supported');
    const started = beginRecall(state(), 'note-1', null, '26.21', now);
    started.runs[0]!.context.queue = '2400';
    expect(() => parseCompanion(JSON.stringify(started))).toThrow('not a supported');
    const full = state(Array.from({ length: 100 }, (_, i) => note({ id: `note-${i}` })));
    expect(() => mergeCompanion(full, state([note({ id: 'overflow' })]))).toThrow('100 notes');
  });

  it('reads the freshest state for updates and refuses to overwrite corrupt or blocked storage', () => {
    updateCompanion(() => state());
    updateCompanion(current => ({ ...current, notes: [...current.notes, note({ id: 'second' })] }));
    expect(readCompanion().notes.map(n => n.id)).toEqual(['note-1', 'second']);
    localStorage.setItem(COMPANION_KEY, '{invalid');
    expect(() => updateCompanion(() => emptyCompanion())).toThrow('not a supported');
    expect(localStorage.getItem(COMPANION_KEY)).toBe('{invalid');
    localStorage.removeItem(COMPANION_KEY);
    const getItem = localStorage.getItem.bind(localStorage);
    vi.stubGlobal('localStorage', { getItem, setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); } });
    expect(() => updateCompanion(() => state())).toThrow('Full');
    expect(readCompanion().notes).toEqual([]);
  });
});
